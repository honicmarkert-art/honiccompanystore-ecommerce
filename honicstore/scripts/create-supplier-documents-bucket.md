# Create Supplier Documents Storage Bucket

This document provides instructions for creating the `supplier-documents` storage bucket in Supabase.

## Quick Setup

**For complete setup with all privacy, restrictions, and security settings, use the SQL script:**

👉 **`scripts/create-supplier-documents-bucket-complete.sql`** - Complete SQL script with all configurations

## Bucket Configuration

1. **Bucket Name**: `supplier-documents`
2. **Visibility**: Private (recommended for security) - files require authentication
3. **File Size Limit**: 10MB (10485760 bytes)
4. **Allowed MIME Types**: 
   - Images: `image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`
   - Documents: `application/pdf`

## Steps to Create Bucket

### Option 1: Complete SQL Script (Recommended)

Run the complete SQL script in Supabase SQL Editor:
```bash
scripts/create-supplier-documents-bucket-complete.sql
```

This script includes:
- ✅ Bucket creation with all settings
- ✅ Privacy and security policies
- ✅ File size and MIME type restrictions
- ✅ User folder isolation (users can only access their own files)
- ✅ Service role access for API operations
- ✅ Performance indexes
- ✅ Cleanup functions

### Option 2: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Enter bucket name: `supplier-documents`
5. Select visibility: **Private** (recommended)
6. Set file size limit: **10MB**
7. Add allowed MIME types:
   - `image/png`
   - `image/jpeg`
   - `image/jpg`
   - `image/gif`
   - `image/webp`
   - `application/pdf`
8. Click **Create bucket**

**Note**: After creating via dashboard, you'll still need to set up the storage policies using the SQL script.

## Storage Policies

The complete SQL script (`create-supplier-documents-bucket-complete.sql`) includes all necessary policies:

### Security Features:

1. **User Isolation**: Users can only access files in their own folder (`{user_id}/`)
2. **File Size Validation**: Enforced at both bucket and policy level (10MB max)
3. **MIME Type Validation**: Only allowed file types can be uploaded
4. **Service Role Access**: Backend API can manage all files (for uploads via service key)
5. **RLS Enabled**: Row Level Security ensures data privacy

### Policy Details:

- ✅ **Upload Policy**: Authenticated users can upload to their own folder only
- ✅ **Read Policy**: Users can only read their own documents
- ✅ **Update Policy**: Users can only update their own documents
- ✅ **Delete Policy**: Users can only delete their own documents
- ✅ **Service Role Policy**: Full access for backend API operations

All policies include:
- Bucket ID validation
- User folder isolation
- File size restrictions
- MIME type validation

## File Structure

Files are stored with the following structure:
```
supplier-documents/
  {user_id}/
    business_tin_certificate_{timestamp}_{random}.{ext}
    company_certificate_{timestamp}_{random}.{ext}
    nida_card_front_{timestamp}_{random}.{ext}
    nida_card_rear_{timestamp}_{random}.{ext}
    self_picture_{timestamp}_{random}.{ext}
```

## Accessing Private Files

Since the bucket is **private**, you'll need to generate signed URLs to access files from the frontend:

```typescript
// Generate signed URL (valid for 1 hour)
const { data } = await supabase.storage
  .from('supplier-documents')
  .createSignedUrl(filePath, 3600) // 3600 seconds = 1 hour

// Or use public URL if bucket is public (not recommended)
const { data } = supabase.storage
  .from('supplier-documents')
  .getPublicUrl(filePath)
```

## Notes

- ✅ The API route (`/api/supplier/document-upload`) uses the service role key, so it can upload files regardless of user policies
- ✅ Files are stored with structure: `supplier-documents/{user_id}/{document_type}_{timestamp}_{random}.{ext}`
- ✅ For private buckets, generate signed URLs when accessing files from the frontend
- ✅ The cleanup function can be called manually or via cron job to remove old/unused documents
- ✅ All policies include validation for file size and MIME types
- ✅ User isolation ensures users can only access their own documents

## Verification

After running the SQL script, verify the setup:

```sql
-- Check bucket configuration
SELECT * FROM storage.buckets WHERE id = 'supplier-documents';

-- Check policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

