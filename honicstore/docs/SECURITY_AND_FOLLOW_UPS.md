# Security & follow-up work — Honic store

_Last updated: 2026-11-24 · branch `modern-style`_

This lists what is still open after the security / performance pass, in priority order, with the files involved. A short record of what was already fixed is at the end so nothing gets redone.

**Priority key:** 🔴 High — do soon · 🟠 Medium — plan it · 🟢 Low — when convenient

---

## 1. Security — to do

### 🔴 1.1 Rate limiting doesn't work reliably in production
- **Problem:** `lib/enhanced-rate-limit.ts` uses Upstash Redis when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set, and otherwise falls back to **in-memory** counters. Those variables are not set locally. If they aren't set on Vercel either, each serverless instance counts separately and resets on cold start, so limits are easy to bypass.
- **Affects:** every rate-limited route, including login, sign-up, and the paid Gemini photo search (`/api/image-search`, limit 15/min/IP).
- **Do:** create a free Upstash Redis database, add both variables in Vercel → Project → Settings → Environment Variables, and redeploy. Confirm with `getRateLimitBackendStatus()` (same file), which reports `upstash` vs `memory`.

### 🔴 1.2 Sign-up bot protection — code done, needs the Cloudflare keys
- **Done (2026-11-23):**
  - Cloudflare Turnstile on both sign-up forms (`components/auth-modal.tsx`, `app/become-supplier/page.tsx`), verified in `/api/auth/supabase-register` before anything is created (`lib/turnstile.ts`, `components/turnstile.tsx`). CSP allows `challenges.cloudflare.com`.
  - Throwaway inboxes (mailinator, yopmail, temp-mail, guerrillamail… ~200 domains and their subdomains) are refused: `lib/disposable-email-domains.ts`.
  - Typo domains (`gmial.com`…) refused; server enforces the password rule.
- **To switch the CAPTCHA on:** Cloudflare dashboard → Turnstile → Add site (your domains + `localhost`), then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel and redeploy. Until both are set the check is skipped.
- **Still:** do 1.1 so the sign-up rate limit actually holds.

> **Update 2026-11-22: Phase 1, Phase 1b and the cleanup are APPLIED and verified on the live database** (see `docs/PRODUCTION_CHECKLIST.md` step 5). The live review found more than the first test:
> - anonymous order/cart/order-item writes (`auth.uid() IS NULL` policies);
> - anyone editing product options;
> - stock and cleanup functions callable by anyone;
> - any signed-in user able to manage all confirmed orders, change site settings, or make themselves admin.
>
> All are closed now. **Still to do:** run Phase 2 after deploying.
> **Known existing issue:** orders created through a customer's session fail on the `audit_log` trigger, which has no insert policy. The new code creates orders with the service key, so it isn't affected; the old `/api/checkout` path is broken anyway.

### 🔴 1.3 Customer data is publicly readable — Phase 1 applied, Phase 2 after deploy
- **Found (2026-11-22):** anyone with the public anon key (it ships in the website) could read **all** rows of:
  - `profiles`: 30 customers' names and emails, 18 phone numbers, 1 TIN/NIDA number, 1 certificate link.
  - `orders` and `order_items`: 12 orders with shipping and billing addresses.
  - `cart_items` and `newsletter_subscriptions`: every cart, and 4 emails.
- **Code side: done** (branch `modern-style`). Every remaining write to these tables now uses the service-role key, after the route has checked the user. The supplier card and review names read with the service-role key, selecting public columns only.
- **Database side: run in this order.**
  1. Deploy the `modern-style` code.
  2. Run `database/2026-11-22-rls-lockdown.sql` in Supabase → SQL Editor. It's one transaction, it backs up the old policies, and rollback steps are inside the file.
  3. Run `database/2026-11-22-security-review-queries.sql` and check:
     - tables without RLS;
     - open policies;
     - SECURITY DEFINER functions anon can execute (especially `update_product_stock`, `reduce_product_stock` and `check_and_decrement_stock`);
     - public storage buckets.
  4. Test sign-in, profile edit, wishlist, cart, checkout, "my orders", supplier dashboard and the admin panel.
- **After applying:**
  - Review Supabase logs for unusual reads of these tables.
  - Check whether Tanzania's PDPA (2022) requires notifying anyone. Ask a lawyer.
  - Restrict the Google Maps key (stored in `admin_settings.api_keys`, readable by anyone) to your domains in Google Cloud.

### 🟠 1.4 Content-Security-Policy still allows inline and `eval` scripts
- **Problem:** `proxy.ts` sends `script-src 'self' 'unsafe-eval' 'unsafe-inline' …`. That weakens the main protection against injected scripts (XSS).
- **Do:** move to nonce-based CSP (Next.js supports a per-request nonce in `proxy.ts`), then remove `'unsafe-inline'`. Remove `'unsafe-eval'` if no library needs it in production. Test checkout (payment widget), maps, and analytics after the change.

### ✅ 1.5 Two CSP definitions — fixed 2026-11-24
- The dead CSP and the other duplicate security headers were removed from `next.config.mjs`. `proxy.ts` is the only place they're set (it runs on every page and API path).

### ✅ 1.6 TypeScript errors — fixed 2026-11-24
- Store: 466 → **0** errors, and `typescript.ignoreBuildErrors` is now `false`, so a new type error fails the build. The production build passes with the type check on.
- Still open: ESLint reports ~1,900 issues, mostly `no-explicit-any` and unused variables. Next 16 doesn't lint during builds, so it's style debt, not a blocker.
- The **admin app** still has 466 type errors of its own and `ignoreBuildErrors: true`.

### 🟠 1.7 Internal endpoints share the cron secret
- **What:** `/api/cache/clear`, `/api/performance` and `/api/health/cache` are now locked behind `CRON_SECRET` in production (see `lib/internal-auth.ts`).
- **Do:** make sure `CRON_SECRET` on Vercel is long and random (32+ characters). Optionally give these routes their own `INTERNAL_API_SECRET`, so a leaked cron secret doesn't also unlock them.

### ✅ 1.8 SVG images — fixed 2026-11-24
- `images.dangerouslyAllowSVG` is now `false` (next/image still shows `.svg` files, without the optimizer).
- Uploads (`/api/media/upload`, `/api/supplier/logo-upload`) no longer accept SVG, and every uploaded image is checked by its real file contents (`lib/image-sniff.ts`), not the type the browser claims.

### ✅ 1.9 Photo search OCR data — fixed 2026-11-24
- `data/tessdata/eng.traineddata.gz` (2.9 MB, Apache-2.0) ships with the app and is loaded from disk (`lib/image-match.ts`; `outputFileTracingIncludes` in `next.config.mjs` makes Vercel include it). Nothing is downloaded at runtime.

### 🟢 1.10 Remaining major package upgrades (no known vulnerabilities)
- `npm audit` reports **0 vulnerabilities**, but 19 packages have newer major versions.
- **Low-risk batch, recommended:** `@types/nodemailer` (to match nodemailer 10), `tesseract.js` 7, `isomorphic-dompurify` 3, `nanoid`, `uuid`, `dotenv`, `@types/node`.
- **Large, plan separately:** `tailwindcss` 4, `typescript` 7, `eslint` 10, `lucide-react` 1.x, `recharts` 3.
- **Keep pinned on purpose:** `tr46` (0.0.3).

---

## 2. Other remaining issues

### Testing (do before merging `modern-style`)
- 🔴 **Browser test** the new product page (gallery, buy box, variants, add to cart, China import dialog, bulk order, price alert, reviews), the new header, the photo search window (upload, drop, paste, phone camera), and the card quantity steppers. These were tested over HTTP and type-checked, but not clicked through in a browser.
- 🔴 **Hydration check:** pages are now rendered on the server (previously the sign-in wrapper forced everything to render in the browser). Open the main pages with DevTools → Console and look for red "hydration" errors.
- 🟢 **Missing product:** now calls `notFound()` and shows `app/products/[id]/not-found.tsx` with `noindex`. The status stays 200 because `loading.tsx` starts streaming first (Next 16 can't change the status after that). Search engines still drop the page. A true 404 would need removing that skeleton or a check in `proxy.ts`.

### Hosting / performance
- 🟠 **Watch Vercel image usage:** product images now go through Next.js image optimization (cards went from 172 KB to 5 KB). Check Vercel → Usage → Image Optimization after a week. The config is deliberately small (WebP only, 5 widths, 4 image sizes) to keep transformations low.
- 🟠 **Photo-search fingerprints are lost on cold starts:** the hash index lives in the server's temp folder, so on Vercel it rebuilds after cold starts (about 30 seconds in the background, during which Gemini is used more). Store the hashes in a Supabase table to make this permanent.
- 🟢 **Turbopack:** builds and dev use webpack (`--webpack` in `package.json`) because of the custom webpack config in `next.config.mjs`. Migrating to Turbopack would make builds noticeably faster.
- 🟢 **Build memory:** production builds need the 6 GB heap setting and `experimental.cpus: 2` on an 8 GB machine. Close other heavy apps when building locally.

### Data quality (fix in admin)
- 🟠 Nearly every product has **`is_new = true`**, so the "NEW" badge shows almost everywhere.
- 🟠 Most product **gallery images are placeholders**, so the hover second-photo and photo-search fingerprints have fewer real images to use.
- 🟢 Some products have **no real main image** (for example IDs 215 and 420).
- 🟢 `/api/supplier-plans` returns **no plans**. Check whether that's intended, since supplier sign-up can attach a plan.

### Bugs found during the database review (not fixed yet)
- 🟢 **Database leftovers:**
  - Backup tables `orders_backup`, `order_items_backup` and `profiles_backup`.
  - A stale `products_listing_view` (20 of 270 products, unused).
  - Duplicate empty `reviews` and `product_reviews` tables (the app reads `product_reviews`).

### Code cleanup
- 🟢 ESLint style debt (see 1.6).

---

## 3. Already fixed in this pass (for reference)

- **2026-11-24 — bugs found while clearing the type errors (each one crashed or silently failed):**
  - **Signed-in add-to-cart crashed** (`/api/cart` POST used an undefined `variantPrice`), so a logged-in shopper's cart was never saved.
  - **Supplier advert delete and promotion edit/delete never worked**: they read `params.id` without awaiting `params` (Next 15+), so the id was `undefined`.
  - **`createErrorResponse(err, 'message', 500)`** (35 call sites) passed text as the HTTP status, so the error response itself threw.
  - **`logSecurityEvent(event, undefined, details)`** crashed on a missing request, which turned 401s into 500s on supplier routes.
  - **Login "please verify your email" message never showed** (`getUserByEmail` doesn't exist in supabase-js).
  - **"My orders"** never showed per-item supplier status or tracking (it didn't select `confirmed_orders.id`). **Order history location** was always "Destination".
  - **`/api/stock?id=`** returned nothing for a single id. **Wishlist → cart** used a string id (duplicate lines).
  - **Products API fuzzy search** with a category filter threw (`.split` on an array). The catch blocks in products/detail routes threw again (`productId` out of scope, non-existent `recordSecurityEvent`, missing `clearCache` import).
  - **Supplier analytics/featured "pay now" button crashed** (`router` undefined). The supplier payment error logging crashed.
  - **Shared data cache** prefix-clear threw (iterated a number). **secure-config** defaults came back as strings under zod 4.
  - The account sidebar never showed the user's name or photo.
- **Removed:** an old demo login system with a built-in JWT secret (`lib/auth.ts`, `lib/users.ts`, `/api/auth/me`, `/api/auth/verify`); 8 empty route files; an unused diagnostic route (`check-model-column`); the unlinked email-preferences page; an unused SWR provider that copied per-user API data into sessionStorage every 5 s; the admin app's unused user-settings panel and its broken image-proxy fallback.
- **Empty cart:** "You might also need" now loads in parallel with the cart, and its first row of images loads eagerly.
- **Packages:** in-range updates (supabase-js 2.75 → 2.119, React 19.3.1…) and `@types/nodemailer` 8. `npm audit`: 0 vulnerabilities.
- **Local test run (production build):** 54/55 smoke and security checks pass. The one exception is a deleted supplier route answering 401 from `proxy.ts` instead of 404. Auth UI checks all pass. Cart and checkout render with items, with no console errors.

- **2026-11-24 — critical fixes (need a deploy to take effect on the live site):**
  - **Private data could be cached and shown to other people.** `next.config.mjs` sent `Cache-Control: public, max-age=1800, s-maxage=1800` on every page and API response, including `/api/auth/session`, `/api/cart` and `/api/user/profile` (confirmed on honiccompanystore.com). APIs are now `private, no-store`. Only public catalogue APIs (products, product detail, sold count, search, categories, company settings) are cached on the CDN for 60 s. Pages use Next's own headers. The hand-written ETags (one value for every page) are gone. **After deploying, purge the Vercel cache** (Project → Settings → Data Cache / CDN → Purge everything).
  - **Login could be faked with a hand-made cookie.** `validateAuth()` (`lib/auth-server.ts`, used by orders, cart, media upload/delete, admin routes) and `/api/auth/session` fell back to the unverified `getSession()` user when the real check failed. A crafted cookie was accepted as any user ID, including an admin's (confirmed locally). Users are now only accepted after Supabase verifies them. `getUserAndRole()` reads the admin flag with the service key.
  - **`/api/media/upload` GET and DELETE had no login check.** Anyone could list any storage bucket's file names (including the private `supplier-documents`) or delete product images. Both handlers were removed (nothing in the store used them; the admin app has its own routes).
  - **Supplier logo upload** could delete any file in `service-images` that a saved logo link pointed to. It now only deletes the supplier's own old logo. The file extension comes from the real file type.
  - **Account photo upload** always failed (non-admins needed a product ID). Photos now go to `product-images/avatars/<user id>/`.
  - **Admin app (honicstore-admin), needs its own deploy:** `/api/media/upload` (POST + GET) and `/api/media/delete` had **no login check**, so anyone could upload files, replace any product's main photo, list buckets or delete product media. They now require an admin (`validateAdminAccess`); the private `supplier-documents` bucket can't be listed. The two scheduled-cleanup routes fell back to built-in secrets (`default-cleanup-key`, `scheduled-cleanup-token`) when their env vars were missing; they are now disabled unless `CLEANUP_API_KEY` / `CLEANUP_SCHEDULED_TOKEN` (24+ characters) are set. Added security headers (no framing, HSTS, nosniff, noindex) and `private, no-store` on admin APIs.
  - **Speed:** product/category photos in plain <img> tags were full-size originals (up to 423 KB each); they now go through the image optimizer at display size (`optimizedImg()` in `lib/image-optimize.ts`). Production build, desktop, cold cache: `/products` images 3.6 MB → 194 KB; every page shows content in 0.4–1.7 s (phone on fast 4G: 0.5–1.7 s).

- **2026-11-23:** saving the account profile always failed (it wrote a missing `avatar` column). The photo is now stored on the login record, only Supabase-storage photo links are accepted, the route accepts the Bearer token the pages send, and it no longer returns `select(*)`. Deleted the unused, broken `/api/user/settings` and `/api/checkout` routes.

- **Security**
  - Locked public ops endpoints: `/api/cache/clear` (anyone could wipe the cache), `/api/performance` (leaked visitor IPs), `/api/health/cache`.
  - Fixed an **open proxy / SSRF** in `/api/images/proxy`: a substring check let any URL through. It now accepts Supabase public storage only, follows no redirects, passes images only, and caps size at 15 MB.
  - Allowed YouTube and Vimeo frames in the CSP (product videos were blocked).
  - **Deleted `/api/users`:** it had no login check and returned all 30 user records to anyone, with open create/update/delete. Nothing used it.
  - **Removed `POST /api/user/orders`:** any signed-in user could create an order with any status, payment status ("paid") and total from the request body. Nothing used it; real checkout computes these on the server.
  - **Moved customer-data writes to the service-role key** (checkout, order notes, profile, wishlist, saved-for-later, settings, and the admin app's profile auto-create), ready for the RLS lockdown.
  - **Fixed product review names never showing:** the query asked for a non-existent `avatar_url` column.
  - Photo-search rate limit added.
- **Packages:** `npm audit` went from 6 vulnerabilities (5 high) to 0. Upgraded Next.js 15 → 16, zod 3 → 4, nodemailer 7 → 10 and sharp to 0.35.
- **zod 4 fixes:** `.errors` → `.issues`, the email-domain message restored, a permissive plan-ID check kept, and "Required" restored for missing fields (`lib/zod.ts`).
- **Next.js 16 fixes:** `middleware.ts` → `proxy.ts`, ESLint flat config, and removed the custom cache headers on `/_next/*` (they broke caching and gave every file the same ETag).
- **Performance**
  - Pages are server-rendered again (the sign-in wrapper used to force browser-only rendering on every page).
  - Images are optimized.
  - Removed two background route prefetchers and a 100 ms timer that ran on every page.
  - Removed 6 unused packages (42 MB) and 10 dead files.
- **Products API:** fixed the "popular products" shortcut that sometimes returned only 2 items.
