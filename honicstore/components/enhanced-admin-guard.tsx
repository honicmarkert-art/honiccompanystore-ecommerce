'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, AlertTriangle, Lock } from 'lucide-react'

interface EnhancedAdminGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
  showAccessDenied?: boolean
}

export function EnhancedAdminGuard({ 
  children, 
  fallback,
  redirectTo = '/',
  showAccessDenied = true
}: EnhancedAdminGuardProps) {
  const { user, isAuthenticated, isAdmin, loading } = useAuth()
  const router = useRouter()
  const [accessChecked, setAccessChecked] = useState(false)

  useEffect(() => {
    if (loading) return

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    // If authenticated but not admin, handle accordingly
    if (isAuthenticated && !isAdmin) {
      setAccessChecked(true)
      if (!showAccessDenied) {
        router.push(redirectTo)
      }
      return
    }

    // If admin, allow access
    if (isAdmin) {
      setAccessChecked(true)
    }
  }, [isAuthenticated, isAdmin, loading, router, redirectTo, showAccessDenied])

  // Show loading state
  if (loading || !accessChecked) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-lg">Verifying Access</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">Checking administrator privileges...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show access denied for non-admin users
  if (isAuthenticated && !isAdmin && showAccessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-lg text-red-900">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Administrator Access Required</span>
            </div>
            <p className="text-gray-600 text-sm">
              You need administrator privileges to access this page.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push('/')}
                className="w-full"
                variant="outline"
              >
                Go to Home
              </Button>
              <Button 
                onClick={() => router.push('/auth/login')}
                className="w-full"
                variant="default"
              >
                Switch Account
              </Button>
            </div>
            <div className="text-xs text-gray-500 pt-2 border-t">
              <p>Current user: {user?.email}</p>
              <p>Role: {user?.role || 'user'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show children for admin users
  return <>{children}</>
}

/**
 * Admin-only page wrapper
 */
export function AdminPage({ children, fallback }: { 
  children: React.ReactNode
  fallback?: React.ReactNode 
}) {
  return (
    <EnhancedAdminGuard fallback={fallback}>
      {children}
    </EnhancedAdminGuard>
  )
}

/**
 * Admin-only component wrapper
 */
export function AdminComponent({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  
  if (!isAdmin) {
    return null // Don't render for non-admin users
  }
  
  return <>{children}</>
}

