import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const supplierUpdateSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'update', 'reset_account_info']),
  isVerified: z.boolean().optional(),
  detailSentence: z.string().max(500).optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().min(0).nullable().optional(),
})

// PATCH /api/admin/suppliers/[id] - Update supplier status (activate/deactivate) or info
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return performanceMonitor.measure('admin_suppliers_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/suppliers/[id]',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_suppliers_patch',
          metadata: {
            endpoint: '/api/admin/suppliers/[id]'
          }
        })
        return authError
      }

      const { id } = await params
      const body = await request.json()

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return NextResponse.json({ error: 'Invalid supplier ID format' }, { status: 400 })
      }

      // Validate input with Zod
      let validatedData
      try {
        validatedData = supplierUpdateSchema.parse(body)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return NextResponse.json(
            { 
              error: 'Validation failed',
              details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            },
            { status: 400 }
          )
        }
        throw validationError
      }

      const { action } = validatedData

    // Handle update action for seller info
    if (action === 'update') {
      const { isVerified, detailSentence, rating, reviewCount } = body
      
      const supabase = createAdminSupabaseClient()
      
      // Check if supplier exists
      const { data: supplier, error: supplierError } = await supabase
        .from('profiles')
        .select('id, is_supplier')
        .eq('id', id)
        .single()

      if (supplierError || !supplier) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        )
      }

      if (!supplier.is_supplier) {
        return NextResponse.json(
          { error: 'User is not a supplier' },
          { status: 400 }
        )
      }

      // Update supplier info - allow inserting new values (INSERT/UPDATE operation)
      const updateData: any = {
        updated_at: new Date().toISOString()
      }
      
      // Allow inserting/updating these values - supports both INSERT (new values) and UPDATE (existing values)
      if (isVerified !== undefined) {
        updateData.is_verified = isVerified
      }
      if (detailSentence !== undefined) {
        // Empty string clears the field, otherwise inserts/updates the value
        updateData.detail_sentence = detailSentence.trim() === '' ? null : detailSentence.trim()
      }
      if (rating !== undefined) {
        // Allow inserting any rating value (0-5), including 0 as a valid value
        // null explicitly clears the field
        updateData.supplier_rating = rating === null ? null : rating
      }
      if (reviewCount !== undefined) {
        // Allow inserting any review count value, including 0 as a valid value
        // null explicitly clears the field
        updateData.supplier_review_count = reviewCount === null ? null : reviewCount
      }

      // Get current supplier profile for comparison
      const { data: currentSupplier } = await supabase
        .from('profiles')
        .select('company_name, email, is_verified, supplier_rating, supplier_review_count')
        .eq('id', id)
        .single()

      const { data: updatedSupplier, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select('id, is_verified, detail_sentence, supplier_rating, supplier_review_count, company_name, email')
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update supplier info', details: updateError.message },
          { status: 500 }
        )
      }

      // Create notification for account update
      try {
        const adminSupabase = createAdminSupabaseClient()
        const companyName = updatedSupplier?.company_name || updatedSupplier?.email || 'Your account'
        
        // Determine what was changed for notification message
        const changes: string[] = []
        if (isVerified !== undefined && currentSupplier?.is_verified !== isVerified) {
          changes.push(isVerified ? 'verified badge' : 'verification removed')
        }
        if (rating !== undefined && currentSupplier?.supplier_rating !== rating) {
          changes.push(rating !== null ? `rating updated to ${rating}` : 'rating cleared')
        }
        if (reviewCount !== undefined && currentSupplier?.supplier_review_count !== reviewCount) {
          changes.push(`review count updated to ${reviewCount}`)
        }
        if (detailSentence !== undefined) {
          changes.push('profile description updated')
        }

        if (changes.length > 0) {
          const { error: notificationError } = await adminSupabase
            .from('notifications')
            .insert({
              user_id: id,
              type: 'info',
              title: 'Account Information Updated',
              message: `Your supplier account "${companyName}" has been updated. Changes: ${changes.join(', ')}.`,
              metadata: {
                account_update: true,
                changes: changes,
                company_name: companyName
              },
              is_read: false
            })

          if (notificationError) {
            logger.error('Error creating update notification:', notificationError)
          } else {
            logger.log(`Notification created for account update of supplier ${id}`)
          }
        }
      } catch (notificationError) {
        logger.error('Error creating update notification:', notificationError)
      }

      return NextResponse.json({
        success: true,
        message: 'Supplier information updated successfully',
        supplier: {
          id: updatedSupplier.id,
          isVerified: updatedSupplier.is_verified,
          detailSentence: updatedSupplier.detail_sentence,
          rating: updatedSupplier.supplier_rating,
          reviewCount: updatedSupplier.supplier_review_count
        }
      })
    }

    // Handle full account info reset
    if (action === 'reset_account_info') {
      const supabase = createAdminSupabaseClient()

      // Check supplier exists and is a supplier
      const { data: supplier, error: supplierError } = await supabase
        .from('profiles')
        .select('id, is_supplier')
        .eq('id', id)
        .single()

      if (supplierError || !supplier) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        )
      }

      if (!supplier.is_supplier) {
        return NextResponse.json(
          { error: 'User is not a supplier' },
          { status: 400 }
        )
      }

      // Clear business info + docs; do NOT delete account
      const resetData = {
        company_name: null,
        location: null,
        office_number: null,
        registration_type: null,
        business_registration_number: null,
        region: null,
        nation: 'Tanzania',
        detail_sentence: null,
        company_logo: null,
        business_tin_certificate_url: null,
        company_certificate_url: null,
        // Keep supplier flag, but mark inactive until they re-submit
        is_active: false,
        updated_at: new Date().toISOString(),
      }

      const { error: resetError } = await supabase
        .from('profiles')
        .update(resetData)
        .eq('id', id)

      if (resetError) {
        return NextResponse.json(
          { error: 'Failed to reset supplier account info', details: resetError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Supplier account info reset successfully. Supplier will need to resubmit details.',
      })
    }

    const supabase = createAdminSupabaseClient()

    // Check if supplier exists
    const { data: supplier, error: supplierError } = await supabase
      .from('profiles')
      .select('id, is_supplier, is_active')
      .eq('id', id)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    if (!supplier.is_supplier) {
      return NextResponse.json(
        { error: 'User is not a supplier' },
        { status: 400 }
      )
    }

    const isActive = action === 'activate'

    // Update supplier status
    const { data: updatedSupplier, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, is_active')
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update supplier status', details: updateError.message },
        { status: 500 }
      )
    }

    // The trigger will automatically update product visibility
    // But we can also manually update to ensure consistency
    const { error: productsError } = await supabase
      .from('products')
      .update({ is_hidden: !isActive })
      .or(`supplier_id.eq.${id},user_id.eq.${id}`)

    if (productsError) {
      logger.error('Error updating products visibility:', productsError)
      // Don't fail the request, just log the error
    }

    // Create notification for account status change
    try {
      const adminSupabase = createAdminSupabaseClient()
      
      // Get supplier profile to get company name for notification
      const { data: supplierProfile } = await adminSupabase
        .from('profiles')
        .select('company_name, email')
        .eq('id', id)
        .single()

      const companyName = supplierProfile?.company_name || supplierProfile?.email || 'Your account'
      
      const { data: notification, error: notificationError } = await adminSupabase
        .from('notifications')
        .insert({
          user_id: id,
          type: isActive ? 'account_activated' : 'account_deactivated',
          title: isActive ? 'Account Activated ✅' : 'Account Deactivated ⚠️',
          message: isActive 
            ? `Congratulations! Your supplier account "${companyName}" has been activated by the administration team. You can now access all features, list products, and manage orders. Welcome to the platform!`
            : `Your supplier account "${companyName}" has been deactivated by the administration team. Your products are now hidden from customers and you cannot access supplier features. Please contact support if you believe this is an error or to discuss reactivation.`,
          metadata: {
            account_status: isActive ? 'active' : 'inactive',
            company_name: companyName,
            action: isActive ? 'activated' : 'deactivated'
          },
          is_read: false
        })
        .select()
        .single()

      if (notificationError) {
        logger.error('Error creating notification:', notificationError)
        // Don't fail the request, just log the error
      } else {
        logger.log(`Notification created for ${isActive ? 'activation' : 'deactivation'} of account ${id}`)
      }
    } catch (notificationError) {
      logger.error('Error creating notification:', notificationError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: `Supplier ${action === 'activate' ? 'activated' : 'deactivated'} successfully`,
      supplier: {
        id: updatedSupplier.id,
        isActive: updatedSupplier.is_active
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
  })
}

// DELETE /api/admin/suppliers/[id] - Delete supplier account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { id } = await params
    const supabase = createAdminSupabaseClient()

    // Check if supplier exists and get document URLs for cleanup
    const { data: supplier, error: supplierError } = await supabase
      .from('profiles')
      .select('id, is_supplier, email, company_logo, business_tin_certificate_url, company_certificate_url, nida_card_photo_url, self_face_photo_url')
      .eq('id', id)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    if (!supplier.is_supplier) {
      return NextResponse.json(
        { error: 'User is not a supplier' },
        { status: 400 }
      )
    }

    // First, hide all products from this supplier
    const { error: hideProductsError } = await supabase
      .from('products')
      .update({ is_hidden: true })
      .or(`supplier_id.eq.${id},user_id.eq.${id}`)

    if (hideProductsError) {
      logger.error('Error hiding products:', hideProductsError)
      // Continue with deletion even if hiding products fails
    }

    // Best-effort: delete any stored documents (logo & certificates) from storage bucket
    try {
      const adminSupabase = createAdminSupabaseClient()

      const fileUrls: string[] = []
      if (supplier.company_logo) fileUrls.push(supplier.company_logo)
      if (supplier.business_tin_certificate_url) fileUrls.push(supplier.business_tin_certificate_url)
      if (supplier.company_certificate_url) fileUrls.push(supplier.company_certificate_url)
      if (supplier.nida_card_photo_url) fileUrls.push(supplier.nida_card_photo_url)
      if (supplier.self_face_photo_url) fileUrls.push(supplier.self_face_photo_url)

      const filesToRemove: string[] = []

      for (const url of fileUrls) {
        let path: string | null = null

        // Supabase public URL format: .../object/public/service-images/<path>
        if (url.includes('service-images')) {
          const match = url.match(/service-images\/([^?]+)/)
          if (match && match[1]) {
            path = match[1]
          }
        }

        // Also support direct path style (already like supplier-logos/...)
        if (!path && url.match(/^[^:]+\/.+/)) {
          path = url
        }

        if (path) {
          filesToRemove.push(path)
        }
      }

      if (filesToRemove.length > 0) {
        const { error: storageError } = await adminSupabase.storage
          .from('service-images')
          .remove(filesToRemove)

        if (storageError) {
          logger.error('Error deleting supplier files from storage:', storageError)
        }
      }
    } catch (storageCleanupError) {
      logger.error('Exception during supplier storage cleanup:', storageCleanupError)
    }

    // Remove supplier flag and set is_active to false
    // We don't delete the profile completely, just remove supplier status and clear document URLs
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_supplier: false,
        is_active: false,
        company_logo: null,
        business_tin_certificate_url: null,
        company_certificate_url: null,
        nida_card_photo_url: null,
        self_face_photo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to delete supplier account', details: updateError.message },
        { status: 500 }
      )
    }

    // Log admin action
    logSecurityEvent('SUPPLIER_DELETED', {
      userId: user?.id,
      supplierId: id,
      endpoint: '/api/admin/suppliers/[id]'
    }, request)

    // Clear cache
    const { setCachedData } = await import('@/lib/database-optimization')
    setCachedData('admin_suppliers_all', null, 0)

    return NextResponse.json({
      success: true,
      message: 'Supplier account deleted successfully. All products have been hidden.'
    })

  } catch (error: any) {
    logError(error, {
      action: 'admin_suppliers_delete',
      metadata: {
        endpoint: '/api/admin/suppliers/[id]'
      }
    })
    return createErrorResponse(error, 500)
  }
}






