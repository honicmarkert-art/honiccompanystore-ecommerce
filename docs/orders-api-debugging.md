# Orders API Debugging Guide

## Debug Logging Added

Added comprehensive debug logging to `/api/user/orders` endpoint to diagnose the "permission denied for table users" error.

### Debug Outputs

1. **User Authentication**
   ```typescript
   console.log('User authenticated:', { id: user.id, email: user.email })
   ```

2. **User ID Details**
   ```typescript
   console.log('User ID type:', typeof user.id)
   console.log('User ID length:', user.id?.length)
   ```

3. **Total Orders Count**
   ```typescript
   const { count: totalOrdersCount } = await supabase
     .from('orders')
     .select('*', { count: 'exact', head: true })
   console.log('Total orders in database:', totalOrdersCount)
   ```

4. **User Orders Count**
   ```typescript
   const { count: userOrdersCount } = await supabase
     .from('orders')
     .select('*', { count: 'exact', head: true })
     .eq('user_id', user.id)
   console.log('Orders for this user:', userOrdersCount)
   ```

5. **Full Orders Query**
   ```typescript
   const { data: orders, error: ordersError } = await supabase
     .from('orders')
     .select(`...`)
     .eq('user_id', user.id)
   console.log('Orders query result:', { ordersCount: orders?.length, error: ordersError })
   ```

6. **Detailed Error Info**
   ```typescript
   if (ordersError) {
     console.error('Full error details:', JSON.stringify(ordersError, null, 2))
   }
   ```

## What to Check in Console

### Expected Output for Working System:
```
User authenticated: { id: 'xxx', email: 'user@example.com' }
User ID type: string
User ID length: 36
Total orders in database: 5
Orders for this user: 2
Attempting to fetch orders with JOIN to order_items...
Orders query result: { ordersCount: 2, error: null }
```

### Error Output (Current Issue):
```
User authenticated: { id: 'xxx', email: 'user@example.com' }
User ID type: string
Total orders in database: 5
Orders for this user: 2
Attempting to fetch orders with JOIN to order_items...
Orders query result: { ordersCount: undefined, error: { code: '42501', message: 'permission denied for table users' } }
```

## What This Tells Us

1. **If total orders count works** → RLS is working for basic queries
2. **If user orders count works** → RLS is working for filtered queries
3. **If full query fails** → RLS is failing on the JOIN to products table

## Likely Issue

The JOIN to the `products` table in `order_items` might be triggering an RLS check on the `products` table that's failing.

## Next Steps

Based on the debug output, we'll know:
1. Where exactly the query is failing
2. Whether it's an RLS issue on `orders`, `order_items`, or `products`
3. Whether it's an issue with the JOIN syntax
