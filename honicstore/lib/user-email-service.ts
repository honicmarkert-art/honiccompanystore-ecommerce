/**
 * User Email Service
 * Sends emails from company to users
 * Security-focused with rate limiting and validation
 */

import { sendEmail } from './email-service'
import { emailService } from './email-service'
import {
  getOrderConfirmationTemplate,
  getOrderStatusUpdateTemplate,
  getShippingNotificationTemplate,
  getDeliveryConfirmationTemplate,
  getInvoiceEmailTemplate,
  getWelcomeUserTemplate,
  getWelcomeSupplierTemplate,
  getPriceDropAlertTemplate,
  getBackInStockTemplate,
  getAbandonedCartTemplate,
  getOrderCancellationTemplate,
  getRefundConfirmationTemplate,
  getNewsletterWelcomeTemplate,
  getSecurityAlertTemplate,
  getReviewRequestTemplate,
  getPickupReminderTemplate,
  getOrderPlacedWelcomeTemplate,
  getPasswordChangeOTPTemplate,
  EmailTemplateOptions
} from './email-templates'
import { logger } from './logger'

// Rate limiting map (in-memory, should use Redis in production)
const emailRateLimit = new Map<string, { count: number; resetAt: number }>()

// Rate limit check (5 emails per hour per user)
function checkRateLimit(userEmail: string): boolean {
  const now = Date.now()
  const key = `email:${userEmail.toLowerCase()}`
  const limit = emailRateLimit.get(key)

  if (!limit || now > limit.resetAt) {
    emailRateLimit.set(key, { count: 1, resetAt: now + 3600000 }) // 1 hour
    return true
  }

  if (limit.count >= 5) {
    return false
  }

  limit.count++
  return true
}

// Get company settings for email templates
async function getCompanySettings(): Promise<EmailTemplateOptions> {
  try {
    // Try to get from admin settings if available
    // For now, use defaults from env
    return {
      companyName: process.env.COMPANY_NAME || 'Honic Company Store',
      companyLogo: process.env.COMPANY_LOGO_URL || '',
      primaryColor: process.env.PRIMARY_COLOR || '#f59e0b',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@honiccompanystore.com',
      contactEmail: process.env.CONTACT_EMAIL || 'contact@honiccompanystore.com',
      salesEmail: process.env.SALES_EMAIL || 'sales@honiccompanystore.com',
    }
  } catch {
    return {
      companyName: 'Honic Company Store',
      primaryColor: '#f59e0b',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@honiccompanystore.com',
      contactEmail: process.env.CONTACT_EMAIL || 'contact@honiccompanystore.com',
      salesEmail: process.env.SALES_EMAIL || 'sales@honiccompanystore.com',
    }
  }
}

// Helper function to get sender email (handles Resend SMTP case)
function getSenderEmailForFrom(): string {
  const smtpUser = process.env.SMTP_USER
  const isResendSmtp = process.env.SMTP_HOST?.includes('resend.com') || smtpUser?.toLowerCase() === 'resend'
  
  if (isResendSmtp || !smtpUser || smtpUser.toLowerCase() === 'resend' || !smtpUser.includes('@')) {
    // Use sender email configs for Resend SMTP
    return process.env.SMTP_SENDER_EMAIL_NOREPLY || 
           process.env.SMTP_SENDER_EMAIL_INFO || 
           process.env.SMTP_SENDER_EMAIL_SUPPORT || 
           process.env.NOREPLY_EMAIL || process.env.SMTP_SENDER_EMAIL_NOREPLY || 'noreply@mail.honiccompanystore.com'
  }
  
  // Use SMTP_USER for non-Resend providers
  return smtpUser
}

// Helper function to get sender name
function getSenderName(): string {
  return process.env.SMTP_SENDER_NAME_NOREPLY || 
         process.env.SMTP_SENDER_NAME_INFO || 
         process.env.SMTP_SENDER_NAME_SUPPORT || 
         'Honic Co'
}

// Validate email address
function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Send Supplier Premium Plan Receipt Email
 * - Uses modern, responsive template
 * - Rate-limited via existing mechanism
 * - No tracking pixels, no promotional spam
 */
export async function sendSupplierPremiumReceiptEmail(
  userEmail: string,
  data: {
    companyName: string
    planName: string
    amount: number
    currency: string
    referenceId: string
    transactionId?: string
    billingCycle: 'monthly' | 'yearly'
    paymentDate: string
    dashboardUrl: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    // Very conservative rate limit: reuse global limit (5 emails/hour per user)
    if (!checkRateLimit(userEmail)) {
      logger.warn(`Rate limit exceeded for supplier premium receipt email: ${userEmail}`)
      return { success: false, error: 'Rate limit exceeded' }
    }

    const options = await getCompanySettings()
    const { getSupplierPremiumReceiptTemplate } = await import('./email-templates')
    const { html, text } = getSupplierPremiumReceiptTemplate(data, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Payment Receipt – ${data.planName}`,
      html,
      text,
      from: `Billing <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Supplier premium receipt email sent to ${userEmail} for reference ${data.referenceId}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending supplier premium receipt email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Order Placed Welcome Email (Simple Thank You)
 */
export async function sendOrderPlacedWelcomeEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    orderDate: string
    totalAmount: number
    itemsCount: number
    orderUrl: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getOrderPlacedWelcomeTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Thank You for Your Order #${orderData.orderNumber}!`,
      html,
      text,
      from: `Orders <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Order placed welcome email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending order placed welcome email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Order Confirmation Email
 */
export async function sendOrderConfirmationEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    orderDate: string
    items: Array<{ name: string; quantity: number; price: number; image?: string }>
    subtotal: number
    shipping: number
    tax: number
    total: number
    shippingAddress: any
    billingAddress?: any
    paymentMethod: string
    trackingUrl?: string
    invoiceUrl?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    if (!checkRateLimit(userEmail)) {
      logger.warn(`Rate limit exceeded for order confirmation email: ${userEmail}`)
      return { success: false, error: 'Rate limit exceeded' }
    }

    const options = await getCompanySettings()
    const { html, text } = getOrderConfirmationTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Order Confirmation #${orderData.orderNumber}`,
      html,
      text,
      from: `Orders <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Order confirmation email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending order confirmation email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Order Status Update Email
 */
export async function sendOrderStatusUpdateEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    status: string
    statusMessage: string
    trackingNumber?: string
    trackingUrl?: string
    estimatedDelivery?: string
    items?: Array<{ name: string; quantity: number }>
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getOrderStatusUpdateTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Order Status Update #${orderData.orderNumber}`,
      html,
      text,
      from: `Orders <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Order status update email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending order status update email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Shipping Notification Email
 */
export async function sendShippingNotificationEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    trackingNumber: string
    carrier: string
    trackingUrl: string
    estimatedDelivery: string
    shippingAddress: any
    items: Array<{ name: string; quantity: number; image?: string }>
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getShippingNotificationTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Your Order #${orderData.orderNumber} Has Shipped!`,
      html,
      text,
      from: `Shipping <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Shipping notification email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending shipping notification email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Delivery Confirmation Email
 */
export async function sendDeliveryConfirmationEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    deliveryDate: string
    items: Array<{ name: string; quantity: number; image?: string }>
    reviewUrl?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getDeliveryConfirmationTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Your Order #${orderData.orderNumber} Has Been Delivered!`,
      html,
      text,
      from: `Delivery <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Delivery confirmation email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending delivery confirmation email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Invoice Email
 */
export async function sendInvoiceEmail(
  userEmail: string,
  invoiceData: {
    invoiceNumber: string
    invoiceDate: string
    orderNumber: string
    items: Array<{ name: string; quantity: number; price: number }>
    subtotal: number
    tax: number
    total: number
    billingAddress: any
    invoiceUrl: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getInvoiceEmailTemplate(invoiceData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Invoice #${invoiceData.invoiceNumber} for Order #${invoiceData.orderNumber}`,
      html,
      text,
      from: `Billing <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Invoice email sent to ${userEmail} for invoice ${invoiceData.invoiceNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending invoice email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Welcome Email (User)
 */
export async function sendWelcomeUserEmail(
  userEmail: string,
  userData: {
    name: string
    accountUrl: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getWelcomeUserTemplate(userData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Welcome to ${options.companyName || 'Honic Company Store'}!`,
      html,
      text,
      from: `Welcome <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Welcome email sent to ${userEmail}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending welcome email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Welcome Email (Supplier)
 */
export async function sendWelcomeSupplierEmail(
  supplierEmail: string,
  supplierData: {
    name: string
    companyName: string
    dashboardUrl: string
    commissionRate: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(supplierEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getWelcomeSupplierTemplate(supplierData, options)

    const result = await sendEmail({
      to: supplierEmail,
      subject: `Welcome to ${options.companyName || 'Honic Company Store'} Supplier Program!`,
      html,
      text,
      from: `Supplier Support <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Welcome supplier email sent to ${supplierEmail}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending welcome supplier email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Password Change OTP Email
 */
export async function sendPasswordChangeOTPEmail(
  userEmail: string,
  otpCode: string,
  expiresInMinutes: number = 15
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    if (!checkRateLimit(userEmail)) {
      logger.warn(`Rate limit exceeded for password change OTP email: ${userEmail}`)
      return { success: false, error: 'Rate limit exceeded' }
    }

    const options = await getCompanySettings()
    const { html, text } = getPasswordChangeOTPTemplate({ otpCode, expiresInMinutes }, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Password Change Verification - ${options.companyName || 'Honic Company Store'}`,
      html,
      text,
      from: `Security <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Password change OTP email sent to ${userEmail}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending password change OTP email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Price Drop Alert Email
 */
export async function sendPriceDropAlertEmail(
  userEmail: string,
  productData: {
    name: string
    image: string
    originalPrice: number
    newPrice: number
    discountPercent: number
    productUrl: string
    targetPrice?: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getPriceDropAlertTemplate(productData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Price Drop Alert: ${productData.name}`,
      html,
      text,
      from: `Alerts <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Price drop alert email sent to ${userEmail} for product ${productData.name}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending price drop alert email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Back in Stock Notification Email
 */
export async function sendBackInStockEmail(
  userEmail: string,
  productData: {
    name: string
    image: string
    price: number
    productUrl: string
    stockQuantity?: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getBackInStockTemplate(productData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Back in Stock: ${productData.name}`,
      html,
      text,
      from: `Alerts <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Back in stock email sent to ${userEmail} for product ${productData.name}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending back in stock email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Abandoned Cart Email
 */
export async function sendAbandonedCartEmail(
  userEmail: string,
  cartData: {
    items: Array<{ name: string; quantity: number; price: number; image?: string }>
    total: number
    cartUrl: string
    discountCode?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getAbandonedCartTemplate(cartData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: 'Don\'t Forget Your Cart!',
      html,
      text,
      from: `Reminders <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Abandoned cart email sent to ${userEmail}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending abandoned cart email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Order Cancellation Email
 */
export async function sendOrderCancellationEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    cancellationReason: string
    refundAmount?: number
    refundMethod?: string
    refundTimeline?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getOrderCancellationTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Order Cancelled #${orderData.orderNumber}`,
      html,
      text,
      from: `Orders <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Order cancellation email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending order cancellation email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Refund Confirmation Email
 */
export async function sendRefundConfirmationEmail(
  userEmail: string,
  refundData: {
    orderNumber: string
    refundAmount: number
    refundMethod: string
    refundTimeline: string
    transactionId?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getRefundConfirmationTemplate(refundData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Refund Processed for Order #${refundData.orderNumber}`,
      html,
      text,
      from: `Billing <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Refund confirmation email sent to ${userEmail} for order ${refundData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending refund confirmation email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Newsletter Welcome Email
 */
export async function sendNewsletterWelcomeEmail(
  userEmail: string,
  unsubscribeUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    if (unsubscribeUrl) {
      options.unsubscribeUrl = unsubscribeUrl
    }
    const { html, text } = getNewsletterWelcomeTemplate(options)

    const senderEmail = getSenderEmailForFrom()
    const senderName = getSenderName()

    const result = await sendEmail({
      to: userEmail,
      subject: `Welcome to ${options.companyName || 'Honic Company Store'} Newsletter!`,
      html,
      text,
      from: `Newsletter <${senderEmail}>`,
    })

    if (result.success) {
      logger.log(`Newsletter welcome email sent to ${userEmail}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending newsletter welcome email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Security Alert Email
 */
export async function sendSecurityAlertEmail(
  userEmail: string,
  alertData: {
    alertType: string
    activity: string
    location?: string
    ipAddress?: string
    timestamp: string
    actionTaken: string
    supportUrl: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    // Security alerts bypass rate limiting
    const options = await getCompanySettings()
    const { html, text } = getSecurityAlertTemplate(alertData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Security Alert: ${alertData.alertType}`,
      html,
      text,
      from: `Security <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Security alert email sent to ${userEmail}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending security alert email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Review Request Email
 */
export async function sendReviewRequestEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    productName: string
    productImage: string
    productUrl: string
    reviewUrl: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getReviewRequestTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `How Was Your Purchase? Review Order #${orderData.orderNumber}`,
      html,
      text,
      from: `Reviews <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Review request email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending review request email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send Pickup Reminder Email
 */
export async function sendPickupReminderEmail(
  userEmail: string,
  orderData: {
    orderNumber: string
    pickupId: string
    pickupLocation: string
    pickupInstructions: string
    availableTimes: string
    items: Array<{ name: string; quantity: number }>
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!validateEmail(userEmail)) {
      return { success: false, error: 'Invalid email address' }
    }

    const options = await getCompanySettings()
    const { html, text } = getPickupReminderTemplate(orderData, options)

    const result = await sendEmail({
      to: userEmail,
      subject: `Your Order #${orderData.orderNumber} is Ready for Pickup!`,
      html,
      text,
      from: `Pickup <${getSenderEmailForFrom()}>`,
    })

    if (result.success) {
      logger.log(`Pickup reminder email sent to ${userEmail} for order ${orderData.orderNumber}`)
    }

    return result
  } catch (error: any) {
    logger.error('Error sending pickup reminder email:', error)
    return { success: false, error: error.message }
  }
}



