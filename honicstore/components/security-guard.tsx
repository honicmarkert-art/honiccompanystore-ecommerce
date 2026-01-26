"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { Loader2, Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SecurityGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
  fallback?: React.ReactNode
}

export function SecurityGuard({ 
  children, 
  requireAuth = false, 
  redirectTo = '/auth/login',
  fallback 
}: SecurityGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!isLoading) {
      setIsChecking(false)
      
      // Check authentication requirement
      if (requireAuth && !isAuthenticated) {
        // For checkout page, use auth modal with redirect
        if (typeof window !== 'undefined' && window.location.pathname === '/checkout') {
          openAuthModal('login', '/checkout')
          router.push('/cart') // Redirect to cart while modal opens
        } else {
          router.push(redirectTo)
        }
        return
      }
      
      // Check email verification - block access to protected routes if not verified
      // OAuth users (like Google) are automatically verified, so skip check for them
      const isOAuthUser = user && ((user as any)?.profile?.provider === 'google' || 
                                    (user as any)?.app_metadata?.provider === 'google')
      if (requireAuth && isAuthenticated && user && !user.isVerified && !isOAuthUser) {
        // Redirect to home with verification message
        router.push('/?verify_email=true')
        return
      }
      
    }
  }, [isAuthenticated, isLoading, requireAuth, router, redirectTo])

  // Give more time for session restoration, especially after browser restart
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isChecking) {
        setIsChecking(false)
      }
    }, 8000) // Increased to 8 seconds for better session restoration

    return () => clearTimeout(timer)
  }, [isChecking])

  // Show loading state
  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Shield className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle>Security Check</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
            <p className="text-gray-600">Verifying your access...</p>
            <p className="text-sm text-gray-500 mt-2">This will only take a moment</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show login required message
  if (requireAuth && !isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Shield className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Please sign in to access this page.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push('/auth/login')}
                className="w-full"
              >
                Sign In
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render children if all checks pass
  return <>{children}</>
}
