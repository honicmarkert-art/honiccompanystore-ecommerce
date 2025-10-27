# Badge Count Auto-Update

## Overview

The badge counts in the account layout automatically update immediately after deleting items from wishlist, saved for later, cart, or orders. This is handled by React's state management system.

## How It Works

### 1. **Account Layout** (`app/account/layout.tsx`)

The layout subscribes to all hooks and displays badge counts:

```typescript
const { cartTotalItems } = useCart()
const { items: wishlistItems } = useWishlist()
const { items: savedLaterItems } = useSavedLater()
const { orders } = useOrders()

const wishlistCount = wishlistItems.length
const savedLaterCount = savedLaterItems.length
const ordersCount = orders.length
```

Badges are displayed conditionally:

```typescript
{count > 0 && (
  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-semibold min-w-[20px] h-5 px-1">
    {count}
  </span>
)}
```

### 2. **Hooks Update State Immediately**

All hooks use `setState` which triggers React re-renders:

#### **Wishlist Hook** (`hooks/use-wishlist.ts`)
```typescript
const remove = useCallback(async (productId: number) => {
  const next = items.filter(i => i.productId !== productId)
  setItems(next) // This triggers re-render immediately
  // API call happens in background
}, [items, isAuthenticated, saveLocal])
```

#### **Saved for Later Hook** (`hooks/use-saved-later.ts`)
```typescript
const remove = useCallback(async (productId: number) => {
  const next = items.filter(i => i.productId !== productId)
  setItems(next) // This triggers re-render immediately
  // API call happens in background
}, [items, isAuthenticated, saveLocal])
```

#### **Cart Hook** (`hooks/use-cart.ts`)
```typescript
const removeItem = useCallback(async (productId: number, variantId?: string) => {
  // ...optimistic update logic...
  
  setCart(updatedCart)
  setCartTotalItems(prev => prev - removedQuantity) // Updates immediately
  setCartSubtotal(prev => prev - removedPrice)
  
  // API call happens in background
}, [cart, isAuthenticated])
```

#### **Orders Hook** (`hooks/use-orders.ts`)
Orders are fetched once on mount via `useEffect`. If orders are deleted (shouldn't normally happen from user perspective), you would need to call `fetchOrders()` again, but orders count typically doesn't change after viewing.

### 3. **Optimistic Updates**

All deletion operations use **optimistic updates**:
1. State is updated immediately (before API call)
2. API call happens in the background
3. On error, state is rolled back

This ensures the UI updates instantly without waiting for the server.

### 4. **React Re-render Flow**

1. User clicks delete button
2. `remove()` or `removeItem()` is called
3. `setItems()` or `setCart()` updates state
4. React detects state change
5. Components using those hooks re-render
6. `app/account/layout.tsx` recalculates counts from updated arrays
7. Badge counts update immediately

## Benefits

✅ **Instant Updates**: Badge counts update immediately, no loading state needed
✅ **Optimistic UI**: Feels fast and responsive
✅ **Error Handling**: On API failure, state rolls back and shows error
✅ **Automatic**: No manual refresh needed
✅ **Consistent**: Works for both authenticated and guest users

## Implementation Notes

- All hooks properly use `useCallback` to prevent unnecessary re-renders
- State updates are synchronous and happen before API calls
- The account layout automatically re-renders when any subscribed hook's state changes
- Badge counts are computed from array lengths, which update immediately when items are removed

