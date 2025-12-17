# Storage Policies Setup Guide

Due to Supabase permission restrictions, storage policies cannot be created directly via SQL. You must use the Supabase Dashboard.

## Method 1: Supabase Dashboard (Recommended)

### Step 1: Create the Bucket
Run the SQL script first:
```sql
-- Run: scripts/create-supplier-documents-bucket-simple.sql
```

### Step 2: Create Policies via Dashboard

1. Go to **Supabase Dashboard** → **Storage**
2. Click on the **`supplier-documents`** bucket
3. Click on the **"Policies"** tab
4. Click **"New Policy"**

#### Policy 1: Upload Documents
- **Policy Name**: `suppliers_upload_own_documents`
- **Allowed Operation**: `INSERT`
- **Target Roles**: `authenticated`
- **Policy Definition**:
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```
- **WITH CHECK** (same as above):
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```

#### Policy 2: Read Documents
- **Policy Name**: `suppliers_read_own_documents`
- **Allowed Operation**: `SELECT`
- **Target Roles**: `authenticated`
- **Policy Definition**:
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```

#### Policy 3: Update Documents
- **Policy Name**: `suppliers_update_own_documents`
- **Allowed Operation**: `UPDATE`
- **Target Roles**: `authenticated`
- **USING**:
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```
- **WITH CHECK** (same as above):
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```

#### Policy 4: Delete Documents
- **Policy Name**: `suppliers_delete_own_documents`
- **Allowed Operation**: `DELETE`
- **Target Roles**: `authenticated`
- **Policy Definition**:
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```

## Method 2: Try SQL Script (May Not Work)

If you have superuser/owner permissions, you can try:
```sql
-- Run: scripts/create-supplier-documents-policies.sql
```

This script attempts to create policies but will gracefully fail if you don't have permissions.

## What These Policies Do

1. **User Isolation**: Users can only access files in their own folder (`{user_id}/`)
2. **Security**: Prevents users from accessing or modifying other users' documents
3. **Privacy**: All files are private and require authentication

## Verification

After creating policies, verify they exist:

```sql
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%supplier%';
```

You should see 4 policies listed.

## Troubleshooting

### Error: "must be owner of table objects"
- **Solution**: Use the Dashboard method (Method 1) instead of SQL

### Policies not working
- Check that RLS is enabled on `storage.objects`
- Verify the bucket ID matches exactly: `'supplier-documents'`
- Ensure users are authenticated when accessing files

### Service Role Access
- The backend API uses the service role key, which bypasses RLS
- No additional policy is needed for service role access



