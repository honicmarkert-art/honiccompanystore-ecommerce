'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

interface SupplierRouteGuardProps {
  children: React.ReactNode
}

/**
 * Route guard that ensures only suppliers can access supplier pages
 * Redirects buyers and non-authenticated users
 */
export function SupplierRouteGuard({ children }: SupplierRouteGuardProps) {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const hasRedirected = useRef(false)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [forceRender, setForceRender] = useState(false)

  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (loading) {
      // Set a timeout to force render after 3 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        setForceRender(true)
      }, 3000)
    } else {
      setForceRender(false)
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [loading])

  // Use refs to track values and prevent unnecessary re-runs
  const userRef = useRef(user)
  const isAuthenticatedRef = useRef(isAuthenticated)
  const loadingRef = useRef(loading)
  
  // Update refs when values change
  useEffect(() => {
    userRef.current = user
    isAuthenticatedRef.current = isAuthenticated
    loadingRef.current = loading
  }, [user, isAuthenticated, loading])

  useEffect(() => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    // Check if user is on company-info page - allow access regardless of supplier status
    // Use both pathname hook and window.location as fallback (in case hook isn't ready yet)
    const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
    const isCompanyInfoPage = currentPath === '/supplier/company-info'
    
    // If on company-info page, allow access and don't run redirect logic
    if (isCompanyInfoPage) {
      hasRedirected.current = false // Reset redirect flag
      return // Allow access to company-info page - don't check supplier status
    }

    // Use ref values to prevent re-renders from triggering this effect
    const currentLoading = loadingRef.current
    const currentIsAuthenticated = isAuthenticatedRef.current
    const currentUser = userRef.current

    if (currentLoading && !forceRender) {
      // Reset redirect flag while loading
      hasRedirected.current = false
      return // Wait for auth check to complete
    }

    // Prevent multiple redirects
    if (hasRedirected.current) {
      return
    }

    if (!currentIsAuthenticated || !currentUser) {
      // Wait a bit before redirecting to allow auth to stabilize
      // This prevents redirects during brief auth check failures
      // Increase delay to 2 seconds to allow auth context to fully initialize
      retryTimeoutRef.current = setTimeout(() => {
        // Double-check auth state before redirecting
        const finalAuthCheck = isAuthenticatedRef.current && userRef.current
        if (!hasRedirected.current && !finalAuthCheck) {
          hasRedirected.current = true
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/supplier/dashboard'
          // Preserve query parameters in redirect URL
          const fullPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : currentPath
          const returnUrl = encodeURIComponent(fullPath)
          router.push(`/auth/login?redirect=${returnUrl}`)
        }
      }, 2000) // Wait 2 seconds before redirecting to allow auth check to complete
      return
    }

    // Reset redirect flag if user is authenticated
    hasRedirected.current = false

    // Check if user is supplier - check multiple sources
    // Also check user_metadata for OAuth users (Google login)
    const isSupplierFromMetadata = (currentUser as any)?.user_metadata?.is_supplier || 
                                   (currentUser as any)?.user_metadata?.isSupplier ||
                                   (currentUser as any)?.app_metadata?.is_supplier ||
                                   (currentUser as any)?.app_metadata?.isSupplier
    const isSupplier = currentUser.isSupplier || currentUser.profile?.is_supplier || isSupplierFromMetadata || false
    const isAdmin = currentUser.role === 'admin'
    
    // Don't redirect if user is on company-info page (registration flow)
    // Already checked at the top, but double-check here with fallback
    const currentPathCheck = pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
    if (currentPathCheck === '/supplier/company-info') {
      return // Allow access to company-info page
    }

    if (!isSupplier && !isAdmin) {
      // Double-check we're not on company-info page before redirecting
      const currentPathCheck = pathname === '/supplier/company-info'
      if (currentPathCheck) {
        return // Don't redirect if on company-info page
      }
      
      // User might be a supplier but profile hasn't loaded yet
      // Wait longer and also check via API to ensure profile data has loaded
      retryTimeoutRef.current = setTimeout(async () => {
        // Double-check supplier status before redirecting
        const finalUser = userRef.current
        const finalCheck = finalUser?.isSupplier || finalUser?.profile?.is_supplier || false
        
        // Check current path again (might have changed) - use fallback
        const finalPathCheck = pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
        const isStillOnCompanyInfo = finalPathCheck === '/supplier/company-info'
        
        if (isStillOnCompanyInfo) {
          return // Don't redirect if still on company-info page
        }
        
        // If still not found, check via API
        if (!finalCheck && !isAdmin && !hasRedirected.current) {
          try {
            const profileResponse = await fetch('/api/auth/session')
            if (profileResponse.ok) {
              const profileData = await profileResponse.json()
              const apiCheck = profileData.user?.isSupplier || profileData.user?.profile?.is_supplier || false
              
              if (!apiCheck && !hasRedirected.current) {
                hasRedirected.current = true
                router.push('/')
              }
              // If API check shows supplier, don't redirect - let component re-render
            } else if (!hasRedirected.current) {
              // If API fails, redirect anyway (user is likely not a supplier)
              hasRedirected.current = true
              router.push('/')
            }
          } catch (error) {
            console.error('Error checking supplier status:', error)
            // On error, redirect to be safe
            if (!hasRedirected.current) {
              hasRedirected.current = true
              router.push('/')
            }
          }
        }
      }, 2000) // Wait 2 seconds to allow profile to load (increased from 500ms)
      return
    }
  }, [loading, forceRender, router, pathname]) // Include pathname to re-check when route changes

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  // Show loading state while checking auth (with timeout to prevent infinite loading)
  if (loading && !forceRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if user is supplier or admin
  // Also check user_metadata for OAuth users (Google login)
  const isSupplierFromMetadata = (user as any)?.user_metadata?.is_supplier || 
                                 (user as any)?.user_metadata?.isSupplier ||
                                 (user as any)?.app_metadata?.is_supplier ||
                                 (user as any)?.app_metadata?.isSupplier
  const isSupplier = user?.isSupplier || user?.profile?.is_supplier || isSupplierFromMetadata || false
  const isAdmin = user?.role === 'admin'
  
  // Allow access to company-info page even if not a supplier yet (for registration flow)
  // Use fallback to window.location.pathname in case pathname hook isn't ready
  const currentPathForRender = pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
  const isCompanyInfoPage = currentPathForRender === '/supplier/company-info'

  if (!isAuthenticated || (!isSupplier && !isAdmin && !isCompanyInfoPage)) {
    // Don't render children if not authorized
    // But if still loading, show loading state instead of null
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
    return null
  }

  return <>{children}</>
}



