# Honic Store - Pages Analysis: Static vs Dynamic

## Summary
- **Total Pages**: 89 pages
- **Dynamic Pages**: 89 pages (all pages use client-side rendering or dynamic routes)
- **Static Pages**: 0 pages (all pages are dynamically rendered)

## Dynamic Pages (89 total)

### Pages with Dynamic Routes (3 pages)
These pages use dynamic route parameters `[param]`:

1. **`/products/[id]`** - Product detail page
   - Route: `/products/[id]`
   - Type: Client-side rendered (`"use client"`)
   - Dynamic parameter: `id` (product ID)

2. **`/supplier/products/[id]/edit`** - Supplier product edit page
   - Route: `/supplier/products/[id]/edit`
   - Type: Client-side rendered (`"use client"`)
   - Dynamic parameter: `id` (product ID)

3. **`/account/orders/[id]`** - Order detail page
   - Route: `/account/orders/[id]`
   - Type: Client-side rendered (`"use client"`)
   - Dynamic parameter: `id` (order ID)

### Pages Explicitly Marked as Dynamic (6 pages)
These pages have `export const dynamic = 'force-dynamic'`:

1. **`/siem-dashboard/products/out-of-stock`** - Admin out-of-stock products page
2. **`/siem-dashboard/orders`** - Admin orders page
3. **`/siem-dashboard/products`** - Admin products page
4. **`/siem-dashboard/categories`** - Admin categories page
5. **`/siem-dashboard/advertisements`** - Admin advertisements page
6. **`/siem-dashboard/confirmed-orders`** - Admin confirmed orders page

### Client-Side Rendered Pages (89 pages)
All pages use `"use client"` directive, making them client-side rendered (dynamic):

#### Public Pages (40 pages)
1. `/` (root) - Redirects to `/products` (server-side redirect)
2. `/home` - Home page
3. `/products` - Product listing page
4. `/products/[id]` - Product detail page (dynamic route)
5. `/products/on-demand` - On-demand products page
6. `/cart` - Shopping cart page
7. `/checkout` - Checkout page
8. `/checkout/return` - Checkout return page
9. `/checkout/success` - Checkout success page
10. `/checkout/cancel` - Checkout cancel page
11. `/categories` - Categories page
12. `/about` - About page
13. `/contact` - Contact page
14. `/help` - Help page
15. `/support` - Support page
16. `/support/help-center` - Help center page
17. `/support/technical-support` - Technical support page
18. `/support/shipping-info` - Shipping info page
19. `/support/returns-refunds` - Returns & refunds page
20. `/support/order-tracking` - Order tracking page
21. `/privacy` - Privacy policy page
22. `/terms` - Terms of service page
23. `/cookies` - Cookies policy page
24. `/gdpr` - GDPR page
25. `/data-protection` - Data protection page
26. `/qrcode` - QR code page
27. `/coming-soon` - Coming soon page
28. `/unauthorized` - Unauthorized page
29. `/error` - Error page
30. `/discover` - Discover page (redirects to `/products`)
31. `/featured` - Featured page (redirects to `/products`)
32. `/buyer-central` - Buyer central page (redirects to `/products`)
33. `/become-supplier` - Become supplier page
34. `/china` - China page
35. `/settings` - Settings page
36. `/services/stem-kits` - STEM kits service page
37. `/services/prototyping` - Prototyping service page
38. `/services/pcb` - PCB service page
39. `/services/ai` - AI service page
40. `/winga/business-info` - Winga business info page
41. `/winga/support` - Winga support page

#### Authentication Pages (6 pages)
1. `/auth/login` - Login page
2. `/auth/register` - Registration page
3. `/auth/forgot-password` - Forgot password page
4. `/auth/reset-password` - Reset password page
5. `/auth/callback` - Auth callback page
6. `/auth/auth-code-error` - Auth code error page

#### User Account Pages (11 pages)
1. `/account` - Account dashboard
2. `/account/settings` - Account settings
3. `/account/payment` - Payment methods
4. `/account/orders` - Orders list
5. `/account/orders/[id]` - Order detail (dynamic route)
6. `/account/orders/history` - Order history
7. `/account/wishlist` - Wishlist
8. `/account/saved-later` - Saved for later
9. `/account/messages` - Messages
10. `/account/email-preferences` - Email preferences
11. `/account/coupons` - Coupons
12. `/account/coins` - Coins

#### Supplier Dashboard Pages (13 pages)
1. `/supplier/dashboard` - Supplier dashboard
2. `/supplier/products` - Supplier products list
3. `/supplier/products/add` - Add product page
4. `/supplier/products/[id]/edit` - Edit product page (dynamic route)
5. `/supplier/orders` - Supplier orders
6. `/supplier/orders/history` - Supplier order history
7. `/supplier/analytics` - Supplier analytics
8. `/supplier/marketing` - Marketing tools
9. `/supplier/featured` - Featured products
10. `/supplier/payouts` - Payouts page
11. `/supplier/payment` - Payment page
12. `/supplier/upgrade` - Upgrade page
13. `/supplier/support` - Supplier support
14. `/supplier/company-info` - Company information
15. `/supplier/account/settings` - Account settings
16. `/supplier/account/cancel` - Cancel account
17. `/supplier/invoices` - Invoices page

#### Admin Dashboard Pages (9 pages)
1. `/siem-dashboard` - Admin dashboard home
2. `/siem-dashboard/products` - Admin products (force-dynamic)
3. `/siem-dashboard/products/out-of-stock` - Out of stock products (force-dynamic)
4. `/siem-dashboard/products/new` - New product page
5. `/siem-dashboard/orders` - Admin orders (force-dynamic)
6. `/siem-dashboard/confirmed-orders` - Confirmed orders (force-dynamic)
7. `/siem-dashboard/categories` - Categories management (force-dynamic)
8. `/siem-dashboard/advertisements` - Advertisements (force-dynamic)
9. `/siem-dashboard/suppliers` - Suppliers management
10. `/siem-dashboard/supplier-plans` - Supplier plans
11. `/siem-dashboard/users` - Users management
12. `/siem-dashboard/payout-accounts` - Payout accounts
13. `/siem-dashboard/settings` - Admin settings

## Special Files

### Server-Side Files
1. **`/sitemap.ts`** - Sitemap generation (marked as `force-dynamic`)
2. **`/robots.ts`** - Robots.txt generation
3. **`/metadata.ts`** - Metadata configuration
4. **`/layout.tsx`** - Root layout
5. **`/error.tsx`** - Error boundary

### API Routes (All Dynamic)
All API routes in `/api/**` are marked as `force-dynamic`:
- Authentication routes (`/api/auth/**`)
- Product routes (`/api/products/**`)
- Order routes (`/api/orders/**`)
- Payment routes (`/api/payment/**`)
- Admin routes (`/api/admin/**`)
- Supplier routes (`/api/supplier/**`)
- User routes (`/api/user/**`)
- Webhook routes (`/api/webhooks/**`)
- And many more...

## Notes

1. **All pages are dynamic**: Every page in the application uses client-side rendering (`"use client"`) or is explicitly marked as dynamic, meaning no pages are statically generated at build time.

2. **Dynamic routes**: Only 3 pages use dynamic route parameters (`[id]`), but all pages are rendered dynamically.

3. **Redirect pages**: Some pages (`/discover`, `/featured`, `/buyer-central`) immediately redirect to `/products` using client-side navigation.

4. **Root page**: The root page (`/`) uses a server-side redirect to `/products`, making it the only server-side rendered page, but it's still dynamic in nature.

5. **Build optimization**: The sitemap is marked as `force-dynamic` to prevent memory issues during build, and it revalidates every hour.

6. **Performance**: All pages are client-side rendered, which means:
   - Faster initial page loads (no server-side rendering)
   - Better interactivity
   - Requires JavaScript to be enabled
   - SEO considerations (content is rendered client-side)

## Recommendations

1. **Consider Static Generation**: For pages like `/about`, `/privacy`, `/terms`, `/contact`, consider using static generation (`export const dynamic = 'force-static'`) or removing `"use client"` to improve performance and SEO.

2. **Hybrid Approach**: Use static generation for content pages and dynamic rendering for interactive pages.

3. **ISR (Incremental Static Regeneration)**: For product pages, consider using ISR with revalidation to get the benefits of static generation while keeping content fresh.
