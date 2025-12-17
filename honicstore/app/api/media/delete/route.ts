import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

if (!supabase) {
  throw new Error('Supabase client not initialized')
}

type MediaType = 'image' | 'video' | 'model3d' | 'gallery' | 'variant'

function getBucketName(type: MediaType, context: string = 'product'): string {
  if (type === 'image' || type === 'gallery' || type === 'variant') {
    switch (context) {
      case 'category':
        return 'category-images'
      case 'variant':
        return 'variant-images'
      case 'product':
      default:
        return 'product-images'
    }
  }
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
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 })
    }
    
    // Support both JSON body and query params
    let body: any = {}
    try { body = await request.json() } catch {}

    const { searchParams } = new URL(request.url)
    // cleaned debug logs
    const productId: number | undefined = (body.productId ?? Number(searchParams.get('productId'))) || undefined
    const type: MediaType | undefined = (body.type ?? (searchParams.get('type') as MediaType)) || 'image'
    const url: string | undefined = (body.url ?? searchParams.get('url')) || undefined
    const fileName: string | undefined = (body.fileName ?? searchParams.get('fileName')) || undefined
    const filesParam: string | undefined = body.files || searchParams.get('files') || undefined
    const context: string = (body.context ?? searchParams.get('context')) || 'product'
    const indexParam = body.index ?? searchParams.get('index')
    const index: number | undefined = indexParam !== undefined && indexParam !== null ? Number(indexParam) : undefined

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }

    const bucket = getBucketName(type, context)
    // cleaned debug logs

    // Resolve one or many object names
    let objectNames: string[] = []
    if (type === 'gallery') {
      // Accept explicit files list or derive from product gallery
      if (filesParam) {
        const parts = filesParam.split(',').map(s => s.trim()).filter(Boolean)
        objectNames = parts.map(p => p.includes('http') ? (extractObjectNameFromUrl(p, bucket) || '') : p).filter(Boolean)
      } else if (productId) {
        // Fetch current gallery from DB
        const { data: prod } = await supabase
          .from('products')
          .select('gallery')
          .eq('id', productId)
          .single()
        const gallery: string[] = Array.isArray(prod?.gallery) ? prod.gallery : []
        objectNames = gallery
          .map((u: string) => extractObjectNameFromUrl(u, bucket) || '')
          .filter(Boolean)
      }
    } else if (type === 'variant') {
      // Treat like single image deletion in storage; DB update handled later
      let single: string | null = null
      if (fileName && fileName.trim()) single = fileName.trim()
      else if (url && url.trim()) single = extractObjectNameFromUrl(url.trim(), bucket)
      if (single) objectNames = [single]
    } else {
      let single: string | null = null
      if (fileName && fileName.trim()) single = fileName.trim()
      else if (url && url.trim()) single = extractObjectNameFromUrl(url.trim(), bucket)
      if (single) objectNames = [single]
    }

    if (!objectNames.length) {
      // cleaned debug logs
      return NextResponse.json({ error: 'No resolvable storage object name(s) found' }, { status: 400 })
    }

    // Delete from storage
    const { data: removed, error: removeError } = await supabase
      .storage
      .from(bucket)
      .remove(objectNames)

    if (removeError) {
      console.error('Storage delete error:', removeError)
      return NextResponse.json({ error: 'Failed to delete from storage' }, { status: 500 })
    }
    // cleaned debug logs

    // Optionally clear DB fields if productId provided
    if (productId) {
      let field: string | null = null
      if (type === 'image') field = 'image'
      else if (type === 'video') field = 'video'
      else if (type === 'model3d') field = 'view360'

      if (field) {
        // cleaned debug logs
        const { error: updateError } = await supabase
          .from('products')
          .update({ [field]: null })
          .eq('id', productId)

        if (updateError) {
          console.error('DB update error:', updateError)
          return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: false })
        }
        // cleaned debug logs
        return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: true })
      } else if (type === 'gallery') {
        // cleaned debug logs
        const { error: galleryUpdateError } = await supabase
          .from('products')
          .update({ gallery: [] })
          .eq('id', productId)
        if (galleryUpdateError) {
          console.error('DB update error (gallery):', galleryUpdateError)
          return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: false })
        }
        // cleaned debug logs
        return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: true })
      } else if (type === 'variant') {
        // Remove one variant image entry from products.variant_images (array)
        const { data: prod2, error: fetchErr } = await supabase
          .from('products')
          .select('variant_images')
          .eq('id', productId)
          .single()
        if (fetchErr) {
          console.error('DB fetch error (variant_images):', fetchErr)
          return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: false })
        }
        const rawImages = Array.isArray(prod2?.variant_images) ? prod2.variant_images : []
        
        // Normalize to handle both string and object formats
        const normalizedImages = rawImages.map((img: any) => {
          if (typeof img === 'string') {
            return { imageUrl: img }
          } else if (img && typeof img === 'object' && img.imageUrl) {
            return { imageUrl: img.imageUrl }
          }
          return { imageUrl: String(img || '') }
        }).filter(img => img.imageUrl)
        
        let newArr = normalizedImages
        if (typeof index === 'number' && !Number.isNaN(index) && index >= 0 && index < normalizedImages.length) {
          newArr = normalizedImages.filter((_, i) => i !== index)
        } else if (objectNames.length) {
          const name = objectNames[0]
          newArr = normalizedImages.filter((img) => {
            const obj = extractObjectNameFromUrl(img.imageUrl, bucket)
            return obj !== name
          })
        }
        const { error: updErr } = await supabase
          .from('products')
          .update({ variant_images: newArr })
          .eq('id', productId)
        if (updErr) {
          console.error('DB update error (variant_images):', updErr)
          return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: false })
        }
        return NextResponse.json({ success: true, storageDeleted: removed, dbUpdated: true })
      }
    }

    // cleaned debug logs
    return NextResponse.json({ success: true, storageDeleted: removed })
  } catch (error) {
    console.error('Media delete API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



















