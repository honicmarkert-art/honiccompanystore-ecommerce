import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/team-auth'
import { listTemplates, placeholderCount, sendTemplate, waPhone, whatsappEnabled } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/team/whatsapp/campaign (admins): an offer / ad / news message with an APPROVED MARKETING
 * template, only to customers who opted in to WhatsApp offers (STOP removes them automatically).
 *   { template, body: string[], header?: url (image/video/document), button?: string, mode: 'count'|'test'|'send', testPhone? }
 * "{name}" in any value becomes the customer's first name.
 */
const Body = z.object({
  template: z.string().min(1).max(512),
  body: z.array(z.string().max(1000)).max(20).default([]),
  header: z.string().url().optional().or(z.literal('')),
  button: z.string().max(500).optional().default(''),
  mode: z.enum(['count', 'test', 'send']),
  testPhone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  if (!whatsappEnabled()) return NextResponse.json({ error: 'WhatsApp is not set up yet (add the API keys).' }, { status: 400 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the fields' }, { status: 400 })
  const b = parsed.data

  const { templates, error } = await listTemplates()
  const t = templates.find((x) => x.name === b.template)
  if (!t) return NextResponse.json({ error: error || 'Template not found in WhatsApp Manager' }, { status: 400 })
  if (t.category !== 'MARKETING') return NextResponse.json({ error: 'Campaigns must use a MARKETING template.' }, { status: 400 })
  if (t.status !== 'APPROVED') return NextResponse.json({ error: `Template is ${t.status}, not approved yet.` }, { status: 400 })

  const bodyText = t.components.find((c) => c.type === 'BODY')?.text
  const need = placeholderCount(bodyText)
  if (b.body.filter((x) => x.trim()).length < need) return NextResponse.json({ error: `Fill all ${need} text fields.` }, { status: 400 })
  const header = t.components.find((c) => c.type === 'HEADER')
  const mediaFormat = header?.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format) ? header.format.toLowerCase() : null
  if (mediaFormat && !b.header) return NextResponse.json({ error: `This template needs a ${mediaFormat} link.` }, { status: 400 })
  const urlButton = t.components.find((c) => c.type === 'BUTTONS')?.buttons?.findIndex((x) => x.type === 'URL' && /\{\{1\}\}/.test(x.url || ''))

  const build = (name: string) => {
    const fill = (v: string) => v.replace(/\{name\}/gi, name || 'Mteja')
    const components: Record<string, unknown>[] = []
    if (mediaFormat) components.push({ type: 'header', parameters: [{ type: mediaFormat, [mediaFormat]: { link: b.header } }] })
    if (need) components.push({ type: 'body', parameters: b.body.slice(0, need).map((v) => ({ type: 'text', text: fill(v) })) })
    if (urlButton != null && urlButton >= 0) components.push({ type: 'button', sub_type: 'url', index: String(urlButton), parameters: [{ type: 'text', text: fill(b.button || '') }] })
    return components
  }

  const supabase = getSupabaseClient()
  const { data: contacts } = await supabase.from('whatsapp_contacts').select('phone, name').eq('marketing_opt_in', true).limit(5000)
  const audience = contacts || []
  if (b.mode === 'count') return NextResponse.json({ recipients: audience.length })

  const campaignId = `C${Date.now().toString(36).toUpperCase()}`
  if (b.mode === 'test') {
    const phone = waPhone(b.testPhone || '')
    if (!phone) return NextResponse.json({ error: 'Enter a valid test phone number' }, { status: 400 })
    const r = await sendTemplate(phone, t.name, build('Test'), { kind: 'campaign_test', ref: campaignId })
    return NextResponse.json({ sent: r.ok ? 1 : 0, error: r.error })
  }

  let sent = 0, failed = 0
  for (const c of audience) {
    const r = await sendTemplate(c.phone, t.name, build(String(c.name || '').split(/\s+/)[0]), { kind: 'campaign', ref: campaignId })
    if (r.ok) sent++; else failed++
    await new Promise((res) => setTimeout(res, 120)) // stay well under Meta's rate limits
  }
  logger.log(`WhatsApp campaign ${campaignId} (${t.name}): sent ${sent}, failed ${failed}`)
  return NextResponse.json({ campaignId, recipients: audience.length, sent, failed })
}
