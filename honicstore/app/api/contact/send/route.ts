import { NextRequest, NextResponse } from 'next/server'
import { sendEmailToCompany, emailService } from '@/lib/email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST - Send contact form email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, subject, message, inquiryType } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create email content
    const emailSubject = `[Contact Form] ${inquiryType ? inquiryType.toUpperCase() : 'GENERAL'}: ${subject}`
    const emailBody = `
New Contact Form Submission

Contact Information:
- Name: ${name}
- Email: ${email}
${phone ? `- Phone: ${phone}` : ''}
- Inquiry Type: ${inquiryType || 'General'}

Subject: ${subject}

Message:
${message}

---
This is an automated message from the Contact Form System.
Please respond directly to: ${email}
    `.trim()

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Contact Information:</strong></p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
            <li><strong>Inquiry Type:</strong> ${inquiryType || 'General'}</li>
          </ul>
        </div>
        <div style="margin: 20px 0;">
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background: #fff; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message from the Contact Form System.<br>
          Please respond directly to: <a href="mailto:${email}">${email}</a>
        </p>
      </div>
    `

    // Send email using centralized email service (SMTP from .env.local)
    const emailResult = await sendEmailToCompany({
      inquiryType,
      replyTo: email,
      subject: emailSubject,
      text: emailBody,
      html: emailHtml,
    })

    // Log to console if email service not configured (development)
    if (!emailResult.success) {
      console.log('=== CONTACT FORM EMAIL ===')
      console.log('To:', emailService.getContactEmailByType(inquiryType))
      console.log('From:', email)
      console.log('Subject:', emailSubject)
      console.log('Body:', emailBody)
      console.log('Error:', emailResult.error)
      console.log('=========================')
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for contacting us. We\'ll get back to you within 24 hours.'
    })

  } catch (error: any) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send message. Please try again.' },
      { status: 500 }
    )
  }
}
