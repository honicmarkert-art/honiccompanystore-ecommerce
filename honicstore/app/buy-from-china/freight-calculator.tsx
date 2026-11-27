"use client"

/** Shipping calculator for Buy from China: packed size, weight and quantity -> air and sea price. */
import { useState } from 'react'
import { Plane, Ship } from 'lucide-react'
import { quoteFreight, type FreightSettings } from '@/lib/import-freight'

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`
const num = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0 }

export function FreightCalculator({ settings }: { settings: FreightSettings }) {
  const [f, setF] = useState({ weight: '1', length: '30', width: '20', height: '15', quantity: '1' })
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v.replace(/[^0-9.,]/g, '').slice(0, 8) }))
  const item = { quantity: Math.max(1, Math.floor(num(f.quantity)) || 1), weightKg: num(f.weight), lengthCm: num(f.length), widthCm: num(f.width), heightCm: num(f.height) }
  const ok = item.weightKg > 0 && item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
  const air = ok ? quoteFreight([item], 'air', settings) : null
  const sea = ok ? quoteFreight([item], 'sea', settings) : null
  const volumeKg = ok ? (item.lengthCm * item.widthCm * item.heightCm / settings.air.divisor) * item.quantity : 0

  const box = 'h-11 w-full rounded-xl border border-[#1d1210]/15 bg-white px-3 text-[15px] tabular-nums outline-none focus:border-[#c8102e] focus:ring-4 focus:ring-[#c8102e]/10'
  const field = (k: keyof typeof f, label: string, unit: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#1d1210]/70">{label}</span>
      <span className="relative block"><input inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} className={`${box} pr-11`} aria-label={`${label} (${unit})`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#1d1210]/50">{unit}</span></span>
    </label>
  )
  const result = (q: typeof air, icon: React.ReactNode, title: string) => (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#1d1210]/10">
      <p className="flex items-center gap-2 text-sm font-bold">{icon}{title}</p>
      {q ? (
        <>
          <p className="mt-1 text-2xl font-black tabular-nums">{tsh(q.tzs)}</p>
          <p className="text-xs text-[#1d1210]/60">${q.usd.toFixed(2)} · {q.chargeable} {q.unit} at ${q.rateUsd}/{q.unit} · about {q.daysMin}–{q.daysMax} days</p>
        </>
      ) : <p className="mt-1 text-sm text-[#1d1210]/50">Enter size and weight</p>}
    </div>
  )

  return (
    <section id="calculator" className="scroll-mt-20 border-y border-[#1d1210]/10 bg-[#fffaf2]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-14">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#c8102e]">Shipping calculator</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">Air or sea: what it costs</h2>
          <p className="mt-2 text-sm text-[#1d1210]/70">Enter the packed size and weight of one piece. China items in one order travel together.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {field('length', 'Length', 'cm')}{field('width', 'Width', 'cm')}{field('height', 'Height', 'cm')}
            {field('weight', 'Weight', 'kg')}{field('quantity', 'Pieces', 'pcs')}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {result(air, <Plane className="h-4 w-4 text-[#c8102e]" />, 'By air')}
            {result(sea, <Ship className="h-4 w-4 text-[#c8102e]" />, 'By sea')}
          </div>
          {ok && <p className="mt-3 text-xs text-[#1d1210]/60">Air charges the larger of the real weight ({(item.weightKg * item.quantity).toFixed(2)} kg) and the volume weight ({volumeKg.toFixed(2)} kg = L×W×H ÷ {settings.air.divisor}).</p>}
        </div>

        <div className="rounded-3xl bg-[#160d0c] p-5 text-[#f7f1e8] sm:p-6">
          <h3 className="text-lg font-black">Our rates</h3>
          <p className="text-xs text-[#f7f1e8]/60">From China to our warehouse in Tanzania. Charged in TSh at TSh {settings.usdTzs.toLocaleString('en-US')} per US$ (rounded up to the next TSh 100).</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 font-bold text-[#f2c14e]"><Plane className="h-4 w-4" /> Air · {settings.air.daysMin}–{settings.air.daysMax} days</p>
              <ul className="mt-2 space-y-1 text-sm">
                {settings.air.tiers.map((t, i) => <li key={i} className="flex justify-between gap-2"><span className="text-[#f7f1e8]/70">{i === 0 ? `Up to ${settings.air.tiers[1]?.from ?? '∞'} kg` : settings.air.tiers[i + 1] ? `${t.from}–${settings.air.tiers[i + 1].from} kg` : `${t.from} kg and more`}</span><b>${t.usd}/kg</b></li>)}
              </ul>
              <p className="mt-2 text-[11px] text-[#f7f1e8]/50">Minimum {settings.air.minKg} kg, counted in steps of {settings.air.stepKg} kg.</p>
            </div>
            <div>
              <p className="flex items-center gap-2 font-bold text-[#f2c14e]"><Ship className="h-4 w-4" /> Sea · {settings.sea.daysMin}–{settings.sea.daysMax} days</p>
              <ul className="mt-2 space-y-1 text-sm">
                {settings.sea.tiers.map((t, i) => <li key={i} className="flex justify-between gap-2"><span className="text-[#f7f1e8]/70">{i === 0 ? `Up to ${settings.sea.tiers[1]?.from ?? '∞'} CBM` : settings.sea.tiers[i + 1] ? `${t.from}–${settings.sea.tiers[i + 1].from} CBM` : `${t.from} CBM and more`}</span><b>${t.usd}/CBM</b></li>)}
              </ul>
              <p className="mt-2 text-[11px] text-[#f7f1e8]/50">Minimum {settings.sea.minCbm} CBM. 1 CBM = 100 × 100 × 100 cm.</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#f7f1e8]/60">Sea is cheaper for big or heavy parcels; air is faster for small ones. Delivery inside Tanzania is added separately at checkout.</p>
        </div>
      </div>
    </section>
  )
}
