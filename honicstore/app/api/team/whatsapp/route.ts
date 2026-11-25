import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/team-auth'
import { WA_TEMPLATES, listTemplates, whatsappEnabled } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/team/whatsapp (admins): set-up status, templates (with Meta approval), audience, recent messages. */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const supabase = getSupabaseClient()
  const [templates, updates, marketing, recent] = await Promise.all([
    listTemplates(),
    supabase.from('whatsapp_contacts').select('phone', { count: 'exact', head: true }).eq('updates_opt_in', true),
    supabase.from('whatsapp_contacts').select('phone', { count: 'exact', head: true }).eq('marketing_opt_in', true),
    supabase.from('whatsapp_messages').select('phone, kind, template, ref, status, error, created_at').order('created_at', { ascending: false }).limit(30),
  ])
  const required = Object.values(WA_TEMPLATES).map((name) => {
    const t = templates.templates.find((x) => x.name === name)
    return { name, status: t?.status || 'MISSING' }
  })
  return NextResponse.json({
    configured: whatsappEnabled(),
    webhook: { verifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN, appSecret: !!process.env.WHATSAPP_APP_SECRET },
    templatesError: templates.error || null,
    required,
    marketingTemplates: templates.templates.filter((t) => t.category === 'MARKETING'),
    audience: { orderUpdates: updates.count || 0, offers: marketing.count || 0 },
    recent: (recent.data || []).map((m) => ({ ...m, phone: `${m.phone.slice(0, 6)}•••${m.phone.slice(-3)}` })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
