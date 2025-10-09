"use client"

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LogIn, Shield, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AdminAuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface AuthStatus {
  authenticated: boolean
  isAdmin: boolean
  loading: boolean
  error?: string
  user?: {
    id: string
    email: string
    role: string
  }
}

export function AdminAuthGuard({ children, fallback }: AdminAuthGuardProps) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    isAdmin: false,
    loading: true
  })

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        setAuthStatus(prev => ({ ...prev, loading: true }))
        
        const response = await fetch('/api/auth/test-admin', {
          credentials: 'include'
        })
        
        const data = await response.json()
        
        if (response.ok) {
          setAuthStatus({
            authenticated: data.authenticated,
            isAdmin: data.isAdmin,
            loading: false,
            user: data.user
          })
        } else {
          setAuthStatus({
            authenticated: data.authenticated || false,
            isAdmin: data.isAdmin || false,
            loading: false,
            error: data.message || 'Authentication failed'
          })
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setAuthStatus({
          authenticated: false,
          isAdmin: false,
          loading: false,
          error: 'Failed to verify authentication'
        })
      }
    }

    checkAdminAuth()
  }, [])

  if (authStatus.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!authStatus.authenticated) {
    return fallback || (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <LogIn className="h-12 w-12 mx-auto text-orange-500 mb-4" />
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You need to be logged in to access admin features.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => router.push('/auth/login')}
              className="w-full"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!authStatus.isAdmin) {
    return fallback || (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don't have admin privileges to access this page.
                {authStatus.user && (
                  <div className="mt-2 text-sm">
                    Logged in as: {authStatus.user.email} ({authStatus.user.role})
                  </div>
                )}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}



