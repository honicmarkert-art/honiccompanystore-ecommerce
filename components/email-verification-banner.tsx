"use client"

import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Mail, X } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export function EmailVerificationBanner() {
  const { user, isAuthenticated } = useAuth()
  const [isResending, setIsResending] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { toast } = useToast()

  // Don't show if user is verified, not authenticated, or dismissed
  // OAuth users (like Google) are automatically verified, so don't show banner
  const isOAuthUser = user && ((user as any)?.profile?.provider === 'google' || 
                                (user as any)?.app_metadata?.provider === 'google')
  if (!isAuthenticated || !user || user.isVerified || isDismissed || isOAuthUser) {
    return null
  }

  const handleResendVerification = async () => {
    if (!user?.email) return

    setIsResending(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Verification Email Sent',
          description: 'Please check your inbox and spam folder.',
          duration: 5000
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to resend verification email',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Alert className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
          <div className="flex-1">
            <AlertTitle className="text-orange-900 dark:text-orange-100 font-semibold">
              Verify Your Email Address
            </AlertTitle>
            <AlertDescription className="text-orange-800 dark:text-orange-200 mt-1">
              Please verify your email address to access all features. Check your inbox for the verification link.
            </AlertDescription>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResendVerification}
                disabled={isResending}
                className="border-orange-600 text-orange-700 hover:bg-orange-100 dark:border-orange-400 dark:text-orange-300 dark:hover:bg-orange-900/30"
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  )
}

