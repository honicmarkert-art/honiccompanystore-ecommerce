"use client"

/**
 * Account area frame: site header/footer, a sticky side panel on desktop (who you are, grouped links
 * with counts, sign out) and a swipeable link strip on phones. Each page renders its own heading.
 * (Replaces a floating overlay sidebar + tab row + two "Back to Products" links + a duplicate h1.)
 */
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Clock, CreditCard, Heart, History, LayoutDashboard, LogOut, MessageCircle, Package, Settings, Ticket } from 'lucide-react'
import { UserRoute } from '@/components/protected-route'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/contexts/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useWishlist } from '@/hooks/use-wishlist'
import { useSavedLater } from '@/hooks/use-saved-later'
import { useOrders } from '@/hooks/use-orders'

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { items: wishlistItems } = useWishlist()
  const { items: savedLaterItems } = useSavedLater()
  const { orders } = useOrders()

  // active = orders not yet received / completed
  const activeOrders = orders.filter((o) => o.isReceived !== true && o.status !== 'cancelled').length

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Shopping',
      items: [
        { href: '/account/orders', label: 'My orders', icon: Package, count: activeOrders },
        { href: '/account/orders/history', label: 'Order history', icon: History },
        { href: '/account/wishlist', label: 'Wishlist', icon: Heart, count: wishlistItems.length },
        { href: '/account/saved-later', label: 'Saved for later', icon: Clock, count: savedLaterItems.length },
        { href: '/account/price-alerts', label: 'Price alerts', icon: Bell },
        { href: '/account/coupons', label: 'Coupons', icon: Ticket },
      ],
    },
    {
      title: 'Account',
      items: [
        { href: '/account', label: 'Overview', icon: LayoutDashboard },
        { href: '/account/messages', label: 'Messages', icon: MessageCircle },
        { href: '/account/payment', label: 'Payments & addresses', icon: CreditCard },
        { href: '/account/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]
  const all = groups.flatMap((g) => g.items)
  // most specific match wins (/account/orders/history over /account/orders, /account/orders/123 -> My orders)
  const activeHref = all
    .filter((i) => pathname === i.href || (i.href !== '/account' && pathname.startsWith(i.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? (pathname === '/account' ? '/account' : '')

  const name = user?.name || user?.email?.split('@')[0] || 'there'
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()

  // keep the active chip visible in the phone strip
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stripRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeHref])

  const logout = async () => {
    try { await signOut() } finally { router.push('/') }
  }

  return (
    <UserRoute>
      <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
        <SiteHeader />

        {/* phones: who you are + swipeable links */}
        <div className="border-b border-neutral-200 bg-white lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-4">
            <Avatar className="h-10 w-10 ring-2 ring-orange-100">
              <AvatarImage src={user?.profile?.avatar || undefined} alt="" />
              <AvatarFallback className="bg-orange-500 font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">Hi, {name.split(' ')[0]}</p>
              <p className="truncate text-xs text-neutral-500">{user?.email}</p>
            </div>
            <button onClick={logout} className="-mr-2 flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
          <div ref={stripRef} className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
            {all.map(({ href, label, icon: Icon, count }) => {
              const active = href === activeHref
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${active ? 'bg-orange-500 text-white' : 'bg-stone-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {!!count && <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-white/25' : 'bg-orange-500 text-white'}`}>{count}</span>}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* desktop side panel */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <Avatar className="h-12 w-12 ring-2 ring-orange-100">
                  <AvatarImage src={user?.profile?.avatar || undefined} alt="" />
                  <AvatarFallback className="bg-orange-500 text-lg font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-bold">{name}</p>
                  <p className="truncate text-xs text-neutral-500">{user?.email}</p>
                </div>
              </div>

              <nav aria-label="Account" className="rounded-2xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                {groups.map((g) => (
                  <div key={g.title} className="py-1">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{g.title}</p>
                    {g.items.map(({ href, label, icon: Icon, count }) => {
                      const active = href === activeHref
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-orange-50 font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' : 'text-neutral-700 hover:bg-stone-100 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-orange-600' : 'text-neutral-400'}`} />
                          <span className="truncate">{label}</span>
                          {!!count && <span className="ml-auto rounded-full bg-orange-500 px-2 text-xs font-bold text-white">{count}</span>}
                        </Link>
                      )
                    })}
                  </div>
                ))}
                <div className="mt-1 border-t border-neutral-100 pt-1 dark:border-neutral-800">
                  <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-red-50 hover:text-red-700 dark:text-neutral-300 dark:hover:bg-red-950/30">
                    <LogOut className="h-4 w-4 text-neutral-400" /> Sign out
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>

        <SiteFooter />
      </div>
    </UserRoute>
  )
}
