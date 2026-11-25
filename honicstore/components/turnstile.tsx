'use client'

/**
 * Cloudflare Turnstile bot check — the widget. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * Tokens are single-use: change `resetKey` after every submit attempt to get a fresh one.
 */

import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => { scriptPromise = null; reject(new Error('turnstile-load')) }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

export function Turnstile({ onToken, resetKey, action = 'signup', className }: {
  onToken: (token: string) => void
  resetKey?: number | string
  action?: string
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  useEffect(() => { onTokenRef.current = onToken }, [onToken])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: 'light',
          size: 'flexible',
          callback: (t: string) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        })
      })
      .catch(() => onTokenRef.current(''))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [action])

  // fresh token after each attempt
  useEffect(() => {
    if (resetKey === undefined || !widgetId.current || !window.turnstile) return
    onTokenRef.current('')
    window.turnstile.reset(widgetId.current)
  }, [resetKey])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={boxRef} className={className} />
}
