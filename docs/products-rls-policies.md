# Products and Variants Row Level Security (RLS) Policies

## Overview

This document describes the Row Level Security (RLS) policies implemented for the `products` and `product_variants` tables, emphasizing read-only access for regular users and full read/write access for admin users.

## Security Model

### Read Operations (SELECT)
- **Who**: All users (authenticated and anonymous)
- **Access**: Public read-only access
- **Purpose**: Enable product browsing for everyone
- **Enforced By**: RLS policy with `USING (true)`

### Write Operations (INSERT, UPDATE, DELETE)
- **Who**: Admin users only (`role = 'admin'` or `role = 'super_admin'`)
- **Access**: Full read/write access
- **Purpose**: Only administrators can modify product data
- **Enforced By**: RLS policy checking user role from `auth.users` table

## Database Policies

### Products Table

#### Policy: `products_select_all_users`
- **Operation**: SELECT
- **Access**: Public (everyone)
- **Logic**: `USING (true)` - allows all users to read products

#### Policy: `products_insert_admin_only`
- **Operation**: INSERT
- **Access**: Admin only
- **Logic**: Checks if user has admin role in `auth.users.raw_user_meta_data`

#### Policy: `products_update_admin_only`
- **Operation**: UPDATE
- **Access**: Admin only
- **Logic**: Checks if user has admin role before allowing updates

#### Policy: `products_delete_admin_only`
- **Operation**: DELETE
- **Access**: Admin only
- **Logic**: Checks if user has admin role before allowing deletes

### Product Variants Table

#### Policy: `product_variants_select_all_users`
- **Operation**: SELECT
- **Access**: Public (everyone)
- **Logic**: `USING (true)` - allows all users to read variants

#### Policy: `product_variants_insert_admin_only`
- **Operation**: INSERT
- **Access**: Admin only
- **Logic**: Checks if user has admin role before allowing inserts

#### Policy: `product_variants_update_admin_only`
- **Operation**: UPDATE
- **Access**: Admin only
- **Logic**: Checks if user has admin role before allowing updates

#### Policy: `product_variants_delete_admin_only`
- **Operation**: DELETE
- **Access**: Admin only
- **Logic**: Checks if user has admin role before allowing deletes

## Implementation Details

### Role Checking

The policies check user roles using this query pattern:

```sql
EXISTS (
  SELECT 1 FROM auth.users
  WHERE auth.users.id = auth.uid()
  AND (
    auth.users.raw_user_meta_data->>'role' = 'admin'
    OR auth.users.raw_user_meta_data->>'role' = 'super_admin'
  )
)
```

This ensures that:
1. The user is authenticated (`auth.uid()` returns a valid user ID)
2. The user's role metadata contains 'admin' or 'super_admin'

### API Layer Security

The RLS policies work in conjunction with API-layer security:

#### Public Client (Anon Key)
- Used for: GET requests to products and variants
- Access: Public read-only
- Example: `/api/products`, `/api/products/[id]`

#### Admin Client (Service Role Key)
- Used for: POST/PUT/DELETE requests
- Access: Bypasses RLS (server-side only)
- Example: `/api/products` (PUT/DELETE), `/api/admin/products`

### Service Role Bypass

The service role key bypasses RLS policies. This is intentional and should only be used:
- In secure server-side contexts
- With proper authentication checks in the API layer
- For administrative operations

## Security Benefits

1. **Principle of Least Privilege**
   - Regular users can only read data
   - Admins can perform all operations
   - Database enforces access at the row level

2. **Defense in Depth**
   - Security enforced at database level (RLS)
   - Security also enforced at API level (authentication)
   - Two layers prevent unauthorized access

3. **Data Integrity**
   - Prevents unauthorized modifications
   - Protects against SQL injection attempts
   - Ensures only admins can change product data

4. **Public Product Browsing**
   - Allows anonymous users to browse products
   - No authentication required for product viewing
   - Improves user experience and SEO

## Usage Examples

### Regular User (Public Access)
```sql
-- ✅ Allowed: Regular user can read products
SELECT * FROM products WHERE id = 1;

-- ❌ Denied: Regular user cannot insert products
INSERT INTO products (name, price) VALUES ('New Product', 100);
-- Error: new row violates row-level security policy "products_insert_admin_only"
```

### Admin User (Full Access)
```sql
-- ✅ Allowed: Admin can read products
SELECT * FROM products WHERE id = 1;

-- ✅ Allowed: Admin can insert products
INSERT INTO products (name, price) VALUES ('New Product', 100);

-- ✅ Allowed: Admin can update products
UPDATE products SET price = 150 WHERE id = 1;

-- ✅ Allowed: Admin can delete products
DELETE FROM products WHERE id = 1;
```

## Migration

To apply these policies, run:

```bash
# Apply the migration
psql -h your-host -U your-user -d your-database -f supabase/migrations/20250124_add_products_rls_policies.sql
```

Or via Supabase CLI:

```bash
supabase db push
```

## Verification

To verify the policies are working:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'product_variants');

-- List all policies on products table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'products';

-- List all policies on product_variants table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'product_variants';
```

## Best Practices

1. **Always use parameterized queries** - Prevents SQL injection
2. **Verify admin status at API level** - Don't rely solely on RLS
3. **Use service role key carefully** - Only for server-side operations
4. **Test policies regularly** - Ensure they work as expected
5. **Monitor access patterns** - Watch for unauthorized access attempts

## Troubleshooting

### Issue: "new row violates row-level security policy"
- **Cause**: User doesn't have admin role
- **Solution**: Check user's role in `auth.users.raw_user_meta_data`

### Issue: "permission denied for relation products"
- **Cause**: RLS is enabled but no policy matches the operation
- **Solution**: Verify the correct policy exists for the operation

### Issue: "column auth.uid() does not exist"
- **Cause**: Using wrong database context
- **Solution**: Ensure you're using Supabase's auth schema functions

## Related Documentation

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Policies](https://supabase.com/docs/guides/auth/row-level-security/policies)
- [API Security Best Practices](./security-audit-report.md)
- [Order Security Model](./complete-orders-security-model.md)

## Summary

These RLS policies provide:
- ✅ **Read-only access** for all users (public product browsing)
- ✅ **Full access** for admin users only
- ✅ **Database-level security** enforced automatically
- ✅ **Protection against unauthorized modifications**
- ✅ **No performance impact** on read operations

The policies work seamlessly with the existing API layer to provide defense-in-depth security for products and variants data.
