"use client"

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Package, UserPlus, AlertTriangle } from 'lucide-react'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'

interface BuyerRouteGuardProps {
  children: React.ReactNode
}

/**
 * Route guard that ensures only buyers (non-suppliers) can access buyer pages
 * Automatically redirects suppliers to their dashboard
 */
export function BuyerRouteGuard({ children }: BuyerRouteGuardProps) {
  const { user, isAuthenticated, loading } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const router = useRouter()
  const hasRedirected = useRef(false)
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-redirect suppliers to dashboard
  useEffect(() => {
    // Clear any pending redirect
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    // Wait for auth check to complete
    if (loading) {
      hasRedirected.current = false
      return
    }

    // If not authenticated, allow access (buyer pages can be public)
    if (!isAuthenticated || !user) {
      hasRedirected.current = false
      return
    }

    // Check if user is supplier (and not admin)
    // Also check user_metadata for OAuth users (Google login)
    const isSupplierFromMetadata = (user as any)?.user_metadata?.is_supplier || 
                                   (user as any)?.user_metadata?.isSupplier ||
                                   (user as any)?.app_metadata?.is_supplier ||
                                   (user as any)?.app_metadata?.isSupplier
    const isSupplier = user.isSupplier || user.profile?.is_supplier || isSupplierFromMetadata || false
    const isAdmin = user.role === 'admin'

    // Admin can access all pages
    if (isAdmin) {
      hasRedirected.current = false
      return
    }

    // If user is a supplier, auto-redirect to dashboard immediately
    if (isSupplier && !hasRedirected.current) {
      hasRedirected.current = true
      console.log('🔄 Auto-redirecting supplier to dashboard')
      // Use replace instead of push for faster navigation (no history entry)
      router.replace('/supplier/dashboard')
      return
    }

    // Reset redirect flag if not a supplier
    hasRedirected.current = false
  }, [user, isAuthenticated, loading, router])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, allow access (buyer pages can be public)
  if (!isAuthenticated || !user) {
    return <>{children}</>
  }

  // Check if user is supplier (and not admin)
  // Also check user_metadata for OAuth users (Google login)
  const isSupplierFromMetadata = (user as any)?.user_metadata?.is_supplier || 
                                 (user as any)?.user_metadata?.isSupplier ||
                                 (user as any)?.app_metadata?.is_supplier ||
                                 (user as any)?.app_metadata?.isSupplier
  const isSupplier = user.isSupplier || user.profile?.is_supplier || isSupplierFromMetadata || false
  const isAdmin = user.role === 'admin'

  // Admin can access all pages
  if (isAdmin) {
    return <>{children}</>
  }

  // If user is a supplier, show loading state while redirecting
  if (isSupplier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Redirecting to supplier dashboard...</p>
        </div>
      </div>
    )
  }

  // If not a supplier, render children normally
  return <>{children}</>
}
