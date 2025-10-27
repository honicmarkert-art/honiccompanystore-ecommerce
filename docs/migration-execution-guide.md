# Migration Execution Guide

## Quick Fix for Function Conflict Error

If you're getting the error:
```
ERROR: 42P13: cannot change return type of existing function
HINT: Use DROP FUNCTION upsert_cart_item(uuid,integer,text,integer,numeric,text) first.
```

## Solution

Run the migrations in this **exact order**:

### 1. **First - Drop Existing Functions**
```sql
-- Run this in Supabase SQL Editor
-- File: 20250123_drop_existing_functions.sql
```

### 2. **Then - Create New Functions**
```sql
-- Run these in order:
-- 1. 20250123_create_upsert_cart_item_function.sql
-- 2. 20250123_create_security_functions.sql
-- 3. 20250123_create_rbac_functions.sql
-- 4. 20250123_create_performance_functions.sql
-- 5. 20250123_create_audit_functions.sql
```

## Alternative: Supabase CLI

If using Supabase CLI:

```bash
cd supabase
npx supabase db reset
```

This will run all migrations in the correct order automatically.

## Manual Execution Steps

### Step 1: Drop Functions
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `20250123_drop_existing_functions.sql`
3. Click "Run"

### Step 2: Create Functions
1. Run `20250123_create_upsert_cart_item_function.sql`
2. Run `20250123_create_security_functions.sql`
3. Run `20250123_create_rbac_functions.sql`
4. Run `20250123_create_performance_functions.sql`
5. Run `20250123_create_audit_functions.sql`

## Verification

After running all migrations, verify the functions exist:

```sql
-- Check if upsert_cart_item function exists
SELECT proname, proargnames, proargtypes 
FROM pg_proc 
WHERE proname = 'upsert_cart_item';

-- Check if security functions exist
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'validate_resource_ownership',
  'log_security_event',
  'check_rate_limit',
  'detect_suspicious_pattern'
);
```

## Troubleshooting

### If you still get errors:

1. **Check function signatures**:
   ```sql
   \df upsert_cart_item
   ```

2. **Drop specific function**:
   ```sql
   DROP FUNCTION IF EXISTS upsert_cart_item CASCADE;
   ```

3. **Check for dependencies**:
   ```sql
   SELECT * FROM pg_depend WHERE objid = 'upsert_cart_item'::regproc;
   ```

### If functions are still in use:

1. **Check active connections**:
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

2. **Wait for connections to close** or restart the database

## Success Indicators

✅ **Migration successful when you see:**
- No error messages
- Functions created successfully
- Tables created (security_events, audit_log)
- Permissions granted

❌ **If you see errors:**
- Check the specific error message
- Ensure you're running migrations in order
- Verify database permissions
- Check for conflicting function names

---

*This guide resolves the function conflict error and ensures smooth migration execution.*
