import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// Sanitize input to prevent injection
const sanitizeInput = (input: string | undefined): string => {
  if (!input) return ''
  // Remove any potentially dangerous characters
  return input.trim().replace(/[<>'";]/g, '')
}

// GET /api/admin/categories - Get all categories
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
  
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select(`
        *,
        parent:parent_id(name, slug)
      `)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    return NextResponse.json(categories || [])
  } catch (error) {
    console.error('Error in GET /api/admin/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, slug, image_url, is_active, display_order, parent_id } = body

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name)
    const sanitizedSlug = sanitizeInput(slug)

    // Check if category with same name or slug already exists
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .or(`name.eq.${sanitizedName},slug.eq.${sanitizedSlug}`)
      .single()

    if (existingCategory) {
      return NextResponse.json({ error: 'Category with this name or slug already exists' }, { status: 409 })
    }

    // Insert new category
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name: sanitizedName,
        description,
        slug: sanitizedSlug,
        image_url,
        is_active: is_active ?? true,
        display_order: display_order ?? 0,
        parent_id: parent_id || null
      })
      .select(`
        *,
        parent:parent_id(name, slug)
      `)
      .single()

    if (error) {
      console.error('Error creating category:', error)
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/admin/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, slug, image_url, is_active, display_order, parent_id } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Check if category exists
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('id', id)
      .single()

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if another category with same name or slug exists
    if (name || slug) {
      const sanitizedName = name !== undefined ? sanitizeInput(name) : ''
      const sanitizedSlug = slug !== undefined ? sanitizeInput(slug) : ''
      const { data: duplicateCategory } = await supabase
        .from('categories')
        .select('id')
        .or(`name.eq.${sanitizedName || ''},slug.eq.${sanitizedSlug || ''}`)
        .neq('id', id)
        .single()

      if (duplicateCategory) {
        return NextResponse.json({ error: 'Another category with this name or slug already exists' }, { status: 409 })
      }
    }

    // Update category
    const updateData: any = {}
    if (name !== undefined) updateData.name = sanitizeInput(name)
    if (description !== undefined) updateData.description = description
    if (slug !== undefined) updateData.slug = sanitizeInput(slug)
    if (image_url !== undefined) updateData.image_url = image_url
    if (is_active !== undefined) updateData.is_active = is_active
    if (display_order !== undefined) updateData.display_order = display_order
    if (parent_id !== undefined) updateData.parent_id = parent_id

    const { data: category, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        parent:parent_id(name, slug)
      `)
      .single()

    if (error) {
      console.error('Error updating category:', error)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error in PUT /api/admin/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/categories - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Check if category exists
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('id', id)
      .single()

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Delete category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting category:', error)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/admin/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




