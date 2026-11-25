import { NextRequest, NextResponse } from 'next/server'
import { sendEmailToCompany } from '@/lib/email-service'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { esc } from '@/lib/email-layout'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** One line: no line breaks (they would let someone add email headers via the subject). */
const line = (max: number, missing = 'Please check the form') =>
  z.string({ error: missing }).trim().max(max).transform((s) => s.replace(/[\r\n\t]+/g, ' '))

const ContactSchema = z.object({
  name: line(120, 'Please enter your name').pipe(z.string().min(1, 'Please enter your name')),
  email: z.string({ error: 'Please enter your email address' }).trim().max(254).email('Please enter a valid email address'),
  phone: line(40).optional().or(z.literal('')),
  subject: line(200, 'Please enter a subject').pipe(z.string().min(1, 'Please enter a subject')),
  message: z.string({ error: 'Please enter a message' }).trim().min(1, 'Please enter a message').max(5000, 'Message is too long (max 5000 characters)'),
  inquiryType: z.enum(['general', 'support', 'sales', 'complaint', 'feedback', 'rfq', 'partnership', 'legal', 'privacy', 'security', 'billing', 'other']).optional().catch('general'),
})

// POST - contact form, quote requests and review submissions -> emailed to the team
export async function POST(request: NextRequest) {
  // Public form: rate limited per visitor (see /api/contact in lib/enhanced-rate-limit.ts)
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/contact/send', reason: limit.reason }, request)
    return NextResponse.json(
      { success: false, error: 'Too many messages. Please wait a while and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 3600) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }

  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Please check the form and try again.' },
      { status: 400 },
    )
  }
  const { name, email, phone, subject, message, inquiryType } = parsed.data
  const kind = (inquiryType || 'general').toUpperCase()

  const text = `New contact form submission

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}\n` : ''}Type: ${kind}

Subject: ${subject}

Message:
${message}

---
Reply directly to: ${email}`

  // Everything the visitor typed is escaped: the team's inbox must never render their HTML or links
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <h2 style="margin:0 0 16px">New contact form submission</h2>
      <table style="background:#f5f5f5;padding:16px;border-radius:8px;width:100%;font-size:14px">
        <tr><td><strong>Name:</strong> ${esc(name)}</td></tr>
        <tr><td><strong>Email:</strong> ${esc(email)}</td></tr>
        ${phone ? `<tr><td><strong>Phone:</strong> ${esc(phone)}</td></tr>` : ''}
        <tr><td><strong>Type:</strong> ${esc(kind)}</td></tr>
      </table>
      <p style="margin:20px 0 8px"><strong>Subject:</strong> ${esc(subject)}</p>
      <div style="padding:16px;border-left:4px solid #ea580c;background:#fff;white-space:pre-wrap;font-size:14px">${esc(message)}</div>
      <p style="color:#6b7280;font-size:12px;margin-top:20px">Reply directly to: ${esc(email)}</p>
    </div>`

  try {
    const result = await sendEmailToCompany({
      inquiryType,
      replyTo: email,
      subject: `[Contact Form] ${kind}: ${subject}`,
      text,
      html,
    })
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'We could not send your message right now. Please try again, or contact us on WhatsApp.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ success: true, message: "Thank you for contacting us. We'll get back to you soon." })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to send message. Please try again.' }, { status: 500 })
  }
}
