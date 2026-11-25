'use client'

import { useCurrency } from '@/contexts/currency-context'

/** Price in the shopper's chosen currency (lets server-rendered pages show prices). */
export function Price({ value, className }: { value: number; className?: string }) {
  const { formatPrice } = useCurrency()
  return <span className={className}>{formatPrice(value)}</span>
}
