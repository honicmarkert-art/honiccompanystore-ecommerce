'use client'

/**
 * "Delivery to …" on the product page: the shopper picks their region (and district) and sees the
 * fee and time for this item, using the same calculator as checkout and the order API
 * (lib/shipping-pricing). The choice is remembered on this device.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Store, Truck } from 'lucide-react'
import { calculateShippingFee, freeDeliveryThreshold, largestSize } from '@/lib/shipping-pricing'
import { TANZANIA_REGIONS, DISTRICTS_BY_REGION } from '@/lib/tanzania-address'

const KEY = 'honic_delivery_area'

export function DeliveryEstimate({ price, quantity, shippingSize, freeDelivery, formatPrice }: {
  price: number
  quantity: number
  shippingSize?: string | null
  freeDelivery?: boolean
  formatPrice: (n: number) => string
}) {
  const [region, setRegion] = useState('Dar es Salaam')
  const [district, setDistrict] = useState('')

  // restore the last area (after mount, so server and browser render the same first)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (saved?.region && (TANZANIA_REGIONS as readonly string[]).includes(saved.region)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a saved preference
        setRegion(saved.region)
        setDistrict(saved.district || '')
      }
    } catch { /* storage blocked: keep defaults */ }
  }, [])
  const save = (r: string, d: string) => {
    setRegion(r); setDistrict(d)
    try { localStorage.setItem(KEY, JSON.stringify({ region: r, district: d })) } catch { /* optional */ }
  }

  const subtotal = price * Math.max(1, quantity)
  const q = calculateShippingFee({ deliveryOption: 'shipping', region, district, subtotal, allProductsHaveFreeDelivery: !!freeDelivery, size: largestSize([shippingSize]) })
  const free = freeDeliveryThreshold()
  const districts = DISTRICTS_BY_REGION[region] || []
  const field = 'min-w-0 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-900'

  const note = q.sizeSurcharge > 0
    ? (q.freeReason === 'threshold' ? `Free delivery over ${formatPrice(free)} · includes ${formatPrice(q.sizeSurcharge)} large-item handling` : `Includes ${formatPrice(q.sizeSurcharge)} ${q.size === 'large' ? 'large-item' : 'bigger-item'} handling`)
    : (q.freeReason === null && subtotal < free ? `Free delivery on orders over ${formatPrice(free)}` : null)

  return (
    <div className="mt-3 rounded-2xl px-4 py-3 ring-1 ring-neutral-200 dark:ring-neutral-800">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
        <span className="font-semibold">Deliver to</span>
        <select aria-label="Region" value={region} onChange={(e) => save(e.target.value, '')} className={field}>
          {TANZANIA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {districts.length > 1 && (
          <select aria-label="District" value={district} onChange={(e) => save(region, e.target.value)} className={field}>
            <option value="">Any district</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-neutral-500" />
          <span className={q.shippingFee === 0 ? 'font-bold text-emerald-700' : 'font-bold'}>{q.shippingFee === 0 ? 'Free delivery' : formatPrice(q.shippingFee)}</span>
          {q.eta && <span className="text-neutral-500">· {q.eta}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-neutral-500"><Store className="h-4 w-4" /><span className="font-semibold text-emerald-700">Free pickup</span> in Dar</span>
        <Link href="/support/shipping-info" className="-my-2 inline-block py-2 text-xs font-semibold text-orange-600 hover:underline">Details</Link>
      </p>
      {note && <p className="mt-1 pl-[22px] text-xs text-neutral-500">{note}</p>}
    </div>
  )
}
