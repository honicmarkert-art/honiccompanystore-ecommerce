'use client'

/**
 * Help centre: searchable questions & answers (lib/help-faqs.ts).
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mail, MessageCircle, Search } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { FAQ_CATEGORIES, getFaqs, type FaqCategory } from '@/lib/help-faqs'
import { whatsappLink } from '@/lib/contact'

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'

export default function HelpCenterPage() {
  const faqs = useMemo(() => getFaqs(), [])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FaqCategory | 'all'>('all')

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return faqs.filter((f) =>
      (cat === 'all' || f.category === cat) &&
      words.every((w) => (f.question + ' ' + f.answer).toLowerCase().includes(w)))
  }, [faqs, q, cat])

  const chip = (id: FaqCategory | 'all', label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setCat(id)}
      aria-pressed={cat === id}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${cat === id ? 'bg-orange-500 text-white' : 'bg-white ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
          <Link href="/support" className="hover:text-orange-600">Help centre</Link> <span aria-hidden>/</span> Questions & answers
        </nav>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Questions & answers</h1>

        <label className="relative mt-6 block">
          <span className="sr-only">Search the help centre</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search, e.g. refund, delivery, M-Pesa"
            className="w-full rounded-2xl border-2 border-neutral-200 bg-white py-4 pl-12 pr-4 text-base outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {chip('all', 'All topics')}
          {FAQ_CATEGORIES.map((c) => chip(c.id, c.name))}
        </div>

        <div className="mt-6 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
          {shown.map((f) => (
            <details key={f.id} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.question}
                  <span aria-hidden className="text-lg text-orange-600 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{f.answer}</p>
              {f.link && (
                <Link href={f.link.href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline">
                  {f.link.label} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </details>
          ))}
          {shown.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-neutral-500">
              No answer for &quot;{q}&quot;. Try other words, or ask us directly below.
            </div>
          )}
        </div>

        <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-neutral-950 p-7 text-white">
          <div>
            <h2 className="text-xl font-black">Didn&apos;t find your answer?</h2>
            <p className="mt-1 text-sm text-neutral-300">Message us on WhatsApp or email. We reply during business hours.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={whatsappLink('Hello Honic, I have a question:')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold hover:bg-orange-600">
              <MessageCircle className="h-4 w-4" /> WhatsApp us
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-white/30 hover:ring-white">
              <Mail className="h-4 w-4" /> Email
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
