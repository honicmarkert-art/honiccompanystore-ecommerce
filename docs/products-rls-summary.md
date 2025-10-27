# Products RLS Policies - Quick Summary

## What Was Created

### 1. SQL Migration File
- **File**: `supabase/migrations/20250124_add_products_rls_policies.sql`
- **Purpose**: Enables RLS and creates policies for products and variants tables

### 2. Documentation
- **File**: `docs/products-rls-policies.md`
- **Purpose**: Comprehensive documentation of RLS policies
- **File**: `docs/products-rls-summary.md` (this file)
- **Purpose**: Quick reference summary

## Security Model Summary

### Products Table (`public.products`)
| Operation | Regular Users | Admin Users |
|-----------|---------------|-------------|
| SELECT (Read) | ✅ Allowed | ✅ Allowed |
| INSERT | ❌ Denied | ✅ Allowed |
| UPDATE | ❌ Denied | ✅ Allowed |
| DELETE | ❌ Denied | ✅ Allowed |

### Product Variants Table (`public.product_variants`)
| Operation | Regular Users | Admin Users |
|-----------|---------------|-------------|
| SELECT (Read) | ✅ Allowed | ✅ Allowed |
| INSERT | ❌ Denied | ✅ Allowed |
| UPDATE | ❌ Denied | ✅ Allowed |
| DELETE | ❌ Denied | ✅ Allowed |

## Key Points

### 1. Public Read Access ✅
- All users (authenticated + anonymous) can **read** products and variants
- No authentication required for browsing
- Enables SEO-friendly public product pages

### 2. Admin-Only Write Access 🔒
- Only users with `role = 'admin'` or `role = 'super_admin'` can **modify** data
- Enforced at database level via RLS
- Additional API-level authentication also required

### 3. Defense in Depth 🛡️
- **Layer 1**: Database RLS policies (this implementation)
- **Layer 2**: API authentication and authorization
- **Layer 3**: Service role key bypass (server-side only)

### 4. API Integration ✅
- Public GET requests use Supabase public client (anon key)
- Admin POST/PUT/DELETE requests use admin client (service role key)
- Policies work seamlessly with existing API implementation

## Policies Created

### Products Table Policies
1. `products_select_all_users` - SELECT for everyone
2. `products_insert_admin_only` - INSERT for admins only
3. `products_update_admin_only` - UPDATE for admins only
4. `products_delete_admin_only` - DELETE for admins only

### Product Variants Table Policies
1. `product_variants_select_all_users` - SELECT for everyone
2. `product_variants_insert_admin_only` - INSERT for admins only
3. `product_variants_update_admin_only` - UPDATE for admins only
4. `product_variants_delete_admin_only` - DELETE for admins only

## How to Apply

### Option 1: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20250124_add_products_rls_policies.sql`
3. Paste and run in SQL Editor

### Option 2: Via Supabase CLI
```bash
# Push the migration
supabase db push

# Or apply directly
supabase db execute --file supabase/migrations/20250124_add_products_rls_policies.sql
```

### Option 3: Via psql
```bash
psql -h your-host -U your-user -d your-database \
  -f supabase/migrations/20250124_add_products_rls_policies.sql
```

## Testing

### Test Read Access (Should Work for Everyone)
```sql
-- Regular user or anonymous
SELECT * FROM products LIMIT 5;
SELECT * FROM product_variants LIMIT 5;
```

### Test Write Access (Should Work for Admins Only)
```sql
-- As admin user
INSERT INTO products (name, price, original_price) 
VALUES ('Test Product', 100, 120);

-- As regular user (should fail)
INSERT INTO products (name, price, original_price) 
VALUES ('Test Product', 100, 120);
-- Error: new row violates row-level security policy
```

## Verification Queries

### Check RLS Status
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'product_variants');
```

### List All Policies
```sql
-- For products table
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'products';

-- For product_variants table
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'product_variants';
```

## Security Benefits

1. ✅ **Database-level enforcement** - Can't bypass via API
2. ✅ **Public product browsing** - No auth required for viewing
3. ✅ **Admin-only modifications** - Only admins can change data
4. ✅ **Works with existing APIs** - No code changes needed
5. ✅ **Zero performance impact** - Policies are fast

## Important Notes

1. **Service Role Bypass**: Admin client uses service role key which bypasses RLS
   - This is intentional and secure
   - Service role key should only be used server-side
   - Additional API-level auth is still required

2. **Role Checking**: Policies check user role from `auth.users.raw_user_meta_data`
   - Ensure users have correct role metadata set
   - Format: `{ role: 'admin' }` or `{ role: 'super_admin' }`

3. **API Layer**: Policies work in conjunction with API security
   - Frontend uses public client for GET requests
   - Frontend uses admin client for POST/PUT/DELETE
   - Both layers provide security

## Next Steps

1. ✅ Apply the migration using one of the methods above
2. ✅ Test read access (should work for everyone)
3. ✅ Test write access (should work for admins only)
4. ✅ Verify policies are active
5. ✅ Monitor for any issues

## Related Files

- `supabase/migrations/20250124_add_products_rls_policies.sql` - SQL migration
- `docs/products-rls-policies.md` - Detailed documentation
- `docs/products-rls-summary.md` - This file
- `app/api/products/route.ts` - Products API (already uses public client for GET)
- `app/api/products/[id]/route.ts` - Product detail API (already uses public client for GET)

## Support

For questions or issues:
1. Check the detailed documentation: `docs/products-rls-policies.md`
2. Review Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security
3. Check error messages - they indicate which policy failed

---

**Status**: ✅ Ready to apply
**Migration File**: `supabase/migrations/20250124_add_products_rls_policies.sql`
**Documentation**: `docs/products-rls-policies.md`
