import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null as any

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Create client with user's access token for getUser() validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Critical action: validate session with getUser()
    const { data: user, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user?.user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Fetch user's addresses
    const { data: addresses, error: addressesError } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false })

    if (addressesError) {
      console.error('Failed to fetch addresses:', addressesError)
      return NextResponse.json(
        { error: 'Failed to fetch addresses' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      addresses: addresses || [],
    })

  } catch (error) {
    console.error('Addresses fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Create client with user's access token for getUser() validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Critical action: validate session with getUser()
    const { data: user, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user?.user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Parse request body
    const addressData = await request.json()
    
    // Validate required address data
    if (!addressData.type || !addressData.fullName || !addressData.address) {
      return NextResponse.json(
        { error: 'Missing required address fields' },
        { status: 400 }
      )
    }

    // Create new address
    const { data: address, error: addressError } = await supabase
      .from('user_addresses')
      .insert({
        user_id: user.user.id,
        type: addressData.type, // 'shipping' or 'billing'
        full_name: addressData.fullName,
        address: addressData.address,
        city: addressData.city,
        postal_code: addressData.postalCode,
        country: addressData.country,
        phone: addressData.phone,
        email: addressData.email,
        is_default: addressData.isDefault || false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (addressError) {
      console.error('Failed to create address:', addressError)
      return NextResponse.json(
        { error: 'Failed to create address' },
        { status: 500 }
      )
    }

    // If this is set as default, unset other default addresses of the same type
    if (addressData.isDefault) {
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', user.user.id)
        .eq('type', addressData.type)
        .neq('id', address.id)
    }

    return NextResponse.json({
      success: true,
      address,
    })

  } catch (error) {
    console.error('Address creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Create client with user's access token for getUser() validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Critical action: validate session with getUser()
    const { data: user, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user?.user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Parse request body
    const { addressId, ...addressData } = await request.json()
    
    if (!addressId) {
      return NextResponse.json(
        { error: 'Address ID is required' },
        { status: 400 }
      )
    }

    // Update address (ensure it belongs to the user)
    const { data: address, error: addressError } = await supabase
      .from('user_addresses')
      .update({
        ...addressData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', addressId)
      .eq('user_id', user.user.id)
      .select()
      .single()

    if (addressError) {
      console.error('Failed to update address:', addressError)
      return NextResponse.json(
        { error: 'Failed to update address' },
        { status: 500 }
      )
    }

    // If this is set as default, unset other default addresses of the same type
    if (addressData.isDefault) {
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', user.user.id)
        .eq('type', addressData.type)
        .neq('id', addressId)
    }

    return NextResponse.json({
      success: true,
      address,
    })

  } catch (error) {
    console.error('Address update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Create client with user's access token for getUser() validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Critical action: validate session with getUser()
    const { data: user, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user?.user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Get address ID from query params
    const { searchParams } = new URL(request.url)
    const addressId = searchParams.get('id')
    
    if (!addressId) {
      return NextResponse.json(
        { error: 'Address ID is required' },
        { status: 400 }
      )
    }

    // Delete address (ensure it belongs to the user)
    const { error: deleteError } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.user.id)

    if (deleteError) {
      console.error('Failed to delete address:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete address' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
    })

  } catch (error) {
    console.error('Address deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}










