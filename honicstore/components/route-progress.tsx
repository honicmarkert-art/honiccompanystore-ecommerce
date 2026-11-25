'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Thin orange bar at the top of the screen that starts the instant an internal link is clicked
 * and disappears when the new page is shown, so every navigation gives immediate feedback.
 * Done-detection is derived (target path vs current path), so there is no setState-in-effect.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const [pending, setPending] = useState<{ from: string; id: number } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      let url: URL
      try { url = new URL(href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      const id = Date.now()
      setPending({ from: window.location.pathname, id })
      // safety net: never leave the bar on screen if a navigation is cancelled
      window.setTimeout(() => setPending((p) => (p?.id === id ? null : p)), 12000)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const active = !!pending && pending.from === pathname
  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden" role="progressbar" aria-label="Loading page">
      <div className="h-full w-full origin-left bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 shadow-[0_0_8px_rgba(249,115,22,0.7)] [animation:route-progress_8s_cubic-bezier(.1,.7,.2,1)_forwards]" />
    </div>
  )
}
