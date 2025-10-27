# Guest Cart Clearing from Local Storage

## Current Implementation

The guest cart is stored in **localStorage** with the key `'guest_cart'` (defined as `CART_STORAGE_KEY` constant).

## How Guest Cart is Cleared

### 1. **Manual Clear** ✅
Users can clear their cart manually via the "Clear Cart" button or function:

```typescript
// Location: hooks/use-cart.ts, line 936
localStorage.removeItem(CART_STORAGE_KEY) // CART_STORAGE_KEY = 'guest_cart'
```

This happens when:
- User clicks "Clear Cart" button
- Cart is cleared programmatically via `clearCart()` function

### 2. **After Successful Login** ✅
When a guest user logs in, their cart is merged with their server cart and then cleared:

```typescript
// Location: hooks/use-cart.ts, line 367
const mergeGuestCart = useCallback(async () => {
  if (!isAuthenticated) return

  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      const guestCart = JSON.parse(stored)
      if (guestCart.items && guestCart.items.length > 0) {
        const response = await fetch('/api/cart/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ guestCart: guestCart.items })
        })

        if (response.ok) {
          // Clear guest cart after successful merge
          localStorage.removeItem(CART_STORAGE_KEY) ✅
          return true
        }
      } else {
        // No items to merge, clear empty guest cart
        localStorage.removeItem(CART_STORAGE_KEY) ✅
        return true
      }
    }
  } catch (error) {
    return false
  }
})
```

### 3. **After Payment Success (Webhook)** ✅
For authenticated users, the cart is cleared in the database by the webhook:

```typescript
// Location: app/api/webhooks/clickpesa/route.ts, lines 372-390
// Clear cart for authenticated users after successful payment
if (order.user_id) {
  try {
    logger.log('🛒 Clearing cart for user after successful payment:', order.user_id)
    
    const { error: clearCartError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', order.user_id)

    if (clearCartError) {
      logger.log('⚠️ Failed to clear cart after payment:', clearCartError)
    } else {
      logger.log('✅ Cart cleared successfully after payment')
    }
  } catch (cartClearError) {
    logger.log('⚠️ Error clearing cart after payment:', cartClearError)
  }
}
```

### 4. **After Guest Checkout Payment Success** ❌ NOT IMPLEMENTED

**Current Issue**: When a guest user completes checkout and payment succeeds, the webhook cannot clear their localStorage cart because:
- The webhook runs server-side and cannot access browser's localStorage
- Guest users don't have a user_id in the database

**Workaround**: The cart will remain in localStorage until manually cleared or the user logs in.

## How to Clear Guest Cart After Payment

### **Option 1: Frontend Clearing (Recommended for Guest)**
Clear localStorage in the checkout return page after successful payment:

```typescript
// In app/checkout/return/page.tsx
useEffect(() => {
  if (finalIsPaymentSuccessful) {
    // Clear guest cart from localStorage
    if (typeof window !== 'undefined' && !isAuthenticated) {
      localStorage.removeItem('guest_cart')
      sessionStorage.removeItem('selected_cart_items')
      sessionStorage.removeItem('buy_now_mode')
      sessionStorage.removeItem('buy_now_item_data')
    }
  }
}, [finalIsPaymentSuccessful, isAuthenticated])
```

### **Option 2: Clear on Order Acknowledgment**
Clear when showing the order success message:

```typescript
// In app/checkout/return/page.tsx
const handleSuccessfulPayment = () => {
  // Clear all guest cart data
  if (!isAuthenticated && typeof window !== 'undefined') {
    localStorage.removeItem('guest_cart')
    sessionStorage.removeItem('selected_cart_items')
    sessionStorage.removeItem('buy_now_mode')
    sessionStorage.removeItem('buy_now_item_data')
  }
  
  // Show success message
  setIsPaymentSuccessful(true)
}
```

## Current Status

### ✅ **Working:**
1. Manual cart clearing
2. Cart clearing after login (merge)
3. Cart clearing for authenticated users after payment (database)

### ✅ **Complete:**
1. Automatic clearing of localStorage for guest users after payment success ✅ IMPLEMENTED

## Recommended Fix ✅ IMPLEMENTED

Added localStorage clearing in the checkout return page when payment is successful and the user is not authenticated:

```typescript
// Location: app/checkout/return/page.tsx, lines 407-421

useEffect(() => {
  if (finalIsPaymentSuccessful && !user && typeof window !== 'undefined') {
    // Clear guest cart data from localStorage
    localStorage.removeItem('guest_cart')
    sessionStorage.removeItem('selected_cart_items')
    sessionStorage.removeItem('buy_now_mode')
    sessionStorage.removeItem('buy_now_item_data')
    
    // Optionally clear the cart hook (this will trigger a re-render)
    if (clearCart) {
      clearCart()
    }
  }
}, [finalIsPaymentSuccessful, user, clearCart])
```

## Summary

| Scenario | Auth User | Guest User |
|----------|-----------|------------|
| **Manual Clear** | ✅ Cleared in DB | ✅ Cleared in localStorage |
| **After Login** | ✅ N/A (already logged in) | ✅ Merged & cleared |
| **After Payment Success** | ✅ Cleared in DB via webhook | ✅ Cleared in localStorage |
| **After Payment Failure** | ✅ Kept in DB | ✅ Kept in localStorage |
| **After Payment Pending** | ✅ Kept in DB | ✅ Kept in localStorage |

## Implementation Status ✅

All guest cart clearing scenarios are now implemented:

1. ✅ Manual clearing via "Clear Cart" button
2. ✅ Automatic clearing after login (merge process)
3. ✅ Automatic clearing after successful payment (checkout return page)
4. ✅ Cart preserved on payment failure/pending
