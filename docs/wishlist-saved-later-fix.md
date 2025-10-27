# Wishlist & Saved for Later Fix

## **Summary**

Fixed the wishlist and "saved for later" functionality so that:
1. Items are now fetched from the database (not local state)
2. Product links use slugs for SEO-friendly URLs
3. Data persists across sessions

---

## **Issues Fixed**

### **Issue 1: Items Not Showing on Cart Page**
**Problem:** Wishlist and saved for later items were stored in local state (`useState`) which was lost on page refresh.

**Solution:** Replaced local state with the proper hooks:
- `useWishlist()` - fetches from database
- `useSavedLater()` - fetches from database

### **Issue 2: Product Links Without Slugs**
**Problem:** Product links used IDs instead of slugs, e.g., `/products/123` instead of `/products/product-name`

**Solution:** Updated all product links to use slug:
- Wishlist page: `href={`/products/${item.slug}`}`
- Saved for later page: `href={`/products/${product.slug || product.id}`}`

---

## **Files Modified**

### **1. `app/cart/page.tsx`**

**Changes:**
- Added imports for `useWishlist` and `useSavedLater` hooks
- Replaced local state with hook data:
  ```typescript
  // Before:
  const [wishlist, setWishlist] = useState<any[]>([])
  const [savedForLater, setSavedForLater] = useState<any[]>([])
  
  // After:
  const { items: wishlistItems, add: addToWishlist, remove: removeFromWishlist } = useWishlist()
  const { items: savedForLaterItems, add: addToSavedLater } = useSavedLater()
  ```
- Updated `handleSaveForLater` to use hook's `add` function
- Updated `handleAddToWishlist` to use hook's `add` and `remove` functions
- Updated `isInWishlist` to check `wishlistItems` from hook

### **2. `app/account/wishlist/page.tsx`**

**Changes:**
- Added `slug` field to `WishlistItem` interface
- Included `slug` in the memoized wishlist items
- Updated all product links to use slug:
  ```typescript
  // Before:
  href={`/products/${item.productId}`}
  
  // After:
  href={`/products/${item.slug}`}
  ```
- Updated `handleViewProduct` function to accept and use slug

### **3. `app/account/saved-later/page.tsx`**

**Changes:**
- Updated product links to use slug with fallback to ID:
  ```typescript
  // Before:
  href={`/products/${product.id}`}
  
  // After:
  href={`/products/${product.slug || product.id}`}
  ```
- Updated `handleViewProduct` function to accept and use slug

---

## **How It Works Now**

### **Wishlist Flow:**
1. User clicks "Add to Wishlist" on a product
2. `handleAddToWishlist` calls `addToWishlist(productId)` from hook
3. Hook saves to database (authenticated) or localStorage (guest)
4. Wishlist page fetches items using `useWishlist()` hook
5. Product links use slugs: `/products/product-name`

### **Saved for Later Flow:**
1. User clicks "Save for Later" on cart page
2. `handleSaveForLater` calls `addToSavedLater(productId)` for each cart item
3. Hook saves to database (authenticated) or localStorage (guest)
4. Saved for later page fetches items using `useSavedLater()` hook
5. Product links use slugs: `/products/product-name`

---

## **Benefits**

### **1. Data Persistence**
- Items now persist in database for authenticated users
- Items persist in localStorage for guest users
- No data loss on page refresh

### **2. SEO-Friendly URLs**
- Product links now use slugs instead of IDs
- Example: `/products/arduino-uno-r3` instead of `/products/123`
- Better for search engines and users

### **3. Consistent Behavior**
- Wishlist and saved for later work the same way across all pages
- Hooks handle API calls automatically
- Synchronization between authenticated and guest modes

---

## **Testing**

### **Test Wishlist:**
1. Add a product to wishlist on detail page
2. Go to `/account/wishlist`
3. **Expected:** Product appears with slug-based link
4. Click product
5. **Expected:** Navigate to `/products/[slug]`

### **Test Saved for Later:**
1. Add items to cart
2. Click "Save for Later" on cart page
3. Go to `/account/saved-later`
4. **Expected:** Products appear with slug-based links
5. Click product
6. **Expected:** Navigate to `/products/[slug]`

### **Test Data Persistence:**
1. Add items to wishlist/saved for later
2. Refresh the page
3. **Expected:** Items still visible (no data loss)

---

## **API Endpoints Used**

- `GET /api/user/wishlist` - Fetch wishlist
- `POST /api/user/wishlist` - Add to wishlist
- `DELETE /api/user/wishlist?productId=X` - Remove from wishlist

- `GET /api/user/saved-later` - Fetch saved for later
- `POST /api/user/saved-later` - Add to saved for later
- `DELETE /api/user/saved-later?productId=X` - Remove from saved for later

---

## **Database Schema**

### **Wishlist**
Stored in `profiles.wishlist_product_ids` (array of product IDs)

### **Saved for Later**
Stored in `profiles.saved_for_later` (JSON array of product data)

---

## **Related Files**

- `hooks/use-wishlist.ts` - Wishlist hook with API integration
- `hooks/use-saved-later.ts` - Saved for later hook with API integration
- `app/api/user/wishlist/route.ts` - Wishlist API endpoint
- `app/api/user/saved-later/route.ts` - Saved for later API endpoint

