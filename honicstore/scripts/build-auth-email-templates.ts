/**
 * Builds the Supabase Auth email templates from the shared Honic email layout.
 *
 *   npx tsx scripts/build-auth-email-templates.ts
 *
 * Writes database/email-templates/*.html. Paste them into Supabase:
 * Dashboard > Authentication > Emails > Templates (or apply them with the Management API).
 * The {{ .ConfirmationURL }} / {{ .Email }} tags are filled in by Supabase when it sends the email.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderEmail, button, callout, paragraph, BRAND } from '../lib/email-layout'

const SITE = 'https://honiccompanystore.com'
const SUPPORT = process.env.SUPPORT_EMAIL || 'support@honiccompanystore.com'
const STORE = 'Honic Company Store'

const confirmSignup = renderEmail({
  preheader: 'One quick step: confirm your email to activate your Honic account.',
  eyebrow: 'Confirm your email',
  title: 'Verify your email to get started',
  siteUrl: SITE,
  supportEmail: SUPPORT,
  companyName: STORE,
  body: `
    ${paragraph(`Thanks for signing up! Please confirm that <strong style="color:${BRAND.ink}">{{ .Email }}</strong> is your email address. It takes one click.`)}
    ${button('Verify email address', '{{ .ConfirmationURL }}')}
    ${callout('This link expires in 24 hours', 'It works once. If it has expired, sign in again and we&rsquo;ll send you a new one.', 'slate')}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted}">Button not working? Copy this link into your browser:<br>
      <a href="{{ .ConfirmationURL }}" style="color:${BRAND.orange};word-break:break-all">{{ .ConfirmationURL }}</a></p>
  `,
  footnote: `Didn&rsquo;t create an account? You can safely ignore this email. Nobody can use your address without clicking the link.`,
})

const outDir = join(process.cwd(), 'database', 'email-templates')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'confirm-signup.html'), confirmSignup)
console.log('wrote database/email-templates/confirm-signup.html  (subject: "Confirm your email for Honic")')
