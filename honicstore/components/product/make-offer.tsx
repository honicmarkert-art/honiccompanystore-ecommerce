"use client"

/**
 * "Make an offer / Omba punguzo": the shopper proposes a price, the offer is saved (so the team can
 * answer with a one-time code) and WhatsApp opens with a ready message. Payment never happens on
 * WhatsApp: an accepted offer becomes a code used in normal checkout.
 */
import { useState } from 'react'
import { CheckCircle2, HandCoins, Loader2, MessageCircle, Minus, Plus, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { whatsappLink } from '@/lib/contact'

type Props = {
  productId: number
  variantId?: number | null
  productName: string
  price: number
  quantity: number
  maxQuantity?: number
  formatPrice: (n: number) => string
  defaultName?: string
  defaultPhone?: string
  defaultEmail?: string
}

const CHIPS = [5, 10, 15]

export function MakeOffer(p: Props) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(Math.max(1, p.quantity || 1))
  const [offer, setOffer] = useState('')
  const [name, setName] = useState(p.defaultName || '')
  const [phone, setPhone] = useState(p.defaultPhone || '')
  const [region, setRegion] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ ref: string | null; link: string } | null>(null)

  const offerNum = Number(String(offer).replace(/[^\d]/g, '')) || 0
  const max = p.maxQuantity && p.maxQuantity > 0 ? p.maxQuantity : 10000
  const saving = offerNum > 0 && offerNum < p.price ? (p.price - offerNum) * qty : 0
  const field = 'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-neutral-700 dark:bg-neutral-900'

  const start = () => { setOpen(true); setSent(null); setError(null); setQty(Math.max(1, p.quantity || 1)) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!(offerNum > 0)) return setError('Andika bei unayotaka / Enter the price you want.')
    if (offerNum >= p.price) return setError(`Ofa iwe chini ya ${p.formatPrice(p.price)} / Your offer should be lower than ${p.formatPrice(p.price)}.`)
    setBusy(true)
    try {
      const res = await fetch('/api/offers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.productId, variantId: p.variantId || undefined, quantity: qty, offerPrice: offerNum, name, phone, region, note, email: p.defaultEmail || '' }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.status === 400) throw new Error(d.error || 'Check your offer.')
      // saved (or not): the WhatsApp message always goes out
      const message: string = d.message || `Habari Honic, naomba punguzo 🙏\nHello Honic, I would like a better price.\n\n🛒 ${p.productName}\nQty: ${qty}\nPrice: ${p.formatPrice(p.price)} each\nMy offer: ${p.formatPrice(offerNum)} each`
      const link = whatsappLink(message)
      setSent({ ref: d.ref || null, link })
      window.open(link, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={start} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800 ring-1 ring-orange-200 transition-colors hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-200 dark:ring-orange-900">
        <HandCoins className="h-5 w-5" /> Omba punguzo · Make an offer
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          {sent ? (
            <div className="py-2 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <DialogHeader className="mt-3 sm:text-center">
                <DialogTitle className="text-xl">Ofa yako imetumwa! · Offer ready</DialogTitle>
                <DialogDescription>
                  Send the message on WhatsApp and our team will reply. If they agree, you get a code to pay the new price here, safely with mobile money.
                  {sent.ref ? <span className="mt-1 block font-mono text-xs">Ref: {sent.ref}</span> : null}
                </DialogDescription>
              </DialogHeader>
              <a href={sent.link} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                <MessageCircle className="h-5 w-5" /> Open WhatsApp
              </a>
              <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-stone-100 dark:text-neutral-300 dark:hover:bg-neutral-800">Close</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl"><HandCoins className="h-5 w-5 text-orange-600" /> Omba punguzo · Make an offer</DialogTitle>
                <DialogDescription className="line-clamp-2">{p.productName} · now {p.formatPrice(p.price)} each</DialogDescription>
              </DialogHeader>

              <div>
                <p className="mb-1.5 text-sm font-semibold">Idadi · Quantity</p>
                <div className="inline-flex items-center rounded-xl ring-1 ring-neutral-300 dark:ring-neutral-700">
                  <button type="button" aria-label="Less" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center"><Minus className="h-4 w-4" /></button>
                  <input inputMode="numeric" aria-label="Quantity" value={qty} onChange={(e) => setQty(Math.min(max, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} className="h-11 w-16 border-x border-neutral-300 bg-transparent text-center text-sm font-bold outline-none dark:border-neutral-700" />
                  <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(max, q + 1))} className="grid h-11 w-11 place-items-center"><Plus className="h-4 w-4" /></button>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Bei yako kwa kila moja · Your price each (TSh)</span>
                <input inputMode="numeric" required value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d]/g, ''))} placeholder={String(Math.round(p.price * 0.9))} className={`${field} text-lg font-bold tabular-nums`} />
              </label>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <button key={c} type="button" onClick={() => setOffer(String(Math.round((p.price * (100 - c)) / 100 / 100) * 100 || Math.round(p.price * (100 - c) / 100)))} className="rounded-full bg-stone-100 px-3.5 py-2 text-sm font-semibold hover:bg-orange-100 dark:bg-neutral-800">−{c}%</button>
                ))}
                <button type="button" onClick={() => setNote((n) => (n ? n : 'Bei ya mwisho ni ngapi? / What is your last price?'))} className="rounded-full bg-stone-100 px-3.5 py-2 text-sm font-semibold hover:bg-orange-100 dark:bg-neutral-800">Bei ya mwisho?</button>
              </div>
              {saving > 0 && <p className="rounded-xl bg-orange-50 px-3.5 py-2.5 text-sm text-orange-900 dark:bg-orange-950/30 dark:text-orange-200">Total {p.formatPrice(offerNum * qty)} · you&apos;d save {p.formatPrice(saving)}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold">Jina · Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={field} /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold">Simu · Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="0712 345 678" maxLength={20} className={field} /></label>
              </div>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">Mkoa · Region</span><input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Dar es Salaam" maxLength={60} className={field} /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">Maelezo · Note</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className={field} /></label>

              {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

              <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />} Tuma kwa WhatsApp · Send on WhatsApp
              </button>
              <p className="flex items-start gap-2 text-xs text-neutral-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Usilipe kwa WhatsApp. If we agree, you get a code and pay here with mobile money.</p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
