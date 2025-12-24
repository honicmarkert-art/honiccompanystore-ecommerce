# Specification Images Storage Policies Setup

Due to Supabase permission restrictions, storage policies cannot be created directly via SQL. You must use the Supabase Dashboard.

## Step 1: Create the Bucket (Already Done)

The bucket has been created via the migration script. Verify it exists:
- Go to **Supabase Dashboard** → **Storage**
- You should see `specification-images` bucket

## Step 2: Create Storage Policies via Dashboard

1. Go to **Supabase Dashboard** → **Storage**
2. Click on the **`specification-images`** bucket
3. Click on the **"Policies"** tab
4. Click **"New Policy"**

### Policy 1: Upload Specification Images (INSERT)

- **Policy Name**: `suppliers_upload_specification_images`
- **Allowed Operation**: `INSERT`
- **Target Roles**: `authenticated`
- **Policy Definition (USING)**:
  ```sql
  bucket_id = 'specification-images'
  ```
- **WITH CHECK**:
  ```sql
  bucket_id = 'specification-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  ```

### Policy 2: Read Specification Images (SELECT)

- **Policy Name**: `suppliers_read_specification_images`
- **Allowed Operation**: `SELECT`
- **Target Roles**: `authenticated`
- **Policy Definition (USING)**:
  ```sql
  bucket_id = 'specification-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  ```

### Policy 3: Update Specification Images (UPDATE)

- **Policy Name**: `suppliers_update_specification_images`
- **Allowed Operation**: `UPDATE`
- **Target Roles**: `authenticated`
- **USING**:
  ```sql
  bucket_id = 'specification-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  ```
- **WITH CHECK**:
  ```sql
  bucket_id = 'specification-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  ```

### Policy 4: Delete Specification Images (DELETE)

- **Policy Name**: `suppliers_delete_specification_images`
- **Allowed Operation**: `DELETE`
- **Target Roles**: `authenticated`
- **Policy Definition (USING)**:
  ```sql
  bucket_id = 'specification-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  ```

### Policy 5: Service Role Full Access (ALL)

- **Policy Name**: `service_role_full_access_specification_images`
- **Allowed Operation**: `ALL`
- **Target Roles**: `service_role`
- **USING**:
  ```sql
  bucket_id = 'specification-images'
  ```
- **WITH CHECK**:
  ```sql
  bucket_id = 'specification-images'
  ```

### Policy 6: Public Read Access (SELECT)

- **Policy Name**: `public_read_specification_images`
- **Allowed Operation**: `SELECT`
- **Target Roles**: `public`
- **Policy Definition (USING)**:
  ```sql
  bucket_id = 'specification-images'
  ```

## What These Policies Do

1. **User Isolation**: Authenticated users can only access files in their own folder (`{user_id}/`)
2. **Security**: Prevents users from accessing or modifying other users' images
3. **Public Access**: Since the bucket is public, anyone can read specification images
4. **Service Role Access**: Backend API (using service role key) can manage all files

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
  AND policyname LIKE '%specification%';
```

You should see 6 policies listed.

## Troubleshooting

### Error: "must be owner of table objects"
- **Solution**: Use the Dashboard method (Step 2) instead of SQL

### Policies not working
- Check that RLS is enabled on `storage.objects`
- Verify the bucket ID matches exactly: `'specification-images'`
- Ensure users are authenticated when accessing files

### Service Role Access
- The backend API uses the service role key, which bypasses RLS
- Policy 5 ensures service role has full access

