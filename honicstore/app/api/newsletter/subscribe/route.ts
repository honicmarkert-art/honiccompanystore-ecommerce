import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendEmail, emailService } from '@/lib/email-service'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { logger } from '@/lib/logger'

// Rate limit logging helper
const logRateLimitEvent = (endpoint: string, reason: string | undefined, request: NextRequest) => {
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown'
  logger.security(`Rate limit exceeded on ${endpoint}`, undefined, {
    ip: clientIP,
    reason,
    path: request.nextUrl.pathname
  })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST - Subscribe to newsletter
export async function POST(request: NextRequest) {
  // Rate limiting - stricter for newsletter subscription
  const rateLimitResult = enhancedRateLimit(request)
  if (!rateLimitResult.allowed) {
    logRateLimitEvent('/api/newsletter/subscribe', rateLimitResult.reason, request)
    
    return NextResponse.json(
      { 
        success: false,
        error: rateLimitResult.reason || 'Too many subscription attempts. Please try again later.' 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    )
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    // Store subscription in database
    try {
      const { error: dbError } = await supabase
        .from('newsletter_subscriptions')
        .insert({
          email: email.toLowerCase().trim(),
          subscribed_at: new Date().toISOString(),
          status: 'active'
        })
      
      if (dbError) {
        // If email already exists, that's okay - just log it
        if (dbError.code === '23505') { // Unique constraint violation
          } else {
          }
      }
    } catch (dbError) {
      // Database error - continue without storing
    }

    // Send notification email to promotion email (from .env.local)
    const promotionEmail = emailService.getCompanyEmails().promotion
    const emailSubject = `New Newsletter Subscription: ${email}`
    const emailBody = `
New Newsletter Subscription

Email: ${email}
Subscribed At: ${new Date().toLocaleString()}

---
This is an automated notification from the Newsletter Subscription System.
    `.trim()

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Newsletter Subscription</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subscribed At:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from the Newsletter Subscription System.
        </p>
      </div>
    `

    // Get sender email (handle Resend SMTP case where SMTP_USER="resend")
    const smtpUserAuth = process.env.SMTP_USER
    const isResendSmtp = process.env.SMTP_HOST?.includes('resend.com') || smtpUserAuth?.toLowerCase() === 'resend'
    
    let senderEmail: string
    if (isResendSmtp || !smtpUserAuth || smtpUserAuth.toLowerCase() === 'resend' || !smtpUserAuth.includes('@')) {
      // Use sender email configs for Resend SMTP
      senderEmail = process.env.SMTP_SENDER_EMAIL_INFO || 
                    process.env.SMTP_SENDER_EMAIL_NOREPLY || 
                    process.env.SMTP_SENDER_EMAIL_SUPPORT || 
                    process.env.NOREPLY_EMAIL || process.env.SMTP_SENDER_EMAIL_NOREPLY || 'noreply@mail.honiccompanystore.com'
    } else {
      senderEmail = smtpUserAuth
    }

    if (!senderEmail || !senderEmail.includes('@')) {
      // Still return success for subscription, just without email notification
      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed to newsletter!'
      })
    }

    // Get sender name
    const senderName = process.env.SMTP_SENDER_NAME_INFO || 
                       process.env.SMTP_SENDER_NAME_NOREPLY || 
                       'Honic Co'

    // Send notification email to company (from .env.local)
    const emailResult = await sendEmail({
      to: promotionEmail,
      subject: emailSubject,
      text: emailBody,
      html: emailHtml,
      from: `${senderName} <${senderEmail}>`,
    })

    // Send welcome email to subscriber
    try {
      const { sendNewsletterWelcomeEmail } = await import('@/lib/user-email-service')
      const { buildUrl } = await import('@/lib/url-utils')
      const unsubscribeUrl = buildUrl(`/account/newsletter/unsubscribe?email=${encodeURIComponent(email)}`)
      await sendNewsletterWelcomeEmail(email, unsubscribeUrl)
    } catch (welcomeEmailError) {
      logger.warn('Failed to send newsletter welcome email:', welcomeEmailError)
      // Don't fail subscription if welcome email fails
    }

    // Log to console if email service not configured (development)
    if (!emailResult.success) {
      }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to newsletter!'
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    )
  }
}


