/**
 * Notification Helper Functions
 * Utility functions for creating and managing notifications
 */

import { createAdminSupabaseClient } from './admin-auth'

export type NotificationType = 
  | 'account_activated' 
  | 'account_deactivated' 
  | 'order_received' 
  | 'order_updated' 
  | 'system' 
  | 'info'
  | 'welcome'
  | 'waiting_for_review'
  | 'supplier_registered'
  | 'company_info_submitted'
  | 'payment_received'
  | 'plan_upgrade_request'
  | 'plan_expired'
  | 'plan_expiring_soon'
  | 'account_status_change'
  | 'product_flagged'
  | 'high_risk_order'

export interface NotificationMetadata {
  supplier_id?: string
  company_name?: string
  email?: string
  action_url?: string
  transaction_id?: string
  order_id?: string
  order_number?: string
  plan_slug?: string
  [key: string]: any
}

/**
 * Get all admin user IDs from the database
 */
export async function getAllAdminUserIds(): Promise<string[]> {
  try {
    const supabase = createAdminSupabaseClient()
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)

    if (error) {
      console.error('Error fetching admin users:', error)
      return []
    }

    return (admins || []).map((admin: any) => admin.id)
  } catch (error) {
    console.error('Error in getAllAdminUserIds:', error)
    return []
  }
}

/**
 * Create a notification for a single user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotificationMetadata
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata: metadata || {},
        is_read: false
      })

    if (error) {
      console.error('Error creating notification:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in createNotification:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create notifications for all admin users
 */
export async function notifyAllAdmins(
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotificationMetadata
): Promise<{ success: boolean; notified: number; errors: number }> {
  try {
    const adminIds = await getAllAdminUserIds()
    
    if (adminIds.length === 0) {
      console.warn('No admin users found to notify')
      return { success: false, notified: 0, errors: 0 }
    }

    const supabase = createAdminSupabaseClient()
    
    // Create notifications for all admins in batch
    const notifications = adminIds.map(adminId => ({
      user_id: adminId,
      type,
      title,
      message,
      metadata: metadata || {},
      is_read: false
    }))

    const { error } = await supabase
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('Error creating admin notifications:', error)
      return { success: false, notified: 0, errors: adminIds.length }
    }

    console.log(`✅ Notified ${adminIds.length} admin(s): ${title}`)
    return { success: true, notified: adminIds.length, errors: 0 }
  } catch (error: any) {
    console.error('Error in notifyAllAdmins:', error)
    return { success: false, notified: 0, errors: 1 }
  }
}

