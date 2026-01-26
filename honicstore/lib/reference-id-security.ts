import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// Security middleware for reference_id protection
export class ReferenceIdSecurity {
  
  /**
   * Validate that reference_id is not being modified in update operations
   */
  static validateReferenceIdUpdate(requestData: any, existingOrder: any): { valid: boolean; error?: string } {
    // Check if reference_id is being modified
    if (requestData.reference_id !== undefined && requestData.reference_id !== existingOrder.reference_id) {
      return {
        valid: false,
        error: 'reference_id is immutable and cannot be modified after order creation'
      }
    }
    
    // Check if pickup_id is being modified
    if (requestData.pickup_id !== undefined && requestData.pickup_id !== existingOrder.pickup_id) {
      return {
        valid: false,
        error: 'pickup_id is immutable and cannot be modified after order creation'
      }
    }
    
    // Check if order_number is being modified
    if (requestData.order_number !== undefined && requestData.order_number !== existingOrder.order_number) {
      return {
        valid: false,
        error: 'order_number is immutable and cannot be modified after order creation'
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Validate reference_id format and uniqueness during creation
   */
  static async validateReferenceIdCreation(referenceId: string, supabase: any): Promise<{ valid: boolean; error?: string }> {
    // Check format (should be UUID without hyphens)
    const uuidRegex = /^[0-9a-f]{32}$/i
    if (!uuidRegex.test(referenceId)) {
      return {
        valid: false,
        error: 'reference_id must be a valid UUID format (32 hex characters)'
      }
    }
    
    // Check uniqueness
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('reference_id', referenceId)
      .single()
    
    if (existingOrder) {
      return {
        valid: false,
        error: 'reference_id must be unique'
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Sanitize update data to remove immutable fields
   */
  static sanitizeUpdateData(updateData: any): any {
    const sanitized = { ...updateData }
    
    // Remove immutable fields
    delete sanitized.reference_id
    delete sanitized.pickup_id
    delete sanitized.order_number
    delete sanitized.id
    delete sanitized.user_id
    delete sanitized.created_at
    
    // Only allow specific fields to be updated
    const allowedFields = [
      'payment_status',
      'status',
      'failure_reason',
      'clickpesa_transaction_id',
      'payment_timestamp',
      'notes',
      'tracking_number',
      'estimated_delivery',
      'updated_at'
    ]
    
    const filteredData: any = {}
    for (const field of allowedFields) {
      if (sanitized[field] !== undefined) {
        filteredData[field] = sanitized[field]
      }
    }
    
    return filteredData
  }
  
  /**
   * Log security events for monitoring
   */
  static async logSecurityEvent(
    event: string,
    details: any,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      
      await supabase
        .from('audit_log')
        .insert({
          table_name: 'orders',
          operation: event,
          old_values: details.oldValues || null,
          new_values: details.newValues || null,
          user_id: userId || null,
          ip_address: ipAddress || null,
          timestamp: new Date().toISOString()
        })
    } catch (error) {
      logger.log('⚠️ Failed to log security event:', error)
    }
  }
}

// Enhanced order update API with reference_id protection
export async function secureOrderUpdate(
  orderId: string,
  updateData: any,
  userId?: string,
  ipAddress?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = getSupabaseClient()
    
    // First, get the existing order
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (fetchError || !existingOrder) {
      return { success: false, error: 'Order not found' }
    }
    
    // Validate that immutable fields are not being modified
    const validation = ReferenceIdSecurity.validateReferenceIdUpdate(updateData, existingOrder)
    if (!validation.valid) {
      // Log security violation
      await ReferenceIdSecurity.logSecurityEvent(
        'REFERENCE_ID_MODIFICATION_ATTEMPT',
        {
          oldValues: {
            reference_id: existingOrder.reference_id,
            pickup_id: existingOrder.pickup_id,
            order_number: existingOrder.order_number
          },
          newValues: {
            reference_id: updateData.reference_id,
            pickup_id: updateData.pickup_id,
            order_number: updateData.order_number
          }
        },
        userId,
        ipAddress
      )
      
      return { success: false, error: validation.error }
    }
    
    // Sanitize update data
    const sanitizedData = ReferenceIdSecurity.sanitizeUpdateData(updateData)
    
    // Add timestamp
    sanitizedData.updated_at = new Date().toISOString()
    
    // Log the update attempt for debugging
    logger.log('🔧 Attempting to update order:', {
      orderId,
      updateData: sanitizedData,
      usingServiceRole: true
    })

    // Perform the update
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(sanitizedData)
      .eq('id', orderId)
      .select()
      .single()
    
    if (updateError) {
      logger.log('❌ Order update failed:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      })
      return { success: false, error: updateError.message || 'Failed to update order' }
    }
    
    logger.log('✅ Order update succeeded:', {
      orderId,
      updatedFields: Object.keys(sanitizedData),
      newStatus: sanitizedData.status,
      newPaymentStatus: sanitizedData.payment_status
    })
    
    // Log successful update
    await ReferenceIdSecurity.logSecurityEvent(
      'ORDER_UPDATE_SUCCESS',
      {
        oldValues: existingOrder,
        newValues: updatedOrder
      },
      userId,
      ipAddress
    )
    
    return { success: true, data: updatedOrder }
    
  } catch (error) {
    logger.log('❌ Error in secure order update:', error)
    return { success: false, error: 'Internal server error' }
  }
}

// Enhanced order creation API with reference_id validation
export async function secureOrderCreation(
  orderData: any,
  userId?: string,
  ipAddress?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = getSupabaseClient()
    
    // Validate reference_id if provided
    if (orderData.reference_id) {
      const validation = await ReferenceIdSecurity.validateReferenceIdCreation(
        orderData.reference_id,
        supabase
      )
      
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }
    }
    
    // Create the order
    console.log('📝 Inserting order into database:', {
      orderNumber: orderData.order_number,
      referenceId: orderData.reference_id,
      userId: orderData.user_id,
      totalAmount: orderData.total_amount
    })
    
    const { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single()
    
    if (createError) {
      console.error('❌ Order creation database error:', {
        error: createError,
        message: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint
      })
      logger.log('❌ Order creation database error:', {
        error: createError,
        message: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint
      })
      return { 
        success: false, 
        error: createError.message || 'Failed to create order',
        details: createError.details,
        code: createError.code
      }
    }
    
    if (!newOrder) {
      console.error('❌ Order creation returned no data')
      logger.log('❌ Order creation returned no data')
      return { success: false, error: 'Order creation returned no data' }
    }
    
    console.log('✅ Order inserted successfully:', { orderId: newOrder.id })
    
    // Log successful creation
    await ReferenceIdSecurity.logSecurityEvent(
      'ORDER_CREATION_SUCCESS',
      {
        newValues: newOrder
      },
      userId,
      ipAddress
    )
    
    return { success: true, data: newOrder }
    
  } catch (error) {
    logger.log('❌ Error in secure order creation:', error)
    return { success: false, error: 'Internal server error' }
  }
}
