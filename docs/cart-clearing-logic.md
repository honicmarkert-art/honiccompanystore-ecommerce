# Cart Clearing Logic - Updated Implementation

## Overview

Updated cart clearing logic to only clear cart after successful payment, with automatic cleanup of failed orders after 1 month.

## Cart Clearing Behavior

### Before Payment
- ❌ **Cart is NOT cleared** when order is placed
- ❌ **Cart is NOT cleared** when payment link is generated
- ✅ **Cart remains intact** until payment is successful

### After Payment Success
- ✅ **Cart is cleared** automatically via webhook
- ✅ **Only affects authenticated users** (database cart)
- ✅ **Guest carts remain in localStorage** (no webhook clearing)

### After Payment Failure
- ❌ **Cart is NOT cleared** immediately
- ✅ **Cart items remain** for user to retry
- ✅ **Automatic cleanup after 1 month** restores items

### After Payment Pending
- ❌ **Cart is NOT cleared** while pending
- ✅ **Cart items remain** until payment resolves

## Implementation Details

### 1. Checkout Flow Changes

**File**: `app/checkout/page.tsx`
```javascript
// OLD: Clear cart immediately after payment link generation
for (const it of selectedItems) {
  await removeItem(it.productId) // ❌ Removed
}

// NEW: Don't clear cart - wait for payment success
// Cart will be cleared by webhook when payment is successful
```

### 2. Webhook Cart Clearing

**File**: `app/api/webhooks/clickpesa/route.ts`
```javascript
// Clear cart for authenticated users after successful payment
if (order.user_id) {
  const { error: clearCartError } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', order.user_id)
}
```

### 3. Failed Order Cleanup

**File**: `supabase/migrations/20250124_create_failed_order_cleanup.sql`

#### Database Function
```sql
CREATE OR REPLACE FUNCTION cleanup_failed_orders()
RETURNS TABLE(cleaned_orders INTEGER, restored_cart_items INTEGER)
-- Cleans failed orders older than 1 month
-- Restores cart items to user's cart using actual cart_items schema
-- Handles UUID id, proper constraints, and conflict resolution
```

#### Cart Items Schema
```sql
-- Actual cart_items table schema
CREATE TABLE public.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id integer NOT NULL,
  variant_id text NULL,
  quantity integer NOT NULL,
  price numeric(10,2) NOT NULL,
  currency character(3) NULL DEFAULT 'USD',
  applied_discount numeric(10,2) NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  -- Constraints and indexes...
);
```

#### Manual Cleanup API
**File**: `app/api/admin/cleanup-failed-orders/route.ts`
- `POST /api/admin/cleanup-failed-orders` - Manual cleanup
- `GET /api/admin/cleanup-failed-orders` - Check failed orders status

#### Scheduled Cleanup API
**File**: `app/api/admin/scheduled-cleanup/route.ts`
- `POST /api/admin/scheduled-cleanup` - Automated cleanup
- `GET /api/admin/scheduled-cleanup` - Health check

## User Experience

### Authenticated Users
1. **Place Order**: Cart remains intact
2. **Payment Success**: Cart automatically cleared via webhook
3. **Payment Failure**: Cart items remain, can retry
4. **Payment Pending**: Cart items remain until resolved
5. **After 1 Month**: Failed orders cleaned, items restored to cart

### Guest Users
1. **Place Order**: localStorage cart remains intact
2. **Payment Success**: No automatic clearing (webhook doesn't affect localStorage)
3. **Payment Failure**: localStorage cart remains
4. **Login After Order**: Cart items remain in localStorage

## Security Considerations

### Admin Access
- Manual cleanup requires admin authentication
- Scheduled cleanup requires bearer token
- All operations logged for audit

### Data Integrity
- Failed order cleanup restores exact quantities
- Handles cart conflicts by adding quantities
- Preserves order history for audit

## Configuration

### Environment Variables
```bash
# For scheduled cleanup security
CLEANUP_SCHEDULED_TOKEN=your-secure-token-here
```

### Database Setup
```bash
# Apply the cleanup migration
supabase db push
# Or manually run:
psql -f supabase/migrations/20250124_create_failed_order_cleanup.sql
```

## Monitoring

### Manual Cleanup
```bash
# Check failed orders status
curl -H "Authorization: Bearer admin-token" \
  GET /api/admin/cleanup-failed-orders

# Trigger manual cleanup
curl -H "Authorization: Bearer admin-token" \
  POST /api/admin/cleanup-failed-orders
```

### Scheduled Cleanup
```bash
# Health check
curl -H "Authorization: Bearer scheduled-token" \
  GET /api/admin/scheduled-cleanup

# Trigger scheduled cleanup
curl -H "Authorization: Bearer scheduled-token" \
  POST /api/admin/scheduled-cleanup
```

## Benefits

### For Users
- ✅ **No lost items** on payment failure
- ✅ **Can retry** failed payments
- ✅ **Automatic restoration** after 1 month
- ✅ **Better user experience**

### For Business
- ✅ **Reduced support** requests for lost cart items
- ✅ **Higher conversion** rates (users can retry)
- ✅ **Automatic cleanup** reduces database bloat
- ✅ **Audit trail** maintained

## Migration Notes

### Breaking Changes
- Cart is no longer cleared immediately after order placement
- Users may see items in cart after failed payments
- Guest users need to manually clear localStorage

### Backward Compatibility
- Existing orders are not affected
- Cart functionality remains the same
- Only timing of clearing has changed

## Testing

### Test Scenarios
1. **Successful Payment**: Verify cart is cleared via webhook
2. **Failed Payment**: Verify cart items remain
3. **Pending Payment**: Verify cart items remain
4. **Manual Cleanup**: Test admin cleanup API
5. **Scheduled Cleanup**: Test automated cleanup

### Verification Queries
```sql
-- Check failed orders older than 1 month
SELECT id, user_id, order_number, payment_status, created_at 
FROM orders 
WHERE payment_status = 'failed' 
  AND created_at < NOW() - INTERVAL '1 month'
  AND user_id IS NOT NULL;

-- Test manual cleanup
SELECT manual_cleanup_failed_orders();

-- Check cart items for a specific user after cleanup
SELECT * FROM cart_items 
WHERE user_id = 'user-uuid-here' 
ORDER BY created_at DESC;

-- Verify cart_items schema constraints
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'cart_items' 
  AND table_schema = 'public';
```

## Summary

The updated cart clearing logic provides:
- ✅ **Payment-success-only clearing** for authenticated users
- ✅ **Preserved cart items** for failed/pending payments
- ✅ **Automatic cleanup** of failed orders after 1 month
- ✅ **Manual cleanup** capabilities for admins
- ✅ **Scheduled cleanup** for automation
- ✅ **Better user experience** with retry capability
- ✅ **Reduced support** burden
- ✅ **Maintained audit trail**

This implementation ensures users don't lose their cart items due to payment failures while maintaining data integrity and providing automatic cleanup mechanisms.
