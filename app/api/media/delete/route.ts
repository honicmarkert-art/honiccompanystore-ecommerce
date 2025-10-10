import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

type MediaType = 'video' | 'model3d'

function getBucketName(type: MediaType): string {
  switch (type) {
    case 'video':
      return 'product-videos'
    case 'model3d':
      return 'product-models'
    default:
      return 'media'
  }
}

function extractObjectNameFromUrl(publicUrl: string, bucketName: string): string | null {
  try {
    // Public URLs look like: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<object>
    const marker = `/public/${bucketName}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    return publicUrl.substring(idx + marker.length)
  } catch {
    return null
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const productId: number | undefined = body?.productId
    const type: MediaType | undefined = body?.type
    const url: string | undefined = body?.url
    const fileName: string | undefined = body?.fileName

    if (!productId || !type) {
      return NextResponse.json({ error: 'productId and type are required' }, { status: 400 })
    }

    const bucket = getBucketName(type)

    // Resolve object name
    let objectName: string | null = null
    if (fileName && fileName.trim()) {
      objectName = fileName.trim()
    } else if (url && url.trim()) {
      objectName = extractObjectNameFromUrl(url.trim(), bucket)
    }

    if (!objectName) {
      return NextResponse.json({ error: 'Unable to resolve storage object name from url/fileName' }, { status: 400 })
    }

    // Delete from storage
    const { data: removed, error: removeError } = await supabase
      .storage
      .from(bucket)
      .remove([objectName])

    if (removeError) {
      console.error('Storage delete error:', removeError)
      return NextResponse.json({ error: 'Failed to delete from storage' }, { status: 500 })
    }

    // Clear metadata field in products table
    const field = type === 'video' ? 'video' : 'view360'
    const { error: updateError } = await supabase
      .from('products')
      .update({ [field]: null })
      .eq('id', productId)

    if (updateError) {
      console.error('DB update error:', updateError)
      // Still return success for storage deletion, but report DB issue
      return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: false })
    }

    return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: true })
  } catch (error) {
    console.error('Media delete API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



















