# Production go-live checklist — branch `modern-style`

_2026-11-22._ Do the steps in order. **Step 5 must come after step 4**, because the database lockdown expects the new code to be live.

Who does it: 🧑 you · 🤖 Claude (if you ask) · 🧑/🤖 either

---

## 1. Vercel settings (🧑, about 10 min)

Vercel → your store project → **Settings**:

- **Node.js version:** **20.x or newer** (Next.js 16 needs ≥ 20.9).
- **Build command:** leave the default (`npm run build`). It already includes `--webpack` and the larger memory setting.
- **Environment variables** (Production + Preview). Check each exists:

| Variable | Why | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database (public) | existing |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes. **Required now:** checkout, profile and wishlist depend on it | existing, confirm it's set |
| `GEMINI_API_KEY` | Photo search (AI step) | **new** |
| `CRON_SECRET` | Cron jobs + locked ops endpoints (`/api/cache/clear`, `/api/performance`, `/api/health/cache`). Use 32+ random characters | confirm |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Makes rate limits work across serverless instances (free Upstash database) | **recommended, new** |
| `GEMINI_MODEL` | Optional. Leave unset to use the built-in fastest model | optional |

## 2. Commit and push (🧑/🤖)

Everything on `modern-style` is still uncommitted. Two apps changed:

- `honicstore/`: the store (most of the work).
- `honicstore-admin/lib/admin-auth.ts`: one change (missing-profile creation uses the service key).

Suggested commits, so changes are easy to review or revert:

1. Theme, layout and responsive restyle.
2. New product detail page.
3. Photo search (Lens): Gemini, fingerprint and OCR.
4. Security and performance: locked endpoints, image proxy, removed `/api/users`, removed unsafe order POST, dependency upgrades (Next 16, zod 4, nodemailer 10, sharp).
5. RLS preparation: service-key writes, SQL scripts, docs.

Then push `modern-style` and open a pull request to `main`. Vercel builds a **preview** automatically.

## 3. Test the preview deployment (🧑, about 30 min)

Use a normal account and, separately, an admin and a supplier account:

- [ ] Home, shop, categories, product page (gallery, options, add to cart, buy now, China import dialog).
- [ ] **Photo search:** camera icon → upload / drag / Ctrl+V; phone → take photo.
- [ ] Card **− qty +** steppers on the shop and demo pages.
- [ ] Sign up (a real email you own), log in, log out.
- [ ] Profile edit, wishlist, saved for later, cart.
- [ ] **Checkout → payment → "My orders"** (one small real or sandbox payment).
- [ ] Supplier dashboard: products, orders.
- [ ] Admin panel: orders, users.
- [ ] Browser console (F12): no red **hydration** errors on the pages above.

## 4. Deploy to production (🧑)

Merge the pull request into `main`. Vercel deploys to production. Repeat a quick smoke test (home, product, cart, login).

## 5. Lock down the database (🧑/🤖) — right after step 4

> **Status 2026-11-22: most of this is already done on the live database** (applied by Claude with your approval, verified):
> - ✅ `2026-11-22-rls-hotfix-phase1.sql`: anonymous access closed, privilege escalation and fake payments blocked, stock and cleanup functions locked, product-option edits limited to their owner.
> - ✅ `2026-11-22-rls-hotfix-phase1b-confirmed-orders.sql`: confirmed orders limited to owner, supplier and admin.
> - ✅ `2026-11-22-cleanup.sql`: unused backup tables and the stale view moved to the `private` schema.
> - ✅ Verified as an anonymous visitor and as an impersonated customer: 0 private rows readable, every write probe denied, 0 unsafe policies, 0 tables without RLS.
> - ⏳ **Remaining: Phase 2** (`2026-11-22-rls-lockdown.sql`), which removes customers' direct write access to profiles and orders. Run it **after** this branch is deployed.

The customer data exposure stays open until this is done.

- **Option A (you):** Supabase → **SQL Editor** → paste and run `database/2026-11-22-rls-lockdown.sql`.
- **Option B (Claude):** add `SUPABASE_ACCESS_TOKEN=sbp_…` to `honicstore/.env.local` (never paste it in chat), and Claude runs it and verifies. Delete the token afterwards in Supabase → Account → Access Tokens.

Then:

- [ ] Run `database/2026-11-22-security-review-queries.sql`. Expect: no customer tables without RLS, no open write policies, and stock functions not executable by `anon`.
- [ ] Verify anonymous access: profiles, orders and carts should return **0 rows** with the anon key (Claude can run this check).
- [ ] Repeat the step 3 checks for sign-in, profile, wishlist, cart, checkout, "My orders", supplier and admin.
- [ ] If anything breaks, the rollback is at the bottom of the lockdown script.

## 6. After launch (🧑)

- [ ] Supabase → Logs: look for unusual reads of `profiles` / `orders` from before the lockdown.
- [ ] Ask a lawyer whether Tanzania's **PDPA 2022** requires notifying anyone about the past exposure.
- [ ] Google Cloud: restrict the **Google Maps key** to your domains (HTTP referrers).
- [ ] After one week, check usage in Vercel → **Usage → Image Optimization** and in Google AI Studio (Gemini).

## 7. Next improvements (planned)

- ✅ **Search rewrite: DONE (2026-11-22).**
  - Database function `search_products_v2` (`database/2026-11-22-search-v2.sql`, applied live) is typo-tolerant (edit distance like Algolia: 1 typo for 5–7 letters, 2 for 8+), ignores spaces and dashes (`loadcell`, `hcsr04`), ranks name matches first, and has filters, sorting and a total count.
  - About 1.9–3.3 s per search before; now about 0.4 s, nearly all of it network travel.
  - New endpoints: `/api/search` (typed) and `/api/search/ai` (Gemini turns natural language into keywords, category, price and sort).
- ✅ **Marketplace is the main products page:** `/products`, with typed, AI and photo search, filters and load-more.
- ✅ **Removed pages, now redirecting:**
  - `/china` → `/products`
  - `/marketplace-demo` → `/products`
  - `/settings` → `/account/settings`
  - the empty `/products/on-demand`
  - plus the China page's unused search modal components.
- The old 4,900-line products page and the old `/api/products` fuzzy-search path are no longer used by the shop page. `/api/products` remains for other pages (home sections, admin). Its heavy search code can be removed in a later cleanup.
- **Sign-up bot protection** (Cloudflare Turnstile) and a disposable-email blocklist.
- Everything else, by priority: `docs/SECURITY_AND_FOLLOW_UPS.md`.
