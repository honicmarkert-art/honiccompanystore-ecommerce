"use client"

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Package, UserPlus, AlertTriangle } from 'lucide-react'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { cn } from '@/lib/utils'

interface SupplierBlockGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Blocks supplier accounts from accessing customer pages
 * Shows a message with option to create a buyer account
 */
export function SupplierBlockGuard({ children, fallback }: SupplierBlockGuardProps) {
  const { user, isAuthenticated, loading } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const router = useRouter()

  useEffect(() => {
    // Redirect suppliers to their dashboard
    if (!loading && isAuthenticated && user && (user.isSupplier || user.profile?.is_supplier)) {
      router.push('/supplier/dashboard')
    }
  }, [user, isAuthenticated, loading, router])

  // Show loading state
  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // If user is a supplier, show blocking message
  if (isAuthenticated && user && (user.isSupplier || user.profile?.is_supplier)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
        <Card className="w-full max-w-md shadow-xl border-2 border-orange-200 dark:border-orange-800">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 w-fit">
              <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Supplier Account Detected
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Supplier accounts cannot access customer pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <AlertDescription className="text-orange-900 dark:text-orange-100">
                Your account is registered as a <strong>Supplier</strong>. To access customer features like shopping, cart, and checkout, you need to create a separate <strong>Buyer Account</strong>.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                onClick={() => openAuthModal('register')}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-all"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Create Buyer Account
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push('/supplier/dashboard')}
                className="w-full border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 font-semibold py-6 text-lg"
              >
                <Package className="w-5 h-5 mr-2" />
                Go to Supplier Dashboard
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                Need help? Contact support for assistance with account management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If not a supplier, render children normally
  return <>{children}</>
}



