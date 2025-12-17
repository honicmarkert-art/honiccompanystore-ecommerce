"use client"

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
  requireAdmin?: boolean
  fallback?: React.ReactNode
}

export function ProtectedRoute({ 
  children, 
  redirectTo = '/', 
  requireAdmin = false,
  fallback
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // If not authenticated, redirect to login
      if (!isAuthenticated || !user) {
        router.push('/auth/login')
        return
      }
      
      // Check email verification - block access to protected routes if not verified
      // OAuth users (like Google) are automatically verified, so skip check for them
      const isOAuthUser = (user as any)?.profile?.provider === 'google' || 
                          (user as any)?.app_metadata?.provider === 'google'
      if (!user.isVerified && !isOAuthUser) {
        // Show message and redirect to home with verification banner
        router.push('/?verify_email=true')
        return
      }
      
      // If admin access required but user is not admin
      if (requireAdmin && !isAdmin) {
        router.push(redirectTo)
        return
      }
    }
  }, [user, loading, isAuthenticated, isAdmin, requireAdmin, redirectTo, router])

  // Show loading state
  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" suppressHydrationWarning></div>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, show nothing (will redirect)
  if (!isAuthenticated || !user) {
    return null
  }

  // If email not verified, show nothing (will redirect)
  // OAuth users (like Google) are automatically verified
  const isOAuthUser = (user as any)?.profile?.provider === 'google' || 
                      (user as any)?.app_metadata?.provider === 'google'
  if (!user.isVerified && !isOAuthUser) {
    return null
  }

  // If admin access required but user is not admin, show nothing (will redirect)
  if (requireAdmin && !isAdmin) {
    return null
  }

  return <>{children}</>
}

// Convenience component for admin-only routes
export function AdminRoute({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute requireAdmin={true} redirectTo="/" fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

// Convenience component for authenticated user routes
export function UserRoute({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
} 