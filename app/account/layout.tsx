"use client"

import { UserRoute } from '@/components/protected-route'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, MessageCircle, CreditCard, Heart, Settings, User, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const nav = [
    { href: '/account', label: 'Overview', icon: User },
    { href: '/account/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/account/messages', label: 'Messages', icon: MessageCircle },
    { href: '/account/payment', label: 'Payment', icon: CreditCard },
    { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/account/settings', label: 'Settings', icon: Settings },
  ]

  const current = nav.find(n => n.href === pathname) || nav[0]
  const { user } = useAuth()
  const userName = (user?.user_metadata?.full_name as string) || (user?.email?.split('@')[0] ?? 'User')
  const initials = userName.split(' ').map(s => s[0]).join('').toUpperCase()
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg, idx, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      href: '/' + arr.slice(0, idx + 1).join('/'),
      isLast: idx === arr.length - 1,
    }))

  return (
    <UserRoute>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-20 rounded-xl border bg-white/70 dark:bg-gray-900/70 backdrop-blur p-3">
              <nav className="space-y-1">
                {nav.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        active
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-9 min-h-[60vh]">
            {/* Header row: left title, center welcome, right email + avatar */}
            <div className="mb-4 grid grid-cols-3 items-center">
              <div className="col-span-1">
                <h1 className="text-xl font-semibold tracking-tight">{current.label}</h1>
              </div>
              <div className="col-span-1 text-center">
                <div className="text-base sm:text-lg font-semibold">Welcome back, {userName}!</div>
              </div>
              <div className="col-span-1 flex items-center justify-end gap-2">
                <span className="hidden sm:block text-sm text-gray-600 dark:text-gray-300">{user?.email}</span>
                <Avatar className="w-8 h-8 ring-2 ring-orange-500">
                  <AvatarImage src={user?.user_metadata?.avatar_url as string | undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              <ol className="flex items-center gap-1">
                <li>
                  <Link href="/" className="hover:text-orange-600">Home</Link>
                </li>
                <li className="mx-1 text-gray-400"><ChevronRight className="w-4 h-4" /></li>
                <li>
                  <Link href="/account" className={`hover:text-orange-600 ${segments.length === 1 ? 'text-gray-900 dark:text-gray-100' : ''}`}>Account</Link>
                </li>
                {segments.slice(1).map((s, i) => (
                  <li key={s.href} className="flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    {s.isLast ? (
                      <span className="text-gray-900 dark:text-gray-100">{s.label}</span>
                    ) : (
                      <Link href={s.href} className="hover:text-orange-600">{s.label}</Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {/* Top navigation tabs (consistent across account pages) */}
            <div className="mb-6 border-b">
              <div className="flex flex-wrap gap-2">
                {[ '/account', '/account/orders', '/account/messages', '/account/payment', '/account/wishlist' ].map((href) => {
                  const cfg = nav.find(n => n.href === href)!
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`px-4 py-2 text-sm rounded-t-md border ${active ? 'border-b-white bg-white text-orange-600 border-orange-500' : 'bg-gray-50 hover:bg-white text-gray-700 border-transparent'}`}
                    >
                      {cfg.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {children}
          </main>
        </div>
      </div>
    </UserRoute>
  )
}


