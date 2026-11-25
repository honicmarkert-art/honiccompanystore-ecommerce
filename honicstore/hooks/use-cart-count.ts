'use client'

import { useSyncExternalStore } from 'react'

/**
 * Lightweight cart badge count for headers on pages that don't load the full cart (useCart).
 * Deliberately does NOT call useCart(): every useCart instance loads and re-saves the cart.
 * Source of truth: the `honic:cart` event that useCart fires on every change (detail = line count),
 * with stored data (guest cart / server cart cache) as the first-paint fallback.
 */
let lastCount: number | null = null

function readStored(): number {
  try {
    const guest = JSON.parse(localStorage.getItem('guest_cart') || 'null')
    if (Array.isArray(guest?.items) && guest.items.length) return countLines(guest.items)
    const cached = JSON.parse(sessionStorage.getItem('cart_cache') || 'null')
    if (Array.isArray(cached?.items)) return countLines(cached.items)
  } catch { /* storage blocked */ }
  return 0
}

function countLines(items: Array<{ variants?: unknown[] }>) {
  return items.reduce((n, i) => n + (Array.isArray(i.variants) && i.variants.length ? i.variants.length : 1), 0)
}

function subscribe(onChange: () => void) {
  const onCart = (e: Event) => {
    const n = (e as CustomEvent<number>).detail
    if (typeof n === 'number') lastCount = n
    onChange()
  }
  const onStorage = () => { lastCount = null; onChange() }
  window.addEventListener('honic:cart', onCart)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('honic:cart', onCart)
    window.removeEventListener('storage', onStorage)
  }
}

export function useCartCount(): number {
  return useSyncExternalStore(subscribe, () => lastCount ?? readStored(), () => 0)
}

/** Called by useCart whenever the cart changes. */
export function announceCartCount(count: number) {
  lastCount = count
  try { window.dispatchEvent(new CustomEvent('honic:cart', { detail: count })) } catch { /* SSR */ }
}
