"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, AlertTriangle } from 'lucide-react'

interface AdminRoleGuardProps {
  children: React.ReactNode
}

export function AdminRoleGuard({ children }: AdminRoleGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // User not logged in, redirect to login
        router.push('/auth/login?redirect=/siem-dashboard')
        return
      }

      if (user.role !== 'admin' && user.profile?.is_admin !== true) {
        // User logged in but not admin, show access denied
        setIsChecking(false)
        return
      }

      // User is admin, allow access
      setIsChecking(false)
    }
  }, [user, loading, router])

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-blue-600 animate-spin" />
              <span>Verifying admin access...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  if (user.role !== 'admin' && user.profile?.is_admin !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>Access Denied</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You don't have admin privileges to access this area.
            </p>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
                className="flex-1"
              >
                Go to Home
              </Button>
              <Button 
                onClick={() => router.push('/auth/login')}
                className="flex-1"
              >
                Login as Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
