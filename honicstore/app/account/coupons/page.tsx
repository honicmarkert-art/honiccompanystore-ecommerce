"use client"

/** Coupons: promotion codes running now. Codes are entered in the cart. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ShoppingCart, Ticket } from 'lucide-react'
import { useCurrency } from '@/contexts/currency-context'

type Promotion = {
  id: string; name: string; code: string; description: string | null
  discount_type: string; discount_value: number; min_purchase_amount: number | null
  max_discount_amount?: number | null; end_date: string
}

const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function CouponsPage() {
  const { formatPrice } = useCurrency()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/promotions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPromotions(Array.isArray(d?.promotions) ? d.promotions : []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 2000) } catch { setCopied(null) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Coupons</h1>
        <p className="mt-1 text-sm text-neutral-500">Codes running now. Enter a code in your <Link href="/cart" className="font-semibold text-orange-600 hover:underline">cart</Link> to get the discount.</p>
      </div>

      {failed && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Could not load coupons. Please refresh the page.</p>}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : promotions.length === 0 && !failed ? (
        <div className={`${card} px-6 py-12 text-center`}>
          <Ticket className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-semibold">No coupons right now</p>
          <p className="mt-1 text-sm text-neutral-500">When a promotion is running, its code shows here.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {promotions.map((p) => {
            const off = p.discount_type === 'percentage' ? `${Number(p.discount_value)}% off` : `${formatPrice(Number(p.discount_value) || 0)} off`
            const terms = [
              p.min_purchase_amount ? `On orders of ${formatPrice(Number(p.min_purchase_amount))} or more` : null,
              p.discount_type === 'percentage' && p.max_discount_amount ? `up to ${formatPrice(Number(p.max_discount_amount))} off` : null,
              `until ${date(p.end_date)}`,
            ].filter(Boolean).join(' · ')
            return (
              <li key={p.id} className={`${card} flex flex-col p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-black text-orange-600">{off}</p>
                    <p className="mt-0.5 font-semibold">{p.name}</p>
                  </div>
                  <Ticket className="h-6 w-6 shrink-0 text-orange-300" />
                </div>
                {p.description && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{p.description}</p>}
                <p className="mt-2 text-xs text-neutral-500">{terms.charAt(0).toUpperCase() + terms.slice(1)}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-neutral-200 pt-4 dark:border-neutral-700">
                  <span className="rounded-lg border border-dashed border-orange-300 px-3 py-2 font-mono font-bold tracking-wider dark:border-orange-800">{p.code}</span>
                  <button onClick={() => copy(p.code)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800">
                    {copied === p.code ? <><Check className="h-4 w-4 text-emerald-600" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
                  </button>
                  <Link href="/cart" className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"><ShoppingCart className="h-4 w-4" /> Cart</Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
