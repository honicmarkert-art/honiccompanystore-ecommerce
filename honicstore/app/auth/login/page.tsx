'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { logger } from '@/lib/logger'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState<boolean>(false)
  const [showSuccessCard, setShowSuccessCard] = useState(false)
  const [dashboardUrl, setDashboardUrl] = useState('/products')
  const { signIn, isLoggingIn, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/products'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
        return
    }

    const result = await signIn(email, password, remember, true, redirectTo) // Prevent auto-redirect to show card
    
    if (result.success) {
      // Wait a bit for user state to update, then determine dashboard URL
      setTimeout(() => {
        let dashboardPath = '/products'
        // Check user from auth context or determine from redirect
        if (user?.role === 'admin') {
          dashboardPath = '/'
        } else if (user?.isSupplier) {
          dashboardPath = '/supplier/dashboard'
        } else {
          dashboardPath = redirectTo || '/products'
        }
        
        setDashboardUrl(dashboardPath)
        setShowSuccessCard(true)
        logger.log('Login successful! Showing redirect card')
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          router.push(dashboardPath)
        }, 3000)
      }, 100)
    }
    // Error handling is done by AuthContext - no need to log here
  }

  // Show success card with redirect info
  if (showSuccessCard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="relative">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Login Successful!
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Redirecting you to your dashboard...
                </p>
              </div>
              <div className="w-full pt-4">
                <Button
                  onClick={() => router.push(dashboardUrl)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Redirecting automatically in a few seconds...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Secure Login
            </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                    autoComplete="email"
                required
                     disabled={isLoggingIn}
                  />
              </div>

              <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                  type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  autoComplete="current-password"
                  required
                     disabled={isLoggingIn}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                         onClick={() => setShowPassword(!showPassword)}
                     disabled={isLoggingIn}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={isLoggingIn}
                  />
                  Remember me
                </label>
              </div>

              <Button
                type="submit"
              className="w-full" 
              disabled={isLoggingIn || !email || !password}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
              <Link 
                href="/auth/register" 
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
              >
                Register here
              </Link>
            </div>

          </CardContent>
        </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
 
 
 
 