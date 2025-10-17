"use client"

import { useState } from 'react'
import { UserRoute } from '@/components/protected-route'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, MessageCircle, CreditCard, Heart, Settings, User, ChevronRight, Clock, X, ArrowLeft, Package, ShoppingCart, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCart } from '@/hooks/use-cart'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { cartTotalItems } = useCart()
  const nav = [
    { href: '/account', label: 'Overview', icon: User },
    { href: '/account/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/cart', label: 'Cart', icon: ShoppingCart },
    { href: '/account/messages', label: 'Messages', icon: MessageCircle },
    { href: '/account/payment', label: 'Payment', icon: CreditCard },
    { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/account/saved-later', label: 'Saved for Later', icon: Clock },
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
      <div className="container mx-auto px-2 sm:px-4 py-4 lg:py-6">
        <style jsx>{`
          @media (max-width: 1023px) {
            .account-sidebar {
              position: fixed !important;
              top: 1rem;
              left: 1rem;
              right: 1rem;
              z-index: 40;
              max-height: calc(100vh - 2rem);
              overflow-y: auto;
            }
          }
          @media (min-width: 1024px) {
            .account-sidebar {
              position: fixed !important;
              top: 1rem;
              left: 1rem !important;
              width: 280px;
              max-height: calc(100vh - 2rem);
              overflow-y: auto;
            }
            .account-content {
              margin-left: 296px;
            }
          }
        `}</style>
        {/* Mobile backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <div className="relative">
          {/* Sidebar */}
          <aside className="lg:block">
            <div className={`account-sidebar fixed top-4 left-4 right-4 lg:left-4 lg:right-auto lg:top-4 z-40 rounded-xl border bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg p-4 max-h-[calc(100vh-2rem)] overflow-y-auto transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-[-100%] lg:translate-x-0'}`}>
              {/* Back to Products Button */}
              <div className="mb-4">
                <Link
                  href="/products"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <Package className="w-4 h-4" />
                  <span>Back to Products</span>
                </Link>
              </div>
              
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Account</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage your account settings</p>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 ml-auto mr-0"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {nav.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-orange-500 text-white shadow-sm transform scale-[1.02]'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 hover:transform hover:scale-[1.01]'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                      {href === '/cart' && cartTotalItems > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-semibold min-w-[20px] h-5 px-1">
                          {cartTotalItems}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="account-content min-h-[60vh] mt-1 lg:mt-0">
            {/* Back to Products button */}
            <div className="mb-2 pl-2 sm:pl-0">
              <Link 
                href="/products"
                className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Products
              </Link>
            </div>

            {/* Header row: left title, center welcome, right email + avatar */}
            <div className="mb-3 sm:mb-4 grid grid-cols-2 sm:grid-cols-3 items-center">
              <div className="col-span-1 flex items-center gap-2 sm:gap-3 pl-2 sm:pl-0">
                <button
                  onClick={() => setIsSidebarOpen(v => !v)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Toggle sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{current.label}</h1>
              </div>
              <div className="hidden sm:block text-center">
                <div className="text-base sm:text-lg font-semibold">Welcome back, {userName}!</div>
              </div>
              <div className="col-span-1 sm:col-span-1 flex items-center justify-end gap-1 sm:gap-2 pr-0 ml-auto">
                <span className="hidden md:block text-sm text-gray-600 dark:text-gray-300 truncate max-w-[140px]">{user?.email}</span>
                <Avatar className="w-8 h-8 ring-2 ring-gray-300 dark:ring-gray-700 flex-shrink-0 ml-1">
                  <AvatarImage src={user?.user_metadata?.avatar_url as string | undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500 dark:text-gray-400 pl-4 sm:pl-2">
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
            <div className="mb-4 sm:mb-6 border-b">
              <div className="flex flex-wrap gap-2">
                {[ '/account', '/account/orders', '/account/messages', '/account/payment', '/account/wishlist', '/account/saved-later' ].map((href) => {
                  const cfg = nav.find(n => n.href === href)!
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-t-md border ${active ? 'border-b-white bg-white text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700' : 'bg-gray-50 hover:bg-white text-gray-700 dark:text-gray-300 border-transparent'}`}
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


