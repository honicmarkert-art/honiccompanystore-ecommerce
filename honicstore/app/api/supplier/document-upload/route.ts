import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Document types
export type DocumentType = 
  | 'business_tin_certificate' 
  | 'company_certificate' 
  | 'nida_card_front' 
  | 'nida_card_rear' 
  | 'self_picture'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/document-upload',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    // Create Supabase client with proper cookie handling for auth
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier) {
      return NextResponse.json(
        { error: 'Only suppliers can upload documents' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as DocumentType

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type is required' },
        { status: 400 }
      )
    }

    // Validate document type
    const validDocumentTypes: DocumentType[] = [
      'business_tin_certificate',
      'company_certificate',
      'nida_card_front',
      'nida_card_rear',
      'self_picture'
    ]

    if (!validDocumentTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      )
    }

    // Validate file type - allow images and PDFs
    const allowedTypes = [
      'image/png', 
      'image/jpeg', 
      'image/jpg', 
      'image/gif', 
      'image/webp',
      'application/pdf'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images (PNG, JPG, GIF, WebP) and PDF files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max for documents)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Create admin client for storage operations
    const adminSupabase = supabaseUrl && supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey) 
      : null

    if (!adminSupabase) {
      return NextResponse.json(
        { error: 'Storage service not configured' },
        { status: 500 }
      )
    }

    // Create a unique filename (without bucket name - bucket is specified in .from())
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const fileName = `${user.id}/${documentType}_${timestamp}_${randomString}.${fileExt}`

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)

    const { data, error } = await adminSupabase.storage
      .from('supplier-documents')
      .upload(fileName, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (error) {
      // Check if it's a bucket not found error
      if (error.message && error.message.includes('Bucket not found')) {
        return NextResponse.json(
          { 
            error: 'Storage bucket "supplier-documents" not found. Please create it in Supabase Dashboard: Storage → New bucket → Name: "supplier-documents" (private, 10MB limit)',
            details: error.message 
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to upload file to storage', details: error.message },
        { status: 500 }
      )
    }

    // Get the public URL (or signed URL for private bucket)
    // For private buckets, generate signed URLs that expire after 1 hour
    let fileUrl: string
    
    try {
      // Try to get signed URL first (for private buckets)
      const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
        .from('supplier-documents')
        .createSignedUrl(fileName, 3600) // 1 hour expiry
      
      if (!signedUrlError && signedUrlData?.signedUrl) {
        fileUrl = signedUrlData.signedUrl
      } else {
        // Fallback to public URL if signed URL fails (bucket might be public)
        const { data: urlData } = adminSupabase.storage
          .from('supplier-documents')
          .getPublicUrl(fileName)
        fileUrl = urlData.publicUrl
      }
    } catch (urlError) {
      // Fallback to public URL on error
      const { data: urlData } = adminSupabase.storage
        .from('supplier-documents')
        .getPublicUrl(fileName)
      fileUrl = urlData.publicUrl
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: fileName,
      documentType: documentType
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

