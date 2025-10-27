# Orders Access Control Summary

## Access Control Matrix

| User Type | Can Read | Can Create | Can Update | Can Delete |
|-----------|----------|------------|------------|------------|
| **Regular User** | ✅ Their own orders | ✅ Their own orders | ⚠️ Only pending/failed orders (notes only) | ❌ No |
| **Admin User** | ✅ All orders | ✅ All orders | ✅ All orders | ✅ All orders |
| **System/Webhook** | ✅ Guest orders only | ✅ All orders | ✅ Payment fields | ⚠️ Failed guest orders only |
| **Guest User** | ❌ No (no auth) | ❌ Via system only | ❌ No | ❌ No |

## What Regular Users Can Do

### ✅ **READ** - Their Own Orders
```sql
-- Users can read their own orders
WHERE auth.uid() = user_id AND user_id IS NOT NULL
```

### ✅ **CREATE** - Their Own Orders
```sql
-- Users can create orders with their user_id
WHERE user_id IS NULL OR user_id = auth.uid()
```

### ⚠️ **UPDATE** - Limited Fields Only
```sql
-- Users can ONLY update notes on pending/failed orders
WHERE auth.uid() = user_id 
  AND user_id IS NOT NULL
  AND status IN ('pending', 'failed')
-- Only 'notes' field can be updated
```

### ❌ **DELETE** - Not Allowed
Regular users **cannot** delete any orders.

## What Admins Can Do

### ✅ **READ** - All Orders
```sql
-- Admins can read any order
EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() 
  AND (profiles.role = 'admin' OR profiles.is_admin = true)
)
```

### ✅ **UPDATE** - All Orders
```sql
-- Admins can update any field of any order
EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() 
  AND (profiles.role = 'admin' OR profiles.is_admin = true)
)
```

### ✅ **DELETE** - Failed Guest Orders
```sql
-- Admins can delete any order
-- System can delete failed guest orders (after 1 month)
```

## Important Limitations

### For Regular Users:

1. **Cannot read other users' orders**
   - RLS enforces: `auth.uid() = user_id`

2. **Cannot update order status**
   - Only admins can change status

3. **Cannot modify payment information**
   - Payment fields are webhook/admin-only

4. **Cannot delete orders**
   - Only admins can delete orders

5. **Can only update notes**
   - On pending or failed orders only

### For Admins:

1. **Can read all orders**
   - No restrictions

2. **Can update all fields**
   - Full control over order data

3. **Can delete any order**
   - Use with caution!

## Security Notes

### RLS Enforcements:

1. **Row Level Security (RLS) is enabled** on orders table
2. **Policies check** `auth.uid()` for user authentication
3. **Admin checks** use `public.profiles` (not `auth.users`)
4. **Immutable fields**: `reference_id`, `pickup_id`, `order_number`
5. **Audit logging** records all changes

### Data Protection:

- Users see only their own orders
- Admin users see all orders for management
- System/webhooks can update payment status
- Failed orders can be cleaned up after 1 month

## Summary

✅ **Regular users can only read their own orders** - This is by design for security and privacy.

✅ **They cannot update order status** - Only admins can change status.

✅ **They cannot delete orders** - Only admins can delete orders.

✅ **They cannot read other users' orders** - RLS enforces this.
