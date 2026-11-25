"use client"

/** Messages: order and account notices for this shopper (from /api/notifications). */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, CheckCheck, CreditCard, Info, Loader2, Trash2, UserCheck } from 'lucide-react'

type Notice = {
  id: string; title: string; message: string; type: string; is_read: boolean; created_at: string
  metadata?: { action_url?: string } | null
}

const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const ICON: Record<string, typeof Bell> = { payment_received: CreditCard, account_activated: UserCheck, info: Info }

function ago(iso: string, now: number) {
  const s = (now - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
/** only follow links inside the store */
const inside = (url?: string) => (url && url.startsWith('/') && !url.startsWith('//') ? url : null)

export default function MessagesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/notifications?limit=100', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error()
      setNotices(data.notifications || [])
    } catch {
      setError('Could not load your messages.')
    } finally {
      setNow(Date.now())
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- first load; state is set after the request

  const act = async (key: string, fn: () => Promise<Response>, apply: () => void) => {
    setBusy(key); setError('')
    try {
      const res = await fn()
      if (!res.ok) throw new Error()
      apply()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const markRead = (id: string) => act(`read-${id}`,
    () => fetch(`/api/notifications/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: true }) }),
    () => setNotices((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n))))
  const markAll = () => act('all',
    () => fetch('/api/notifications/mark-all-read', { method: 'POST', credentials: 'include' }),
    () => setNotices((list) => list.map((n) => ({ ...n, is_read: true }))))
  const remove = (id: string) => act(`rm-${id}`,
    () => fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' }),
    () => setNotices((list) => list.filter((n) => n.id !== id)))

  const unread = notices.filter((n) => !n.is_read).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Messages</h1>
          <p className="mt-1 text-sm text-neutral-500">{unread ? `${unread} unread · ` : ''}Notices about your orders, payments and account.</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} disabled={busy === 'all'} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-neutral-200 hover:ring-orange-400 disabled:opacity-60 dark:bg-neutral-900 dark:ring-neutral-800">
            {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Mark all as read
          </button>
        )}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error} <button onClick={load} className="font-semibold underline">Reload</button></p>}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : notices.length === 0 && !error ? (
        <div className={`${card} px-6 py-12 text-center`}>
          <Bell className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-semibold">No messages</p>
          <p className="mt-1 text-sm text-neutral-500">When something happens with your orders or account, we tell you here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notices.map((n) => {
            const Icon = ICON[n.type] || Bell
            const link = inside(n.metadata?.action_url)
            return (
              <li key={n.id} className={`${card} flex gap-3 p-4 sm:gap-4 sm:p-5 ${n.is_read ? '' : 'ring-orange-300 dark:ring-orange-900'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.is_read ? 'bg-stone-100 text-neutral-500 dark:bg-neutral-800' : 'bg-orange-50 text-orange-600 dark:bg-orange-950/40'}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold">{!n.is_read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-orange-500" aria-label="Unread" />}{n.title}</p>
                    <time dateTime={n.created_at} className="text-xs text-neutral-500">{now ? ago(n.created_at, now) : ''}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-neutral-600 dark:text-neutral-300">{n.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {link && <Link href={link} onClick={() => { if (!n.is_read) markRead(n.id) }} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-orange-600">Open <ArrowRight className="h-4 w-4" /></Link>}
                    {!n.is_read && (
                      <button onClick={() => markRead(n.id)} disabled={busy === `read-${n.id}`} className="rounded-xl bg-stone-100 px-3.5 py-2 text-sm font-semibold hover:bg-stone-200 disabled:opacity-60 dark:bg-neutral-800">Mark as read</button>
                    )}
                    <button onClick={() => remove(n.id)} disabled={busy === `rm-${n.id}`} aria-label={`Delete message: ${n.title}`} className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/30">
                      {busy === `rm-${n.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
