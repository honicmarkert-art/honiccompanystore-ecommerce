/**
 * Buy from China shipping: air or sea, each with its own price (rates in import_freight_settings).
 * Pure functions: the product page, the calculator, checkout and the order API all use this, so the
 * shopper sees exactly what the server charges. (Mirrored in honicstore-admin/lib/import-freight.ts.)
 *
 *  Air  chargeable kg = max(actual kg, volume kg, minimum), volume kg = L x W x H (cm) / divisor,
 *       rounded up to the step (0.5 kg)
 *  Sea  chargeable CBM = max(L x W x H (cm) / 1,000,000, minimum), rounded up to 0.001
 *  Weight breaks: the whole shipment pays the rate of the break its chargeable size falls into.
 *  Price in US dollars x the exchange rate, rounded UP to the next TSh 100.
 *  Several China items in one order travel together (one consolidated shipment).
 */
export type FreightMode = 'air' | 'sea'
export type Tier = { from: number; usd: number }
export type FreightSettings = {
  usdTzs: number
  air: { tiers: Tier[]; divisor: number; minKg: number; stepKg: number; daysMin: number; daysMax: number }
  sea: { tiers: Tier[]; minCbm: number; daysMin: number; daysMax: number }
}
export type FreightItem = { quantity: number; weightKg?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null }
export type FreightQuote = {
  mode: FreightMode
  measured: number // items with size and weight
  unmeasured: number // items priced after weighing
  chargeable: number // kg (air) or CBM (sea) of the measured items
  unit: 'kg' | 'CBM'
  rateUsd: number
  usd: number
  tzs: number
  daysMin: number
  daysMax: number
}

const pos = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : typeof n === 'string' && Number(n) > 0 ? Number(n) : 0)
export const isMeasured = (i: FreightItem) => pos(i.weightKg) > 0 && pos(i.lengthCm) > 0 && pos(i.widthCm) > 0 && pos(i.heightCm) > 0
const ceilTo = (n: number, step: number) => Math.ceil(n / step - 1e-9) * step
const rateFor = (tiers: Tier[], size: number) => [...tiers].sort((a, b) => a.from - b.from).filter((t) => size >= t.from).pop()?.usd ?? tiers[0]?.usd ?? 0

/** Price of shipping these items by one mode (items without size/weight are counted, not priced). */
export function quoteFreight(items: FreightItem[], mode: FreightMode, s: FreightSettings): FreightQuote {
  const measured = items.filter((i) => isMeasured(i) && i.quantity > 0)
  const unmeasured = items.filter((i) => !isMeasured(i) && i.quantity > 0).length
  const days = mode === 'air' ? s.air : s.sea
  if (!measured.length) return { mode, measured: 0, unmeasured, chargeable: 0, unit: mode === 'air' ? 'kg' : 'CBM', rateUsd: 0, usd: 0, tzs: 0, daysMin: days.daysMin, daysMax: days.daysMax }

  let chargeable: number
  if (mode === 'air') {
    const actual = measured.reduce((a, i) => a + pos(i.weightKg) * i.quantity, 0)
    const volume = measured.reduce((a, i) => a + (pos(i.lengthCm) * pos(i.widthCm) * pos(i.heightCm) / (s.air.divisor || 6000)) * i.quantity, 0)
    chargeable = ceilTo(Math.max(actual, volume, s.air.minKg), s.air.stepKg || 0.5)
  } else {
    const cbm = measured.reduce((a, i) => a + (pos(i.lengthCm) * pos(i.widthCm) * pos(i.heightCm) / 1_000_000) * i.quantity, 0)
    chargeable = ceilTo(Math.max(cbm, s.sea.minCbm), 0.001)
  }
  chargeable = Math.round(chargeable * 1000) / 1000
  const rateUsd = rateFor(mode === 'air' ? s.air.tiers : s.sea.tiers, chargeable)
  const usd = Math.round(chargeable * rateUsd * 100) / 100
  const tzs = Math.ceil((usd * s.usdTzs) / 100) * 100
  return { mode, measured: measured.length, unmeasured, chargeable, unit: mode === 'air' ? 'kg' : 'CBM', rateUsd, usd, tzs, daysMin: days.daysMin, daysMax: days.daysMax }
}

/** Database row (import_freight_settings) -> settings, with safe fallbacks. */
export function settingsFromRow(row: { usd_tzs: number | string; air: unknown; sea: unknown } | null): FreightSettings | null {
  if (!row) return null
  const air = (row.air || {}) as Partial<FreightSettings['air']>
  const sea = (row.sea || {}) as Partial<FreightSettings['sea']>
  const tiers = (t: unknown) => (Array.isArray(t) ? t : []).map((x) => ({ from: Math.max(0, Number((x as Tier).from) || 0), usd: Math.max(0, Number((x as Tier).usd) || 0) })).filter((x) => x.usd > 0)
  const s: FreightSettings = {
    usdTzs: Number(row.usd_tzs) || 0,
    air: { tiers: tiers(air.tiers), divisor: Number(air.divisor) || 6000, minKg: Number(air.minKg) || 1, stepKg: Number(air.stepKg) || 0.5, daysMin: Number(air.daysMin) || 7, daysMax: Number(air.daysMax) || 14 },
    sea: { tiers: tiers(sea.tiers), minCbm: Number(sea.minCbm) || 0.05, daysMin: Number(sea.daysMin) || 45, daysMax: Number(sea.daysMax) || 60 },
  }
  return s.usdTzs > 0 && s.air.tiers.length && s.sea.tiers.length ? s : null
}

export const MODE_LABEL: Record<FreightMode, string> = { air: 'Air', sea: 'Sea' }
