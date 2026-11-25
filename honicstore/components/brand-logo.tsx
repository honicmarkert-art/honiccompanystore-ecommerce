'use client'

import { useId } from 'react'
import Link from 'next/link'
import { usePublicCompanyContextOptional } from '@/contexts/public-company-context'

/**
 * Brand logo used in every header (Marketplace, product page, home).
 * - If the admin uploaded a real logo (company settings), that image is used.
 * - Otherwise: a crisp SVG mark (orange gradient tile with an "H" + spark) and the wordmark.
 * The old fallback (blue "HO" PNG) clashed with the orange theme.
 */

type Size = 'sm' | 'md' | 'lg'
const MARK: Record<Size, string> = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-11 w-11' }
const WORD: Record<Size, string> = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }

const isRealLogo = (src?: string | null) =>
  !!src && /^(https?:\/\/|\/)/.test(src) && !/placeholder|android-chrome/i.test(src)

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`bm-g-${id}`} x1="4" y1="2" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={`bm-s-${id}`} x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#bm-g-${id})`} />
      <rect width="40" height="40" rx="11" fill={`url(#bm-s-${id})`} />
      {/* H */}
      <path d="M13.5 11.5v17M26.5 11.5v17M13.5 20h13" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" fill="none" />
      {/* spark */}
      <circle cx="32.4" cy="8.4" r="2.4" fill="#fef3c7" />
    </svg>
  )
}

/**
 * Wordmark with a signature detail: the dot of the first "i" is the orange "spark" from the mark
 * (so the name and the icon visibly belong together). Names without an "i" render plainly.
 */
function Wordmark({ name, className = '' }: { name: string; className?: string }) {
  const i = name.toLowerCase().indexOf('i')
  if (i < 0) return <span className={className}>{name}</span>
  return (
    <span className={className} aria-label={name}>
      <span aria-hidden="true">
        {name.slice(0, i)}
        <span className="relative inline-block">
          {name[i] === 'I' ? 'I' : 'ı'}
          <span className="absolute left-1/2 top-[0.08em] h-[0.23em] w-[0.23em] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_0_0.35em_rgba(249,115,22,0.6)]" />
        </span>
        {name.slice(i + 1)}
      </span>
    </span>
  )
}

export function BrandLogo({
  size = 'md',
  showText = true,
  tagline = true,
  href = '/',
  className = '',
  textClassName = '',
}: {
  size?: Size
  showText?: boolean
  tagline?: boolean
  href?: string | null
  className?: string
  /** e.g. 'hidden sm:block' to hide the wordmark on small screens */
  textClassName?: string
}) {
  // Optional: the logo is also shown in the sign-in window, which sits outside the company providers
  const company = usePublicCompanyContextOptional()
  const companyName = company?.companyName || 'Honic'
  const companyLogo = company?.companyLogo || ''
  const name = (companyName || 'Honic').replace(/\s+(company\s+)?(limited|ltd|store)\.?$/i, '').trim() || 'Honic'

  const inner = (
    <span className={`flex shrink-0 items-center gap-2 ${className}`}>
      {isRealLogo(companyLogo) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={companyLogo} alt="" className={`${MARK[size]} rounded-xl object-contain`} />
      ) : (
        <BrandMark className={`${MARK[size]} drop-shadow-[0_2px_6px_rgba(234,88,12,0.35)]`} />
      )}
      {showText && (
        <span className={`flex flex-col leading-none ${textClassName}`}>
          <Wordmark name={name} className={`${WORD[size]} font-black tracking-[-0.04em] text-neutral-950 dark:text-white`} />
          {tagline && (
            <span className="mt-1 flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.32em] text-neutral-500 dark:text-neutral-400">
              <span className="h-[2px] w-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" />
              Store
            </span>
          )}
        </span>
      )}
    </span>
  )

  return href ? (
    <Link href={href} aria-label={`${name} home`} className="rounded-xl focus-visible:outline-offset-4">
      {inner}
    </Link>
  ) : inner
}
