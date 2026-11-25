'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Camera, Search, Sparkles } from 'lucide-react'
import { openLens } from '@/components/image-search/lens'
import { cn } from '@/lib/utils'

const EXAMPLES = {
  // things that are in the store today; update as new departments fill up
  products: ['water purifier', 'arduino uno', '3D printer', 'soldering iron', 'starter kit'],
  ai: ['a gift for a student who loves robotics', 'clean drinking water at home', 'kit ya kupima joto la chumba', 'tools to repair electronics'],
}

/** Big hero search: plain product search, or "Ask AI" (describe what you need, in English or Kiswahili). */
export function HomeSearch() {
  const router = useRouter()
  const [mode, setMode] = useState<'products' | 'ai'>('products')
  const [q, setQ] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000)
    return () => clearInterval(t)
  }, [])

  const examples = EXAMPLES[mode]
  const placeholder = mode === 'ai' ? `Describe what you need, e.g. “${examples[tick % examples.length]}”` : `Search “${examples[tick % examples.length]}”`

  const submit = (term = q) => {
    const t = term.trim()
    if (!t) return
    router.push(mode === 'ai' ? `/products?mode=ai&q=${encodeURIComponent(t)}` : `/products?search=${encodeURIComponent(t)}`)
  }

  return (
    <div>
      <div role="tablist" aria-label="Search type" className="mb-3 inline-flex rounded-full bg-white/70 p-1 ring-1 ring-neutral-200 backdrop-blur">
        {([
          ['products', 'Search products', Search],
          ['ai', 'Ask AI', Sparkles],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition',
              mode === value ? (value === 'ai' ? 'bg-neutral-950 text-white' : 'bg-orange-500 text-white') : 'text-neutral-600 hover:text-neutral-950'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <form
        role="search"
        data-lens
        onSubmit={(e) => { e.preventDefault(); submit() }}
        className={cn(
          'flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 shadow-xl ring-2 transition',
          mode === 'ai' ? 'shadow-neutral-900/10 ring-neutral-950' : 'shadow-orange-500/10 ring-orange-500'
        )}
      >
        {mode === 'ai' ? <Sparkles className="h-5 w-5 shrink-0 text-orange-500" /> : <Search className="h-5 w-5 shrink-0 text-neutral-400" />}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={mode === 'ai' ? 'Describe what you need' : 'Search products'}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-neutral-950 outline-none placeholder:text-neutral-400"
        />
        {mode === 'products' && (
          <button type="button" onClick={() => openLens()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-neutral-500 hover:bg-orange-50 hover:text-orange-600" aria-label="Search by photo" title="Search by photo">
            <Camera className="h-5 w-5" />
          </button>
        )}
        <button type="submit" aria-label={mode === 'ai' ? 'Find parts' : 'Search'} className={cn('flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white sm:px-6', mode === 'ai' ? 'bg-neutral-950 hover:bg-neutral-800' : 'bg-orange-500 hover:bg-orange-600')}>
          <span className="hidden sm:inline">{mode === 'ai' ? 'Find parts' : 'Search'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-neutral-500">{mode === 'ai' ? 'Try:' : 'Popular:'}</span>
        {examples.slice(0, mode === 'ai' ? 2 : 5).map((t) => (
          <button key={t} type="button" onClick={() => submit(t)} className="rounded-full bg-white px-3 py-2 font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:text-orange-600 hover:ring-orange-300">
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
