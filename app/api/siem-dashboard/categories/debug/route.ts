import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET /api/admin/categories/debug - Debug endpoint to see what's in the table
export async function GET() {
  try {
    // First, let's see what columns exist in the categories table
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'categories')

    if (columnsError) {
      console.error('Error fetching table structure:', columnsError)
    }

    // Try to fetch categories with all possible column names
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')

    if (error) {
      console.error('Error fetching categories:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch categories',
        details: error,
        tableStructure: columns || []
      }, { status: 500 })
    }

    return NextResponse.json({
      categories: categories || [],
      tableStructure: columns || [],
      message: 'Debug info for categories table'
    })
  } catch (error) {
    console.error('Error in debug endpoint:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error 
    }, { status: 500 })
  }
}




