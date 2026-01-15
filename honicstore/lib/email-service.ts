/**
 * Centralized Email Service
 * Uses SMTP configuration from .env.local
 * 
 * Environment variables required (lines 21-63 in .env.local):
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASSWORD: SMTP password
 * - SMTP_SECURE: 'true' for port 465, 'false' for other ports (default: 'false')
 * - CONTACT_EMAIL: Company contact email
 * - SUPPORT_EMAIL: Company support email
 * - SALES_EMAIL: Company sales email
 * - PROMOTION_EMAIL: Company promotion email
 */

import nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'

export interface EmailOptions {
  to: string | string[]
  subject: string
  text: string
  html: string
  replyTo?: string
  from?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

class EmailService {
  private transporter: Transporter | null = null
  private initialized = false

  /**
   * Initialize SMTP transporter from environment variables
   */
  private initializeTransporter(): void {
    if (this.initialized) return

    const smtpHost = process.env.SMTP_HOST
    let smtpUser = process.env.SMTP_USER
    let smtpPassword = process.env.SMTP_PASSWORD

    // Handle Resend API key in password field
    if (smtpPassword && (smtpPassword.includes('RESEND_API_KEY') || smtpPassword.startsWith('${'))) {
      smtpPassword = process.env.RESEND_API_KEY || smtpPassword
    }

    // For Resend SMTP: username is "resend", but we need sender email for "from" field
    // Keep "resend" as username for authentication, but use sender emails for actual sending
    const isResendSmtp = smtpHost?.includes('resend.com') || smtpUser?.toLowerCase() === 'resend'
    
    if (isResendSmtp && smtpUser?.toLowerCase() === 'resend') {
      // For Resend, username stays "resend" for auth, but we'll use sender emails for "from"
      } else if (!smtpUser || !smtpUser.includes('@')) {
      // For other SMTP providers, username must be a valid email
      this.transporter = null
      this.initialized = true
      return
    }

    if (!smtpHost || !smtpUser || !smtpPassword) {
      this.transporter = null
      this.initialized = true
      return
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: smtpUser, // For Resend: "resend", for others: email address
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production', // Only reject in production
        },
      })

      if (isResendSmtp) {
        }
      this.initialized = true
    } catch (error) {
      this.transporter = null
      this.initialized = true
    }
  }

  /**
   * Send email using SMTP
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    this.initializeTransporter()

    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env.local'
      }
    }

    // Get sender email for "from" field
    // For Resend SMTP: SMTP_USER is "resend" (for auth), but we use sender emails for "from"
    const smtpUserAuth = process.env.SMTP_USER
    const isResendSmtp = process.env.SMTP_HOST?.includes('resend.com') || smtpUserAuth?.toLowerCase() === 'resend'
    
    let senderEmail: string
    if (isResendSmtp || !smtpUserAuth || smtpUserAuth.toLowerCase() === 'resend' || !smtpUserAuth.includes('@')) {
      // Use sender email configs (matches .env.local: prioritize NOREPLY > INFO > SUPPORT)
      senderEmail = process.env.SMTP_SENDER_EMAIL_NOREPLY || 
                    process.env.NOREPLY_EMAIL ||
                    process.env.SMTP_SENDER_EMAIL_INFO || 
                    process.env.SMTP_SENDER_EMAIL_SUPPORT || 
                    process.env.SUPPORT_EMAIL ||
                    'noreply@mail.honiccompanystore.com'
    } else {
      // Use SMTP_USER as sender email (for non-Resend providers)
      senderEmail = smtpUserAuth
    }

    if (!senderEmail || !senderEmail.includes('@')) {
      return {
        success: false,
        error: 'Sender email configuration is not set. Please configure SMTP_SENDER_EMAIL_NOREPLY in .env.local'
      }
    }

    // Get sender name from config (matches .env.local configuration)
    const senderName = process.env.SMTP_SENDER_NAME_NOREPLY || 
                       process.env.SMTP_SENDER_NAME_INFO || 
                       process.env.SMTP_SENDER_NAME_SUPPORT || 
                       'Honic Store'

    // Validate and format "from" address
    let fromAddress: string
    if (options.from) {
      // Validate the provided from address format
      if (options.from.includes('<') && options.from.includes('>')) {
        // Format: "Name <email@domain.com>" - validate email part
        const emailMatch = options.from.match(/<([^>]+)>/)
        if (emailMatch && emailMatch[1] && emailMatch[1].includes('@') && emailMatch[1].trim()) {
          fromAddress = options.from
        } else {
          // Invalid email in angle brackets, use default
          fromAddress = `${senderName} <${senderEmail}>`
        }
      } else if (options.from.includes('@') && options.from.trim()) {
        // Format: "email@domain.com" - use sender email
        fromAddress = `${senderName} <${senderEmail}>`
      } else {
        // Invalid format, use default
        fromAddress = `${senderName} <${senderEmail}>`
      }
    } else {
      // Default format
      fromAddress = `${senderName} <${senderEmail}>`
    }

    try {
      const mailOptions = {
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        replyTo: options.replyTo,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      }

      const info = await this.transporter.sendMail(mailOptions)
      
      return {
        success: true,
        messageId: info.messageId
      }
    } catch (error: any) {
      if (error.code === 'EAUTH') {
        // SMTP authentication error - check credentials
      }

      return {
        success: false,
        error: error.message || 'Failed to send email'
      }
    }
  }

  /**
   * Send email using Resend API as fallback
   */
  async sendEmailViaResend(options: EmailOptions): Promise<EmailResult> {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return {
        success: false,
        error: 'RESEND_API_KEY not configured'
      }
    }

    // Get sender email for Resend fallback (matches .env.local configuration)
    const senderConfig = this.getSenderEmail('noreply')
    let smtpUser = senderConfig.email

    if (!smtpUser || !smtpUser.includes('@')) {
      // Try fallback to other sender emails (matches .env.local priority)
      smtpUser = process.env.SMTP_SENDER_EMAIL_INFO || 
                 process.env.SMTP_SENDER_EMAIL_SUPPORT || 
                 process.env.SUPPORT_EMAIL ||
                 process.env.NOREPLY_EMAIL ||
                 ''
      
      if (!smtpUser || !smtpUser.includes('@')) {
        return {
          success: false,
          error: 'SMTP_SENDER_EMAIL_NOREPLY, SMTP_SENDER_EMAIL_INFO, or SMTP_SENDER_EMAIL_SUPPORT is not configured. Cannot use Resend fallback without a valid sender email.'
        }
      }
    }

    // Format "from" address for Resend
    let fromAddress: string
    if (options.from) {
      // Validate the provided from address format
      if (options.from.includes('<') && options.from.includes('>')) {
        // Format: "Name <email@domain.com>" - validate email part
        const emailMatch = options.from.match(/<([^>]+)>/)
        if (emailMatch && emailMatch[1] && emailMatch[1].includes('@') && emailMatch[1].trim()) {
          fromAddress = options.from
        } else {
          // Invalid email in angle brackets, use default
          fromAddress = `${senderConfig.name} <${smtpUser}>`
        }
      } else if (options.from.includes('@') && options.from.trim()) {
        // Format: "email@domain.com" - use sender config for Resend
        fromAddress = `${senderConfig.name} <${smtpUser}>`
      } else {
        // Invalid format, use default
        fromAddress = `${senderConfig.name} <${smtpUser}>`
      }
    } else {
      // Default format
      fromAddress = `${senderConfig.name} <${smtpUser}>`
    }

    try {
      const resendApiUrl = process.env.RESEND_API_URL || 'https://api.resend.com'
      const resendResponse = await fetch(`${resendApiUrl}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: Array.isArray(options.to) ? options.to : [options.to],
          reply_to: options.replyTo,
          subject: options.subject,
          text: options.text,
          html: options.html,
        }),
      })

      if (resendResponse.ok) {
        const data = await resendResponse.json()
        return {
          success: true,
          messageId: data.id
        }
      } else {
        const errorData = await resendResponse.json()
        return {
          success: false,
          error: errorData.message || 'Resend API error'
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email via Resend'
      }
    }
  }

  /**
   * Send email with automatic fallback (SMTP first, then Resend)
   */
  async sendEmailWithFallback(options: EmailOptions): Promise<EmailResult> {
    // Try SMTP first
    const smtpResult = await this.sendEmail(options)
    
    if (smtpResult.success) {
      return smtpResult
    }

    // Fallback to Resend if SMTP fails
    const resendResult = await this.sendEmailViaResend(options)
    
    if (resendResult.success) {
      return resendResult
    }

    // Both failed
    return {
      success: false,
      error: `SMTP: ${smtpResult.error}, Resend: ${resendResult.error}`
    }
  }

  /**
   * Get company email addresses from environment variables
   */
  getCompanyEmails() {
    return {
      contact: process.env.CONTACT_EMAIL || 'contact@honiccompanystore.com',
      support: process.env.SUPPORT_EMAIL || 'support@honiccompanystore.com',
      sales: process.env.SALES_EMAIL || 'sales@honiccompanystore.com',
      promotion: process.env.PROMOTION_EMAIL || 'promotion@honiccompanystore.com',
      tech: process.env.TECH_EMAIL || process.env.SUPPORT_EMAIL || 'tech@honiccompanystore.com',
      legal: process.env.LEGAL_EMAIL || process.env.CONTACT_EMAIL || 'legal@honic.co',
      privacy: process.env.PRIVACY_EMAIL || process.env.LEGAL_EMAIL || 'privacy@honic.co',
      dpo: process.env.DPO_EMAIL || process.env.PRIVACY_EMAIL || 'dpo@honic.co',
      security: process.env.SECURITY_EMAIL || process.env.SUPPORT_EMAIL || 'security@honic.co',
    }
  }

  /**
   * Get sender email configuration based on email type
   */
  getSenderEmail(emailType: 'support' | 'info' | 'noreply' | 'default' = 'default'): { email: string; name: string } {
    // Helper to get valid sender email (handle "resend" case)
    const getValidSenderEmail = (): string => {
      const smtpUser = process.env.SMTP_USER
      const isResendSmtp = process.env.SMTP_HOST?.includes('resend.com') || smtpUser?.toLowerCase() === 'resend'
      
      if (isResendSmtp || !smtpUser || smtpUser.toLowerCase() === 'resend' || !smtpUser.includes('@')) {
        // For Resend: use sender email configs (matches .env.local priority: NOREPLY > INFO > SUPPORT)
        return process.env.SMTP_SENDER_EMAIL_NOREPLY || 
               process.env.NOREPLY_EMAIL ||
               process.env.SMTP_SENDER_EMAIL_INFO || 
               process.env.SMTP_SENDER_EMAIL_SUPPORT || 
               process.env.SUPPORT_EMAIL ||
               'noreply@mail.honiccompanystore.com'
      }
      // For other providers: use SMTP_USER if it's a valid email
      return smtpUser
    }

    switch (emailType) {
      case 'support':
        return {
          email: process.env.SMTP_SENDER_EMAIL_SUPPORT || process.env.SUPPORT_EMAIL || getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_SUPPORT || 'Honic Store Support'
        }
      case 'info':
        return {
          email: process.env.SMTP_SENDER_EMAIL_INFO || getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_INFO || 'Honic Store Info'
        }
      case 'noreply':
        return {
          email: process.env.SMTP_SENDER_EMAIL_NOREPLY || process.env.NOREPLY_EMAIL || getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_NOREPLY || 'Honic Store noreply'
        }
      default:
        return {
          email: getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_NOREPLY || process.env.SMTP_SENDER_NAME_INFO || process.env.SMTP_SENDER_NAME_SUPPORT || 'Honic Store'
        }
    }
  }

  /**
   * Get contact email based on inquiry type
   */
  getContactEmailByType(inquiryType?: string): string {
    const emails = this.getCompanyEmails()
    
    switch (inquiryType?.toLowerCase()) {
      case 'sales':
        return emails.sales
      case 'support':
        return emails.support
      default:
        return emails.support // Default to support for general inquiries
    }
  }
}

// Export singleton instance
export const emailService = new EmailService()

// Export convenience functions
export async function sendEmailToCompany(
  options: Omit<EmailOptions, 'to'> & { inquiryType?: string }
): Promise<EmailResult> {
  const to = emailService.getContactEmailByType(options.inquiryType)
  return emailService.sendEmailWithFallback({
    ...options,
    to,
  })
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  return emailService.sendEmailWithFallback(options)
}

/**
 * Send order notification email to admin
 * Sends an email to NEXT_PUBLIC_ORDER_EMAIL when a new order is created
 */
export async function sendOrderNotificationEmail(orderData: {
  orderId: string
  orderNumber: string
  referenceId: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  items: Array<{
    productName: string
    variantName?: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  totalAmount: number
  shippingAddress: any
  deliveryOption: string
  paymentMethod: string
  paymentStatus: string
  createdAt: string
}): Promise<EmailResult> {
  const orderEmail = process.env.NEXT_PUBLIC_ORDER_EMAIL

  if (!orderEmail) {
    return {
      success: false,
      error: 'NEXT_PUBLIC_ORDER_EMAIL not configured'
    }
  }

  // Format order items for email
  const itemsHtml = orderData.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${item.productName}</strong>
        ${item.variantName ? `<br><span style="color: #6b7280; font-size: 14px;">${item.variantName}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.unitPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${item.totalPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
    </tr>
  `).join('')

  const itemsText = orderData.items.map(item => 
    `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} - Qty: ${item.quantity} - ${item.unitPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })} each = ${item.totalPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}`
  ).join('\n')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Order Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #111827; margin: 0 0 10px 0;">📦 New Order Received</h2>
        <p style="margin: 0; color: #6b7280;">A new order has been placed and requires your attention.</p>
      </div>

      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #111827; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Order Information</h3>
        
        <table style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 40%;"><strong>Order Number:</strong></td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">#${orderData.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Reference ID:</strong></td>
            <td style="padding: 8px 0; color: #111827;">${orderData.referenceId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Order ID:</strong></td>
            <td style="padding: 8px 0; color: #111827;">${orderData.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Order Date:</strong></td>
            <td style="padding: 8px 0; color: #111827;">${new Date(orderData.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Payment Status:</strong></td>
            <td style="padding: 8px 0;">
              <span style="background: ${orderData.paymentStatus === 'paid' ? '#d1fae5' : '#fef3c7'}; color: ${orderData.paymentStatus === 'paid' ? '#065f46' : '#92400e'}; padding: 4px 12px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 12px;">
                ${orderData.paymentStatus}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Payment Method:</strong></td>
            <td style="padding: 8px 0; color: #111827;">${orderData.paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Delivery Option:</strong></td>
            <td style="padding: 8px 0; color: #111827; text-transform: capitalize;">${orderData.deliveryOption}</td>
          </tr>
        </table>
      </div>

      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #111827; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Customer Information</h3>
        
        <table style="width: 100%;">
          ${orderData.customerName ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 40%;"><strong>Name:</strong></td>
            <td style="padding: 8px 0; color: #111827;">${orderData.customerName}</td>
          </tr>
          ` : ''}
          ${orderData.customerEmail ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; color: #111827;"><a href="mailto:${orderData.customerEmail}" style="color: #2563eb;">${orderData.customerEmail}</a></td>
          </tr>
          ` : ''}
          ${orderData.customerPhone ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;"><strong>Phone:</strong></td>
            <td style="padding: 8px 0; color: #111827;"><a href="tel:${orderData.customerPhone}" style="color: #2563eb;">${orderData.customerPhone}</a></td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #111827; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Shipping Address</h3>
        <p style="margin: 0; color: #111827; line-height: 1.8;">
          ${orderData.shippingAddress.fullName || orderData.shippingAddress.name || 'N/A'}<br>
          ${orderData.shippingAddress.address || orderData.shippingAddress.address1 || ''}<br>
          ${orderData.shippingAddress.city || ''}${orderData.shippingAddress.state || orderData.shippingAddress.region ? `, ${orderData.shippingAddress.state || orderData.shippingAddress.region}` : ''}<br>
          ${orderData.shippingAddress.postalCode || orderData.shippingAddress.postal_code || ''}<br>
          ${orderData.shippingAddress.country || ''}
        </p>
      </div>

      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #111827; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Order Items</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Product</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Unit Price</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 15px 10px; text-align: right; font-weight: 600; color: #111827; border-top: 2px solid #e5e7eb;">Total Amount:</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: 600; font-size: 18px; color: #059669; border-top: 2px solid #e5e7eb;">
                ${orderData.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-top: 20px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          <strong>⚠️ Action Required:</strong> Please review this order and process it accordingly. The customer is waiting for confirmation.
        </p>
      </div>
    </body>
    </html>
  `

  const text = `
New Order Received

A new order has been placed and requires your attention.

ORDER INFORMATION
================
Order Number: #${orderData.orderNumber}
Reference ID: ${orderData.referenceId}
Order ID: ${orderData.orderId}
Order Date: ${new Date(orderData.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
Payment Status: ${orderData.paymentStatus.toUpperCase()}
Payment Method: ${orderData.paymentMethod}
Delivery Option: ${orderData.deliveryOption}

CUSTOMER INFORMATION
===================
${orderData.customerName ? `Name: ${orderData.customerName}` : ''}
${orderData.customerEmail ? `Email: ${orderData.customerEmail}` : ''}
${orderData.customerPhone ? `Phone: ${orderData.customerPhone}` : ''}

SHIPPING ADDRESS
===============
${orderData.shippingAddress.fullName || orderData.shippingAddress.name || 'N/A'}
${orderData.shippingAddress.address || orderData.shippingAddress.address1 || ''}
${orderData.shippingAddress.city || ''}${orderData.shippingAddress.state || orderData.shippingAddress.region ? `, ${orderData.shippingAddress.state || orderData.shippingAddress.region}` : ''}
${orderData.shippingAddress.postalCode || orderData.shippingAddress.postal_code || ''}
${orderData.shippingAddress.country || ''}

ORDER ITEMS
==========
${itemsText}

Total Amount: ${orderData.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}

⚠️ ACTION REQUIRED: Please review this order and process it accordingly. The customer is waiting for confirmation.
  `.trim()

  return sendEmail({
    to: orderEmail,
    subject: `New Order #${orderData.orderNumber} - ${orderData.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}`,
    html,
    text,
    from: `${emailService.getSenderEmail('noreply').name} <${emailService.getSenderEmail('noreply').email}>`,
  })
}



