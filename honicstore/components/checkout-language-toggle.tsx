'use client'

import { Globe } from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'
import { cn } from '@/lib/utils'

const LANGS = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'sw', label: 'SW', name: 'Kiswahili' },
] as const

/** Compact language switch: globe + segmented pill with a sliding highlight. */
export function CheckoutLanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()
  const index = language === 'sw' ? 1 : 0

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-2.5 pr-1', className)}
    >
      <Globe className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
      <div className="relative grid grid-cols-2 rounded-full bg-neutral-100 p-0.5">
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-sm ring-1 ring-neutral-200 transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {LANGS.map((l) => {
          const active = language === l.value
          return (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={l.name}
              title={l.name}
              onClick={() => setLanguage(l.value)}
              className={cn(
                'relative z-10 min-w-9 rounded-full px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition-colors',
                active ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-700'
              )}
            >
              {l.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
