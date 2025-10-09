"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function RoutePrefetcher() {
  const router = useRouter()

  useEffect(() => {
    // Prefetch common routes on idle
    const prefetchRoutes = () => {
      // Main navigation routes - including home page
      router.prefetch('/')
      router.prefetch('/products')
      router.prefetch('/cart')
      router.prefetch('/admin')
      router.prefetch('/auth/login')
      router.prefetch('/account')
      router.prefetch('/categories')
      
      // Account sub-routes
      router.prefetch('/account/orders')
      router.prefetch('/account/wishlist')
      router.prefetch('/account/payment')
      router.prefetch('/account/messages')
      router.prefetch('/account/coupons')
      router.prefetch('/account/coins')
      
      // Admin sub-routes
      router.prefetch('/admin/products')
      router.prefetch('/admin/orders')
      router.prefetch('/admin/users')
    }

    // Use requestIdleCallback for better performance
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(prefetchRoutes, { timeout: 2000 })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(prefetchRoutes, 1000)
    }

    // Add global navigation helpers
    if (typeof window !== 'undefined') {
      (window as any).navigateToHome = () => router.push('/')
      (window as any).navigateToProducts = () => router.push('/products')
      (window as any).navigateToCart = () => router.push('/cart')
    }
  }, [router])

  return null
}

