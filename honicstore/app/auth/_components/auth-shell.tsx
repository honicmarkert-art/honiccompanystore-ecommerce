import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'

/** Layout for the stand-alone auth pages (forgot / reset password, email link result, errors). */
export function AuthShell({ icon, title, subtitle, children, back = { href: '/auth/login', label: 'Back to sign in' } }: {
  icon?: ReactNode
  title: string
  subtitle?: ReactNode
  children: ReactNode
  back?: { href: string; label: string } | null
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-white to-[#f6f6f7] text-neutral-950">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange-300/30 blur-3xl" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLogo size="md" />
        {back && (
          <Link href={back.href} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-white hover:text-neutral-950">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{back.label}</span>
          </Link>
        )}
      </header>
      <main className="relative mx-auto flex max-w-6xl justify-center px-4 pb-16 pt-4 sm:pt-10">
        <div className="w-full max-w-[440px] rounded-3xl bg-white p-6 shadow-2xl shadow-neutral-900/5 ring-1 ring-neutral-200/70 sm:p-8">
          {icon && <div className="mb-5">{icon}</div>}
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm leading-relaxed text-neutral-500">{subtitle}</div>}
          <div className="mt-6">{children}</div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Your details are encrypted and never shared.
          </p>
        </div>
      </main>
    </div>
  )
}

export const authField =
  'h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-base text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 sm:text-sm'
export const authButton =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60'
export const authIcon = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400'

export function StatusIcon({ tone, children }: { tone: 'orange' | 'green' | 'red'; children: ReactNode }) {
  const cls = tone === 'green' ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : tone === 'red' ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-orange-50 text-orange-600 ring-orange-100'
  return <span className={`grid h-14 w-14 place-items-center rounded-2xl ring-1 ${cls}`}>{children}</span>
}
