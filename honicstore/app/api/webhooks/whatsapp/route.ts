import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSupabaseClient } from '@/lib/supabase-server'
import { sendTextIfWindowOpen } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Meta WhatsApp webhook.
 *  GET  : subscription check (hub.verify_token must equal WHATSAPP_VERIFY_TOKEN)
 *  POST : signed by Meta (X-Hub-Signature-256 = HMAC-SHA256 of the body with WHATSAPP_APP_SECRET).
 *         - incoming messages: opens the 24 h reply window; STOP / ACHA / SITISHA opt out of offers,
 *           START / ANZA opt back in (both confirmed with a short reply)
 *         - statuses: sent / delivered / read / failed are saved on whatsapp_messages
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (token && sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === token) {
    return new NextResponse(sp.get('hub.challenge') || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

function signedByMeta(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(raw).digest('hex'))
  const got = Buffer.from(header)
  return expected.length === got.length && timingSafeEqual(expected, got)
}

const STOP = /^(stop|unsubscribe|acha|sitisha|simamisha)$/i
const START = /^(start|subscribe|anza|endelea)$/i

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!signedByMeta(raw, request.headers.get('x-hub-signature-256'))) return new NextResponse('Invalid signature', { status: 401 })
  let body: any // eslint-disable-line @typescript-eslint/no-explicit-any -- Meta's payload shape
  try { body = JSON.parse(raw) } catch { return new NextResponse('Bad JSON', { status: 400 }) }
  const supabase = getSupabaseClient()
  const now = new Date().toISOString()

  try {
    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const v = change?.value || {}
        // delivery statuses for messages we sent
        for (const s of v.statuses || []) {
          if (!s?.id) continue
          const error = s.errors?.[0] ? `${s.errors[0].code}: ${s.errors[0].title || s.errors[0].message || ''}`.slice(0, 300) : null
          await supabase.from('whatsapp_messages').update({ status: s.status, error, updated_at: now }).eq('wa_message_id', s.id)
        }
        // incoming messages
        for (const m of v.messages || []) {
          const phone = String(m?.from || '').replace(/\D/g, '')
          if (!phone) continue
          const name = v.contacts?.find((c: { wa_id?: string }) => c.wa_id === phone)?.profile?.name || null
          const { data: existing } = await supabase.from('whatsapp_contacts').select('phone').eq('phone', phone).maybeSingle()
          const base = { phone, last_inbound_at: now, updated_at: now, ...(name ? { name } : {}) }
          await (existing ? supabase.from('whatsapp_contacts').update(base).eq('phone', phone) : supabase.from('whatsapp_contacts').insert({ ...base, source: 'whatsapp' }))

          const word = String(m?.text?.body || m?.button?.text || '').trim()
          if (STOP.test(word)) {
            await supabase.from('whatsapp_contacts').update({ marketing_opt_in: false, opted_out_at: now }).eq('phone', phone)
            await sendTextIfWindowOpen(phone, 'Umeondolewa kwenye ofa za WhatsApp. Utaendelea kupata taarifa za oda zako tu. Tuma ANZA kurudi.\nYou will no longer get offers on WhatsApp. Order updates continue. Send START to join again.', { kind: 'opt_out' })
          } else if (START.test(word)) {
            await supabase.from('whatsapp_contacts').update({ marketing_opt_in: true, marketing_opted_in_at: now, opted_out_at: null }).eq('phone', phone)
            await sendTextIfWindowOpen(phone, 'Karibu tena! Utapata ofa na bidhaa mpya za Honic. Tuma STOP kusitisha wakati wowote.\nYou will get Honic offers and new arrivals. Send STOP any time to stop.', { kind: 'opt_in' })
          }
        }
      }
    }
  } catch (error) {
    logger.error('WhatsApp webhook failed:', error)
  }
  // always 200 so Meta does not keep retrying
  return NextResponse.json({ received: true })
}
