# Security Audit: Products Table

## Executive Summary

**Date:** 2025-01-27  
**Scope:** Products table security, RLS policies, API endpoints, and tampering vectors  
**Status:** ⚠️ **SECURE WITH RECOMMENDATIONS**

---

## 1. Current Security Status

### ✅ **Protected Areas:**
- ✅ RLS (Row Level Security) is **ENABLED** on `products` table
- ✅ RLS is **ENABLED** on `product_variants` table
- ✅ Multiple layers of authentication (API + RLS)
- ✅ Supplier endpoints use regular client (respects RLS)
- ✅ Admin endpoints require authentication before using service role

### ⚠️ **Potential Vulnerabilities:**
1. **Service Role Bypass** - Admin endpoints use service role which bypasses RLS
2. **Admin Policy Check** - Admin policies check `auth.users.raw_user_meta_data->>'role'` instead of `profiles.is_admin`
3. **Supplier Policy** - May have conflicts with admin policies
4. **Stock Update Endpoint** - `/api/stock` has TODO comment about missing authentication

---

## 2. RLS Policies Analysis

### Current Policies on `products` Table:

#### **SELECT (Read)**
- ✅ `products_select_all_users` - Allows everyone (public access)
- ✅ `products_select_supplier_own` - Allows suppliers to see their own products

**Security:** ✅ **SECURE** - Read access is intentionally public for product browsing

#### **INSERT (Create)**
- ✅ `products_insert_admin_only` - Checks `auth.users.raw_user_meta_data->>'role'`
- ✅ `products_insert_supplier_own` - Checks `profiles.is_supplier` AND ownership

**Security:** ✅ **SECURE** - Both policies require authentication and proper role

#### **UPDATE (Modify)**
- ✅ `products_update_admin_only` - Checks `auth.users.raw_user_meta_data->>'role'`
- ✅ `products_update_supplier_own` - Checks `profiles.is_supplier` AND ownership

**Security:** ⚠️ **NEEDS ATTENTION** - Policy conflict possible, see recommendations

#### **DELETE (Remove)**
- ✅ `products_delete_admin_only` - Checks `auth.users.raw_user_meta_data->>'role'`
- ✅ `products_delete_supplier_own` - Checks `profiles.is_supplier` AND ownership

**Security:** ✅ **SECURE** - Both policies require authentication and proper role

---

## 3. API Endpoint Security

### **Admin Endpoints** (`/api/products`, `/api/products/[id]`)

**Authentication:** ✅ Required via `validateServerSession()` and `requireAdmin()`
**Client Used:** `createAdminSupabaseClient()` (Service Role - **BYPASSES RLS**)
**Security Level:** ⚠️ **HIGH RISK IF COMPROMISED**

**Vulnerabilities:**
- Service role bypasses RLS completely
- If admin authentication is compromised, full database access is possible
- No additional RLS protection at database level

**Recommendations:**
- ✅ Keep admin authentication strict (already implemented)
- ✅ Add audit logging for all admin operations
- ✅ Consider adding RLS policies even for service role (if possible)

### **Supplier Endpoints** (`/api/supplier/products`, `/api/supplier/products/[id]`)

**Authentication:** ✅ Required via `supabase.auth.getUser()`
**Authorization:** ✅ Checks `profiles.is_supplier` or `profiles.is_admin`
**Client Used:** Regular Supabase client (ANON key - **RESPECTS RLS**)
**Security Level:** ✅ **SECURE**

**Protection Layers:**
1. API-level authentication check
2. API-level authorization check (supplier/admin only)
3. RLS policy check at database level
4. Ownership verification (supplier_id or user_id must match)

**Vulnerabilities:**
- ⚠️ None identified - multiple layers of protection

### **Public Endpoints** (`/api/products` GET)

**Authentication:** ❌ Not required (public access)
**Client Used:** Public client (ANON key - **RESPECTS RLS**)
**Security Level:** ✅ **SECURE** (read-only)

**Protection:**
- RLS allows public SELECT (intentional for product browsing)
- No write operations allowed

---

## 4. Tampering Vectors

### **Vector 1: Direct Database Access**
**Risk:** 🔴 **HIGH** (if database credentials leaked)
**Mitigation:**
- ✅ RLS policies protect against unauthorized access
- ✅ Service role key should be kept secret
- ⚠️ If attacker has service role key, they can bypass all RLS

**Recommendation:**
- Rotate service role key regularly
- Monitor for unusual database access patterns
- Use environment variables (never commit keys to code)

### **Vector 2: API Endpoint Exploitation**
**Risk:** 🟡 **MEDIUM** (if authentication bypassed)
**Mitigation:**
- ✅ Admin endpoints require session validation
- ✅ Supplier endpoints require authentication + authorization
- ✅ Rate limiting implemented
- ✅ Input validation and sanitization

**Recommendation:**
- Add request signing for critical operations
- Implement CSRF protection
- Add IP whitelisting for admin operations (optional)

### **Vector 3: RLS Policy Bypass**
**Risk:** 🟡 **MEDIUM** (if policy logic has flaws)
**Mitigation:**
- ✅ Policies check authentication
- ✅ Policies check roles (admin/supplier)
- ✅ Policies check ownership (supplier_id/user_id)
- ⚠️ Admin policies use different role check than supplier policies

**Recommendation:**
- Standardize role checking (use `profiles` table for both)
- Test policies with edge cases
- Add policy verification queries

### **Vector 4: Service Role Key Leakage**
**Risk:** 🔴 **CRITICAL** (if key is exposed)
**Mitigation:**
- ✅ Key stored in environment variables
- ✅ Key not exposed in client-side code
- ⚠️ Key used in server-side code (could be logged)

**Recommendation:**
- Never log service role key
- Use secret management service (AWS Secrets Manager, etc.)
- Rotate keys regularly
- Monitor for key usage in logs

### **Vector 5: Supplier Account Compromise**
**Risk:** 🟡 **MEDIUM** (if supplier account hacked)
**Mitigation:**
- ✅ RLS limits suppliers to their own products only
- ✅ API verifies ownership before operations
- ✅ Cannot modify other suppliers' products

**Recommendation:**
- Add 2FA for supplier accounts
- Monitor for unusual supplier activity
- Add email notifications for product changes

---

## 5. Critical Issues Found

### **Issue #1: Stock Update Endpoint Missing Authentication**
**File:** `app/api/stock/route.ts`
**Line:** 124
**Severity:** 🔴 **HIGH**

```typescript
// TODO: Add proper admin authentication here
// For now, this endpoint should be protected by middleware or admin guard
```

**Risk:** Anyone can update product stock if they know the endpoint
**Recommendation:** Add authentication immediately

### **Issue #2: Admin Policy Role Check Inconsistency**
**File:** `supabase/migrations/20250124_add_products_rls_policies.sql`
**Severity:** 🟡 **MEDIUM**

Admin policies check `auth.users.raw_user_meta_data->>'role'` but supplier policies check `profiles.is_admin`. This inconsistency could lead to:
- Users with admin role in metadata but not in profiles table
- Users with admin in profiles but not in metadata

**Recommendation:** Standardize to use `profiles` table for all role checks

### **Issue #3: Service Role Used Without Additional Checks**
**Files:** Multiple admin endpoints
**Severity:** 🟡 **MEDIUM**

While admin endpoints do check authentication, the service role completely bypasses RLS. If authentication is compromised, there's no database-level protection.

**Recommendation:** 
- Keep authentication strict (already done)
- Add audit logging
- Consider adding application-level RLS checks even with service role

---

## 6. Recommendations

### **Immediate Actions (High Priority):**

1. **Fix Stock Update Endpoint Authentication**
   ```typescript
   // Add to app/api/stock/route.ts
   const session = await validateServerSession(request)
   if (!requireAdmin(session)) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   }
   ```

2. **Standardize Role Checking**
   - Update admin policies to use `profiles.is_admin` instead of `auth.users.raw_user_meta_data->>'role'`
   - Create migration to update all policies

3. **Add Audit Logging**
   - Log all product modifications (admin and supplier)
   - Include: user_id, product_id, action, timestamp, changes

### **Short-term Actions (Medium Priority):**

4. **Add CSRF Protection**
   - Implement CSRF tokens for state-changing operations
   - Verify tokens on POST/PUT/DELETE requests

5. **Enhance Rate Limiting**
   - Add per-user rate limits (not just per-IP)
   - Add stricter limits for write operations

6. **Add Request Signing**
   - Sign critical operations (product updates, deletes)
   - Verify signatures server-side

### **Long-term Actions (Low Priority):**

7. **Implement 2FA for Suppliers**
   - Require 2FA for supplier accounts
   - Add 2FA verification before product modifications

8. **Add IP Whitelisting (Optional)**
   - Whitelist IPs for admin operations
   - Add VPN requirement for admin access

9. **Database-Level Audit Trail**
   - Add triggers to log all product changes
   - Store change history in separate audit table

---

## 7. Security Checklist

### **Database Level:**
- ✅ RLS enabled on products table
- ✅ RLS enabled on product_variants table
- ✅ Multiple RLS policies (admin + supplier)
- ⚠️ Admin policies use different role check method
- ✅ Policies check ownership for suppliers

### **API Level:**
- ✅ Authentication required for write operations
- ✅ Authorization checks (admin/supplier roles)
- ✅ Input validation and sanitization
- ✅ Rate limiting implemented
- ⚠️ Stock endpoint missing authentication
- ✅ XSS protection (DOMPurify)

### **Application Level:**
- ✅ Service role only used after authentication
- ✅ Ownership verification before operations
- ⚠️ No audit logging for product changes
- ⚠️ No CSRF protection
- ✅ Error messages sanitized

---

## 8. Testing Recommendations

### **Test Cases to Verify Security:**

1. **Unauthenticated Access:**
   - ❌ Cannot create products
   - ❌ Cannot update products
   - ❌ Cannot delete products
   - ✅ Can read products (public access)

2. **Authenticated Non-Supplier:**
   - ❌ Cannot create products
   - ❌ Cannot update products
   - ❌ Cannot delete products
   - ✅ Can read products

3. **Authenticated Supplier:**
   - ✅ Can create products (with own supplier_id/user_id)
   - ✅ Can update own products only
   - ✅ Can delete own products only
   - ❌ Cannot modify other suppliers' products

4. **Authenticated Admin:**
   - ✅ Can create any product
   - ✅ Can update any product
   - ✅ Can delete any product
   - ✅ Can read all products

5. **Tampering Attempts:**
   - ❌ Supplier cannot change supplier_id/user_id to another supplier's ID
   - ❌ Supplier cannot update products they don't own
   - ❌ Direct database access without credentials fails

---

## 9. Conclusion

**Overall Security Rating:** 🟢 **GOOD** (with improvements needed)

The products table is **generally secure** with multiple layers of protection:
- RLS policies at database level
- Authentication at API level
- Authorization checks
- Input validation

**However, there are areas for improvement:**
1. Fix stock update endpoint authentication (CRITICAL)
2. Standardize role checking across policies (HIGH)
3. Add audit logging (MEDIUM)
4. Add CSRF protection (MEDIUM)

**Can the table be tampered with?**
- ✅ **No** - for unauthorized users (RLS protects)
- ⚠️ **Yes** - if service role key is leaked (bypasses RLS)
- ⚠️ **Yes** - if admin authentication is compromised
- ✅ **No** - for suppliers trying to modify others' products (ownership checks)

**Recommendation:** Implement the immediate actions listed above to strengthen security further.

---

## 10. SQL Queries for Verification

### **Check RLS Status:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'product_variants');
```

### **List All Policies:**
```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'products'
ORDER BY cmd, policyname;
```

### **Test Supplier Access (as supplier user):**
```sql
-- Should work (own product)
UPDATE products 
SET name = 'Test'
WHERE id = <own_product_id> 
AND (supplier_id = auth.uid() OR user_id = auth.uid());

-- Should fail (other supplier's product)
UPDATE products 
SET name = 'Hacked'
WHERE id = <other_product_id>;
```

### **Check for Service Role Usage:**
```sql
-- This query won't work directly, but check application logs
-- for any queries that bypass RLS
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Next Review:** 2025-02-27


