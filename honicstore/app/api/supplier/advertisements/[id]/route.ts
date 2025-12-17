import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// DELETE - Delete supplier's advertisement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adId = params.id

    // Verify supplier owns this advertisement
    const { data: ad, error: adError } = await supabase
      .from('advertisements')
      .select('supplier_id, media_url')
      .eq('id', adId)
      .single()

    if (adError || !ad) {
      return NextResponse.json(
        { success: false, error: 'Advertisement not found' },
        { status: 404 }
      )
    }

    if (ad.supplier_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only delete your own advertisements.' },
        { status: 403 }
      )
    }

    // Use service role key for storage operations
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Delete media file from storage
    if (ad.media_url) {
      const urlParts = ad.media_url.split('/advertisements/')
      if (urlParts.length > 1) {
        const filePath = `advertisements/${urlParts[1]}`
        await supabaseService.storage
          .from('advertisements')
          .remove([filePath])
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseService
      .from('advertisements')
      .delete()
      .eq('id', adId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete advertisement' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement deleted successfully'
    })

  } catch (error: any) {
    console.error('Supplier advertisement DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}




