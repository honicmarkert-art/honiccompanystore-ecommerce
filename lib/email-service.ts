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
      console.log('Using Resend SMTP with username "resend"')
    } else if (!smtpUser || !smtpUser.includes('@')) {
      // For other SMTP providers, username must be a valid email
      console.warn('SMTP_USER must be a valid email address for non-Resend SMTP providers')
      this.transporter = null
      this.initialized = true
      return
    }

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.warn('SMTP configuration incomplete. Email sending will be disabled.')
      console.warn('Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD')
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

      console.log('SMTP transporter initialized successfully')
      if (isResendSmtp) {
        console.log('Resend SMTP: Using sender email configs for "from" addresses')
      }
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize SMTP transporter:', error)
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
      // Use sender email configs (prioritize noreply for automated emails)
      senderEmail = process.env.SMTP_SENDER_EMAIL_NOREPLY || 
                    process.env.SMTP_SENDER_EMAIL_INFO || 
                    process.env.SMTP_SENDER_EMAIL_SUPPORT || 
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

    // Get sender name from config
    const senderName = process.env.SMTP_SENDER_NAME_NOREPLY || 
                       process.env.SMTP_SENDER_NAME_INFO || 
                       process.env.SMTP_SENDER_NAME_SUPPORT || 
                       'Honic Company Store'

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
      
      console.log('Email sent successfully via SMTP:', info.messageId)
      
      return {
        success: true,
        messageId: info.messageId
      }
    } catch (error: any) {
      console.error('SMTP email sending error:', error)
      
      if (error.code === 'EAUTH') {
        console.error('SMTP Authentication failed. Please check:')
        console.error('1. SMTP_USER (email address) is correct')
        console.error('2. SMTP_PASSWORD is correct')
        console.error('3. SMTP_HOST matches your email provider')
        console.error('4. If using Gmail, use an App Password instead of regular password')
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

    // Get sender email for Resend fallback
    const senderConfig = this.getSenderEmail('noreply')
    const smtpUser = senderConfig.email

    if (!smtpUser || !smtpUser.includes('@')) {
      return {
        success: false,
        error: 'SMTP_USER or SMTP_SENDER_EMAIL_NOREPLY is not configured. Cannot use Resend fallback without a valid sender email.'
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
      const resendResponse = await fetch('https://api.resend.com/emails', {
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
        console.log('Email sent successfully via Resend:', data.id)
        return {
          success: true,
          messageId: data.id
        }
      } else {
        const errorData = await resendResponse.json()
        console.error('Resend API error:', errorData)
        return {
          success: false,
          error: errorData.message || 'Resend API error'
        }
      }
    } catch (error: any) {
      console.error('Resend email sending error:', error)
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
    console.log('SMTP failed, trying Resend as fallback...')
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
        // For Resend: use sender email configs
        return process.env.SMTP_SENDER_EMAIL_NOREPLY || 
               process.env.SMTP_SENDER_EMAIL_INFO || 
               process.env.SMTP_SENDER_EMAIL_SUPPORT || 
               'noreply@mail.honiccompanystore.com'
      }
      // For other providers: use SMTP_USER if it's a valid email
      return smtpUser
    }

    switch (emailType) {
      case 'support':
        return {
          email: process.env.SMTP_SENDER_EMAIL_SUPPORT || getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_SUPPORT || 'Honic Co'
        }
      case 'info':
        return {
          email: process.env.SMTP_SENDER_EMAIL_INFO || getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_INFO || 'Honic Co'
        }
      case 'noreply':
        return {
          email: process.env.SMTP_SENDER_EMAIL_NOREPLY || getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_NOREPLY || 'Honic Co'
        }
      default:
        return {
          email: getValidSenderEmail(),
          name: process.env.SMTP_SENDER_NAME_NOREPLY || process.env.SMTP_SENDER_NAME_INFO || 'Honic Co'
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



