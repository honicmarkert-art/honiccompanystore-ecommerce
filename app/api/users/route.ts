import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch all users
export async function GET() {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Transform the data to match the expected format
    const transformedUsers = users?.map(user => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login,
      status: user.status || 'active'
    })) || []

    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error('Error reading users:', error)
    return NextResponse.json({ error: 'Failed to read users' }, { status: 500 })
  }
}

// POST - Add new user
export async function POST(request: NextRequest) {
  try {
    const userData = await request.json()
    
    // Transform the data for Supabase
    const supabaseUser = {
      full_name: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      is_admin: userData.isAdmin || false,
      status: userData.status || 'active'
    }

    const { data: user, error } = await supabase
      .from('profiles')
      .insert(supabaseUser)
      .select()
      .single()

    if (error) {
      console.error('Error adding user:', error)
      return NextResponse.json({ error: 'Failed to add user' }, { status: 500 })
    }

    // Transform back to expected format
    const transformedUser = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login,
      status: user.status
    }

    return NextResponse.json(transformedUser, { status: 201 })
  } catch (error) {
    console.error('Error adding user:', error)
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 })
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json()
    
    // Transform the updates for Supabase
    const supabaseUpdates: any = {}
    if (updates.fullName !== undefined) supabaseUpdates.full_name = updates.fullName
    if (updates.email !== undefined) supabaseUpdates.email = updates.email
    if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone
    if (updates.isAdmin !== undefined) supabaseUpdates.is_admin = updates.isAdmin
    if (updates.status !== undefined) supabaseUpdates.status = updates.status

    const { data: user, error } = await supabase
      .from('profiles')
      .update(supabaseUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Transform back to expected format
    const transformedUser = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login,
      status: user.status
    }

    return NextResponse.json(transformedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
} 