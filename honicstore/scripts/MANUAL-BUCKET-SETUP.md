# Manual Bucket Setup - Step by Step

## Step 1: Create Bucket via Dashboard

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"** button
3. Fill in the following:

### Bucket Configuration

- **Bucket Name**: `supplier-documents`
- **Public bucket**: ❌ **Unchecked** (Private - requires authentication)
- **File size limit**: `10485760` (10MB in bytes)

### Allowed MIME Types

Copy and paste these MIME types (one per line or comma-separated):

```
image/png
image/jpeg
image/jpg
image/gif
image/webp
application/pdf
```

**Or as comma-separated:**
```
image/png, image/jpeg, image/jpg, image/gif, image/webp, application/pdf
```

4. Click **"Create bucket"**

---

## Step 2: Create Storage Policies

After creating the bucket, go to the **"Policies"** tab and create these 4 policies:

### Policy 1: Upload Documents (INSERT)

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

### Policy 2: Read Documents (SELECT)

- **Policy Name**: `suppliers_read_own_documents`
- **Allowed Operation**: `SELECT`
- **Target Roles**: `authenticated`
- **Policy Definition**:
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```

### Policy 3: Update Documents (UPDATE)

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

### Policy 4: Delete Documents (DELETE)

- **Policy Name**: `suppliers_delete_own_documents`
- **Allowed Operation**: `DELETE`
- **Target Roles**: `authenticated`
- **Policy Definition**:
  ```sql
  (bucket_id = 'supplier-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```

---

## Quick Copy-Paste MIME Types

For the bucket configuration, use these MIME types:

**Option 1: One per line (if Dashboard accepts line breaks)**
```
image/png
image/jpeg
image/jpg
image/gif
image/webp
application/pdf
```

**Option 2: Comma-separated (if Dashboard requires single line)**
```
image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf
```

**Option 3: Space-separated (if Dashboard requires this format)**
```
image/png image/jpeg image/jpg image/gif image/webp application/pdf
```

---

## Summary

- ✅ Bucket Name: `supplier-documents`
- ✅ Private: Yes (unchecked public)
- ✅ File Size Limit: `10485760` bytes (10MB)
- ✅ MIME Types: 6 types (images + PDF)
- ✅ Policies: 4 policies (upload, read, update, delete)


