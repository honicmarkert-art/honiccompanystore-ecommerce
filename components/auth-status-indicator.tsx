"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogIn, LogOut, Shield, User, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

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

export function AuthStatusIndicator() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    isAdmin: false,
    loading: true
  })

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthStatus(prev => ({ ...prev, loading: true }))
        
        const response = await fetch('/api/auth/test-admin', {
          credentials: 'include'
        })
        
        const data = await response.json()
        
        setAuthStatus({
          authenticated: data.authenticated || false,
          isAdmin: data.isAdmin || false,
          loading: false,
          error: data.error,
          user: data.user
        })
      } catch (error) {
        console.error('Auth check error:', error)
        setAuthStatus({
          authenticated: false,
          isAdmin: false,
          loading: false,
          error: 'Failed to check authentication'
        })
      }
    }

    checkAuth()
  }, [])

  if (authStatus.loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
        <span className="text-sm text-gray-500">Checking auth...</span>
      </div>
    )
  }

  if (!authStatus.authenticated) {
    return (
      <div className="flex items-center space-x-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600">Not authenticated</span>
        <Button size="sm" variant="outline" onClick={() => router.push('/auth/login')}>
          <LogIn className="h-3 w-3 mr-1" />
          Login
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <User className="h-4 w-4 text-green-500" />
      <span className="text-sm text-gray-700">
        {authStatus.user?.email || 'Authenticated'}
      </span>
      <Badge variant={authStatus.isAdmin ? "default" : "secondary"}>
        {authStatus.isAdmin ? (
          <>
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </>
        ) : (
          'User'
        )}
      </Badge>
      <Button 
        size="sm" 
        variant="ghost" 
        onClick={logout}
        className="text-gray-500 hover:text-gray-700"
      >
        <LogOut className="h-3 w-3" />
      </Button>
    </div>
  )
}



