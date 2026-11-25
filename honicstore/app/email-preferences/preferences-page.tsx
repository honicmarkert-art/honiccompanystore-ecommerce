"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { EmailPreferencesForm } from '@/components/email-preferences-form'

export function PreferencesPage() {
  const sp = useSearchParams()
  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Email preferences</h1>
        <p className="mt-1 text-sm text-neutral-500">Choose which emails you get from Honic. Changes apply straight away.</p>
        <div className="mt-6"><EmailPreferencesForm e={sp.get('e')} t={sp.get('t')} highlight={sp.get('c')} /></div>
        <p className="mt-6 text-sm text-neutral-500">Have an account? You can also change these in <Link href="/account/settings" className="font-semibold text-orange-600 hover:underline">Settings</Link>.</p>
      </main>
      <SiteFooter />
    </div>
  )
}
