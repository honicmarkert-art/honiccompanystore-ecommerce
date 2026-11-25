'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Smartphone, Sparkles, Truck } from 'lucide-react'
import { AuthModal } from '@/components/auth-modal'
import { BrandLogo } from '@/components/brand-logo'
import { useAuth } from '@/contexts/auth-context'

/**
 * /auth/login and /auth/register: the same sign-in / sign-up form as the pop-up used everywhere
 * else (components/auth-modal.tsx), shown on a branded page. One form, one look, one set of rules.
 */
function AuthPageInner({ tab }: { tab: 'login' | 'register' }) {
  const router = useRouter()
  const sp = useSearchParams()
  const { user } = useAuth()
  const raw = sp.get('redirect') || sp.get('returnTo') || '/'
  // only same-site paths (no open redirects)
  const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  const [closed, setClosed] = useState(false)
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    if (user) router.replace(redirect)
  }, [user, redirect, router])

  useEffect(() => {
    if (!closed) return
    // give a just-completed sign-in a moment to land before leaving
    const t = setTimeout(() => { if (!userRef.current) router.push('/') }, 400)
    return () => clearTimeout(t)
  }, [closed, router])

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-white to-[#f6f6f7]">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange-300/30 blur-3xl" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLogo size="md" />
      </div>
      <div className="relative mx-auto hidden max-w-6xl px-6 pt-10 lg:block">
        <div className="max-w-md">
          <h1 className="text-4xl font-black leading-tight tracking-tight">Everything you need, delivered to your door.</h1>
          <ul className="mt-6 space-y-3 text-sm text-neutral-600">
            <li className="flex items-center gap-3"><Truck className="h-5 w-5 text-orange-500" /> Delivery across Tanzania</li>
            <li className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-orange-500" /> Pay with M-Pesa, Airtel, Mixx or HaloPesa</li>
            <li className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-orange-500" /> Shop Honic and trusted sellers in one place</li>
          </ul>
        </div>
      </div>
      <AuthModal isOpen={!closed && !user} defaultTab={tab} redirectUrl={redirect} onClose={() => setClosed(true)} />
    </div>
  )
}

export function AuthPage({ tab }: { tab: 'login' | 'register' }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AuthPageInner tab={tab} />
    </Suspense>
  )
}
