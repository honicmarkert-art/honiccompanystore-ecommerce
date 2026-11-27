"use client"

/**
 * The two shops, one tap away on every page: the Marketplace (everything in stock in Tanzania) and
 * Buy from China (imported to order). Slim strip under the header; the current shop is highlighted.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plane, Store } from 'lucide-react'

export function ShopSwitch({ className = '' }: { className?: string }) {
  const path = usePathname() || ''
  const china = path.startsWith('/buy-from-china')
  const market = !china && (path === '/products' || path.startsWith('/products/'))
  const pill = (on: boolean, tone: 'orange' | 'red') =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition sm:text-[13px] ${on
      ? tone === 'orange' ? 'bg-orange-500 text-white' : 'bg-[#c8102e] text-white'
      : tone === 'orange' ? 'text-neutral-700 hover:bg-orange-50 hover:text-orange-700 dark:text-neutral-300' : 'text-neutral-700 hover:bg-red-50 hover:text-[#c8102e] dark:text-neutral-300'}`
  return (
    <nav aria-label="Shops" className={`border-b border-neutral-200 bg-white/95 dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        <Link href="/products" aria-current={market ? 'page' : undefined} className={pill(market, 'orange')}><Store className="h-3.5 w-3.5" />Marketplace</Link>
        <Link href="/buy-from-china" aria-current={china ? 'page' : undefined} className={pill(china, 'red')}><Plane className="h-3.5 w-3.5" />Buy from China</Link>
      </div>
    </nav>
  )
}
