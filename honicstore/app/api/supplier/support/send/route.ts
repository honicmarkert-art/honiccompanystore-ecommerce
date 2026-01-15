import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendEmail, emailService } from '@/lib/email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST - Send support request email
export async function POST(request: NextRequest) {
  try {
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile for company name
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, full_name, email')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const { subject, message, category } = body

    if (!subject || !message || !category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Support email address (configured via environment variable)
    const fromEmail = user.email || profile?.email || process.env.NOREPLY_EMAIL || process.env.SMTP_SENDER_EMAIL_NOREPLY || 'noreply@honiccompanystore.com'
    const supplierName = profile?.company_name || profile?.full_name || 'Supplier'
    const supportEmail = emailService.getCompanyEmails().support

    // Create email content
    const emailSubject = `[Supplier Support] ${category.toUpperCase()}: ${subject}`
    const emailBody = `
New Support Request from Supplier

Supplier Information:
- Name: ${supplierName}
- Email: ${fromEmail}
- User ID: ${user.id}

Category: ${category.charAt(0).toUpperCase() + category.slice(1)}
Subject: ${subject}

Message:
${message}

---
This is an automated message from the Supplier Support System.
Please respond directly to: ${fromEmail}
    `.trim()

    // Store support ticket in database (optional - for tracking)
    try {
      const { error: ticketError } = await supabase
        .from('supplier_support_tickets')
        .insert({
          supplier_id: user.id,
          category,
          subject,
          message,
          status: 'open',
          created_at: new Date().toISOString()
        })
      
      if (ticketError) {
        // Continue even if database storage fails
      }
    } catch (dbError) {
      // If table doesn't exist or other database error, continue without storing
    }

    // Create HTML email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Support Request from Supplier</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Supplier Information:</strong></p>
          <ul>
            <li><strong>Name:</strong> ${supplierName}</li>
            <li><strong>Email:</strong> ${fromEmail}</li>
            <li><strong>User ID:</strong> ${user.id}</li>
          </ul>
        </div>
        <div style="margin: 20px 0;">
          <p><strong>Category:</strong> ${category.charAt(0).toUpperCase() + category.slice(1)}</p>
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background: #fff; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message from the Supplier Support System.<br>
          Please respond directly to: <a href="mailto:${fromEmail}">${fromEmail}</a>
        </p>
      </div>
    `

    // Send email using centralized email service (SMTP from .env.local with Resend fallback)
    const senderConfig = emailService.getSenderEmail('support')
    
    const emailResult = await sendEmail({
      to: supportEmail,
      replyTo: fromEmail,
      subject: emailSubject,
      text: emailBody,
      html: emailHtml,
      from: `${senderConfig.name} <${senderConfig.email}>`,
    })

    // Log to console if email service not configured (development)
    if (!emailResult.success) {
      }

    return NextResponse.json({
      success: true,
      message: 'Support request sent successfully. We will get back to you within 24-48 hours.'
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to send support request. Please try again.' },
      { status: 500 }
    )
  }
}

