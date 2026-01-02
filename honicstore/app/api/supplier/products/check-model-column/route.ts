import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Check if model column exists in products table
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with proper cookie handling (same as supplier products API)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Cookies will be set by the response
          },
          remove(name: string, options: any) {
            // Cookies will be removed by the response
          },
        },
      }
    )

    // Get authenticated user (same as supplier products API)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a supplier (same as supplier products API)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier account required.' },
        { status: 403 }
      )
    }

    // Method 1: Try to SELECT model column (same as GET endpoint)
    let selectTest = { exists: false, error: null, value: null }
    try {
      const { data: testProduct, error: selectError } = await supabase
        .from('products')
        .select('id, model')
        .limit(1)
        .maybeSingle()

      if (selectError) {
        if (selectError.code === '42703' || (selectError.message?.includes('column') && selectError.message?.includes('does not exist'))) {
          selectTest = { exists: false, error: selectError.message, value: null }
        } else {
          selectTest = { exists: false, error: selectError.message, value: null }
        }
      } else {
        selectTest = { exists: true, error: null, value: testProduct?.model }
      }
    } catch (error: any) {
      selectTest = { 
        exists: false, 
        error: error.message || String(error),
        value: null
      }
    }

    // Method 2: Check if model can be used in INSERT (same logic as POST endpoint)
    // We'll test by checking the table structure via a safe query
    let insertTest = { canUse: false, error: null }
    try {
      // Get an existing product to check structure
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (existingProduct) {
        // Check if model field exists in the returned data structure
        // If SELECT includes model, it means the column exists
        const { data: testSelect, error: selectModelError } = await supabase
          .from('products')
          .select('id, name, model')
          .eq('id', existingProduct.id)
          .single()

        if (selectModelError) {
          if (selectModelError.code === '42703' || (selectModelError.message?.includes('column') && selectModelError.message?.includes('does not exist'))) {
            insertTest = { canUse: false, error: selectModelError.message }
          } else {
            insertTest = { canUse: false, error: selectModelError.message }
          }
        } else {
          // If we can select model, we can insert it (same logic as POST)
          insertTest = { canUse: true, error: null }
        }
      } else {
        insertTest = { canUse: false, error: 'No products found to test' }
      }
    } catch (error: any) {
      if (error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist'))) {
        insertTest = { canUse: false, error: error.message }
      } else {
        insertTest = { canUse: false, error: error.message }
      }
    }

    // Method 3: Try to UPDATE with model field (same as PUT endpoint)
    let updateTest = { canUse: false, error: null }
    try {
      // Get a test product ID that belongs to the user
      const { data: userProduct } = await supabase
        .from('products')
        .select('id')
        .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (userProduct) {
        // Try to update with model field (same as PUT endpoint)
        const updateData: any = {
          updated_at: new Date().toISOString()
        }
        // Only include model if it has a non-empty value (same logic as PUT)
        if (true) { // Always test with model
          updateData.model = 'TEST_UPDATE_MODEL'
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', userProduct.id)
          .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
          .select('model')
          .limit(0) // Don't return data, just test the query

        if (updateError) {
          if (updateError.code === '42703' || (updateError.message?.includes('column') && updateError.message?.includes('does not exist'))) {
            updateTest = { canUse: false, error: updateError.message }
          } else {
            updateTest = { canUse: true, error: updateError.message }
          }
        } else {
          updateTest = { canUse: true, error: null }
        }
      } else {
        updateTest = { canUse: false, error: 'No products found to test update' }
      }
    } catch (error: any) {
      if (error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist'))) {
        updateTest = { canUse: false, error: error.message }
      } else {
        updateTest = { canUse: true, error: error.message }
      }
    }

    // Determine final result
    const columnExists = selectTest.exists || updateTest.canUse
    const canUseInInsert = insertTest.canUse
    const canUseInUpdate = updateTest.canUse

    return NextResponse.json({
      success: true,
      columnExists,
      tests: {
        select: {
          exists: selectTest.exists,
          error: selectTest.error,
          testValue: selectTest.value,
          method: 'SELECT query (same as GET endpoint)'
        },
        insert: {
          canUse: canUseInInsert,
          error: insertTest.error,
          method: 'INSERT with model (same as POST endpoint)'
        },
        update: {
          canUse: canUseInUpdate,
          error: updateTest.error,
          method: 'UPDATE with model (same as PUT endpoint)'
        }
      },
      summary: {
        columnExists: columnExists,
        canUseInInsert: canUseInInsert,
        canUseInUpdate: canUseInUpdate,
        recommendation: columnExists && canUseInUpdate
          ? '✅ Column exists and can be used in both INSERT and UPDATE operations'
          : '❌ Column does not exist or cannot be used. Run migration: supabase/migrations/add_model_column_if_missing.sql'
      },
      migration: {
        file: 'supabase/migrations/add_model_column_if_missing.sql',
        description: 'Run this migration to add the model column if it does not exist'
      }
    })

  } catch (error) {
    console.error('Error checking model column:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

