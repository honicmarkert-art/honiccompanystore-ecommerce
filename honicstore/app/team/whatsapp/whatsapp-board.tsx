"use client"

/** Team page: WhatsApp set-up status, required templates, offers campaigns (opted-in customers only), recent messages. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Megaphone, MessageCircle, RefreshCw, Send, Users, XCircle } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

type Tpl = { name: string; status: string; category: string; language: string; components: { type: string; format?: string; text?: string; buttons?: { type: string; text: string; url?: string }[] }[] }
type Status = {
  configured: boolean; webhook: { verifyToken: boolean; appSecret: boolean }; templatesError: string | null
  required: { name: string; status: string }[]; marketingTemplates: Tpl[]; audience: { orderUpdates: number; offers: number }
  recent: { phone: string; kind: string; template: string | null; ref: string | null; status: string; error: string | null; created_at: string }[]
}
const card = 'rounded-2xl bg-white p-5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const field = 'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-neutral-700 dark:bg-neutral-900'
const pill = (s: string) => s === 'APPROVED' || s === 'read' || s === 'delivered' ? 'bg-emerald-50 text-emerald-700' : s === 'MISSING' || s === 'REJECTED' || s === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'

export function WhatsAppBoard() {
  const [data, setData] = useState<Status | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')
  const [tplName, setTplName] = useState('')
  const [body, setBody] = useState<string[]>([])
  const [header, setHeader] = useState('')
  const [button, setButton] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/team/whatsapp', { cache: 'no-store', credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setState('denied'); return }
      if (!res.ok) throw new Error()
      setData(await res.json()); setState('ready')
    } catch { setState('error') }
  }, [])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- first load

  const tpl = useMemo(() => data?.marketingTemplates.find((t) => t.name === tplName) || null, [data, tplName])
  const bodyText = tpl?.components.find((c) => c.type === 'BODY')?.text || ''
  const slots = [...new Set([...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b)
  const media = tpl?.components.find((c) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format || ''))?.format
  const urlBtn = tpl?.components.find((c) => c.type === 'BUTTONS')?.buttons?.find((x) => x.type === 'URL' && /\{\{1\}\}/.test(x.url || ''))
  const preview = bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => (body[Number(n) - 1] || `{{${n}}}`).replace(/\{name\}/gi, 'Asha'))

  const run = async (mode: 'count' | 'test' | 'send') => {
    if (mode === 'send' && !window.confirm('Send this to every customer who opted in to WhatsApp offers?')) return
    setBusy(mode); setMsg(null)
    try {
      const res = await fetch('/api/team/whatsapp/campaign', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: tplName, body: slots.map((n) => body[n - 1] || ''), header, button, mode, testPhone }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed')
      setMsg({ tone: 'ok', text: mode === 'count' ? `${d.recipients} customers would get it.` : mode === 'test' ? (d.sent ? 'Test sent. Check the phone.' : `Test not sent: ${d.error}`) : `Sent ${d.sent} of ${d.recipients}${d.failed ? ` (${d.failed} failed, see recent messages)` : ''}.` })
      if (mode !== 'count') load()
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Failed' })
    } finally { setBusy(null) }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl"><MessageCircle className="h-7 w-7 text-emerald-600" /> WhatsApp</h1>
            <p className="mt-1 text-sm text-neutral-500">Order messages go automatically. Use campaigns for offers and news (opted-in customers only). <Link href="/team/offers" className="font-semibold text-orange-600 hover:underline">Price offers →</Link></p>
          </div>
          <button onClick={() => { setState('loading'); load() }} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>

        {state === 'loading' ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
          : state === 'denied' ? <p className={`${card} mt-6 text-sm`}>This page is for Honic admins. <Link href="/auth/login?redirect=/team/whatsapp" className="font-semibold text-orange-600 hover:underline">Sign in with an admin account</Link>.</p>
            : state === 'error' || !data ? <p className={`${card} mt-6 text-sm text-red-600`}>Could not load. <button onClick={load} className="underline">Try again</button></p>
              : (
                <div className="mt-6 space-y-5">
                  {/* status */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={card}><p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">API</p><p className={`mt-1 flex items-center gap-2 font-bold ${data.configured ? 'text-emerald-700' : 'text-red-600'}`}>{data.configured ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{data.configured ? 'Connected' : 'Not set up'}</p><p className="mt-1 text-xs text-neutral-500">Webhook: {data.webhook.verifyToken && data.webhook.appSecret ? 'ready' : 'add verify token + app secret'}</p></div>
                    <div className={card}><p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Order updates opt-in</p><p className="mt-1 flex items-center gap-2 text-2xl font-black"><Users className="h-5 w-5 text-neutral-400" />{data.audience.orderUpdates}</p></div>
                    <div className={card}><p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Offers opt-in</p><p className="mt-1 flex items-center gap-2 text-2xl font-black"><Megaphone className="h-5 w-5 text-neutral-400" />{data.audience.offers}</p></div>
                  </div>

                  {/* required templates */}
                  <section className={card}>
                    <h2 className="font-bold">Order message templates</h2>
                    <p className="mt-1 text-sm text-neutral-500">Create these in WhatsApp Manager with exactly these names (texts in docs/WHATSAPP_TEMPLATES.md). Messages start once they are approved.</p>
                    {data.templatesError && <p className="mt-2 text-sm text-amber-700">{data.templatesError}</p>}
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {data.required.map((r) => <li key={r.name} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 text-sm dark:bg-neutral-800"><span className="font-mono">{r.name}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill(r.status)}`}>{r.status}</span></li>)}
                    </ul>
                  </section>

                  {/* campaign */}
                  <section className={card}>
                    <h2 className="flex items-center gap-2 font-bold"><Megaphone className="h-5 w-5 text-orange-600" /> Offers campaign</h2>
                    <p className="mt-1 text-sm text-neutral-500">Uses an approved MARKETING template. Goes only to the {data.audience.offers} customers who opted in; they can reply STOP. Write <span className="font-mono">{'{name}'}</span> to use each customer&apos;s first name.</p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <label className="block text-sm"><span className="mb-1 block font-semibold">Template</span>
                          <select value={tplName} onChange={(e) => { setTplName(e.target.value); setBody([]); setHeader(''); setButton('') }} className={field}>
                            <option value="">Choose…</option>
                            {data.marketingTemplates.map((t) => <option key={t.name + t.language} value={t.name} disabled={t.status !== 'APPROVED'}>{t.name} ({t.language}) {t.status !== 'APPROVED' ? `· ${t.status}` : ''}</option>)}
                          </select>
                        </label>
                        {media && <label className="block text-sm"><span className="mb-1 block font-semibold">{media.toLowerCase()} link (https)</span><input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="https://…" className={field} /></label>}
                        {slots.map((n) => <label key={n} className="block text-sm"><span className="mb-1 block font-semibold">Text {`{{${n}}}`}</span><input value={body[n - 1] || ''} onChange={(e) => setBody((b) => { const c = [...b]; c[n - 1] = e.target.value; return c })} className={field} /></label>)}
                        {urlBtn && <label className="block text-sm"><span className="mb-1 block font-semibold">Button link ending ({urlBtn.url})</span><input value={button} onChange={(e) => setButton(e.target.value)} placeholder="e.g. products/270" className={field} /></label>}
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold">Preview</p>
                        <div className="rounded-2xl bg-[#e7ffdb] p-4 text-sm leading-6 text-neutral-800 shadow-inner dark:bg-emerald-950/40 dark:text-emerald-50">
                          {tpl ? <p className="whitespace-pre-line">{preview}</p> : <p className="text-neutral-500">Choose a template.</p>}
                          {urlBtn && <p className="mt-3 border-t border-emerald-200 pt-2 text-center font-semibold text-sky-700">{urlBtn.text}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button onClick={() => run('count')} disabled={!tplName || !!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 disabled:opacity-50 dark:bg-neutral-800">{busy === 'count' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Count</button>
                      <span className="inline-flex items-center rounded-xl ring-1 ring-neutral-300 dark:ring-neutral-700">
                        <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Test phone 07…" className="h-10 w-36 rounded-l-xl bg-transparent px-3 text-sm outline-none" />
                        <button onClick={() => run('test')} disabled={!tplName || !!busy} className="h-10 rounded-r-xl bg-neutral-900 px-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">{busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send test'}</button>
                      </span>
                      <button onClick={() => run('send')} disabled={!tplName || !!busy || !data.configured} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to {data.audience.offers}</button>
                    </div>
                    {msg && <p role={msg.tone === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${msg.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{msg.text}</p>}
                  </section>

                  {/* recent */}
                  <section className={card}>
                    <h2 className="font-bold">Recent messages</h2>
                    {data.recent.length === 0 ? <p className="mt-2 text-sm text-neutral-500">Nothing sent yet.</p> : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wider text-neutral-500"><tr><th className="py-2">When</th><th>To</th><th>Message</th><th>Ref</th><th>Status</th></tr></thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {data.recent.map((m, i) => (
                              <tr key={i}><td className="py-2 text-neutral-500">{new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td className="font-mono text-xs">{m.phone}</td><td>{m.template || m.kind}</td><td className="text-xs text-neutral-500">{m.ref}</td><td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill(m.status)}`} title={m.error || ''}>{m.status}</span></td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
      </main>
      <SiteFooter />
    </div>
  )
}
