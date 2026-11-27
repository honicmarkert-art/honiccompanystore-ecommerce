"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plane, Search, ShoppingBag, User } from 'lucide-react'

/**
 * Site-wide bottom tab bar for phones and tablets (hidden from lg up).
 *
 * Deliberately does NOT use useCart(): every useCart instance loads and re-saves
 * the cart on its own, so a second global instance could overwrite items a page
 * just added. The Cart tab is a plain link.
 */

// Routes that have their own bottom UI or are task-focused flows
const HIDDEN_PREFIXES = ['/checkout', '/cart', '/auth', '/supplier', '/winga', '/unauthorized', '/error']

function isHidden(pathname: string) {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  // Marketplace (/products) has its own bottom bar; product detail pages have a sticky add-to-cart bar
  if (pathname === '/products' || /^\/products\/[^/]+/.test(pathname)) return true
  return false
}

const TABS = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' || p === '/' },
  { href: '/products', label: 'Marketplace', icon: Search, match: (p: string) => p === '/products' || p.startsWith('/categories') },
  { href: '/buy-from-china', label: 'China', icon: Plane, match: (p: string) => p.startsWith('/buy-from-china') },
  { href: '/cart', label: 'Cart', icon: ShoppingBag, match: (p: string) => p.startsWith('/cart') },
  { href: '/account', label: 'Account', icon: User, match: (p: string) => p.startsWith('/account') || p.startsWith('/orders') },
]

export function MobileTabBar() {
  const pathname = usePathname() || '/'
  if (isHidden(pathname)) return null

  return (
    <>
      {/* spacer so page content can scroll clear of the bar */}
      <div aria-hidden className="h-16 pb-[env(safe-area-inset-bottom)] lg:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors sm:text-xs ${
                    active ? 'text-orange-600' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-orange-500" />}
                  <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : ''}`} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
