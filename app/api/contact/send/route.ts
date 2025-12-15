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


    // Option 1: Use SMTP (Cloudflare email) - Primary method
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        })

        const mailOptions = {
          from: `Contact Form <${process.env.SMTP_USER}>`,
          to: contactEmail,
          replyTo: email,
          subject: emailSubject,
          text: emailBody,
          html: emailHtml,
        }

        const info = await transporter.sendMail(mailOptions)
        console.log('Contact form email sent successfully via SMTP:', info.messageId)
        emailSent = true
      } catch (smtpError: any) {
        console.error('SMTP email sending error:', smtpError)
        if (smtpError.code === 'EAUTH') {
          console.error('SMTP Authentication failed. Please check SMTP credentials.')
        }
      }
    }

    // Option 2: Use Resend API (fallback)
    if (!emailSent && process.env.RESEND_API_KEY) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Contact Form <contact@honiccompanystore.com>',
            to: [contactEmail],
            reply_to: email,
            subject: emailSubject,
            text: emailBody,
            html: emailHtml,
          }),
        })

        if (resendResponse.ok) {
          console.log('Contact form email sent successfully via Resend')
          emailSent = true
        }
      } catch (resendError) {
        console.error('Resend email sending error:', resendError)
      }
    }

    // Option 3: Log to console if no email service configured
    if (!emailSent) {
      console.log('=== CONTACT FORM EMAIL ===')
      console.log('To:', contactEmail)
      console.log('From:', email)
      console.log('Subject:', emailSubject)
      console.log('Body:', emailBody)
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

