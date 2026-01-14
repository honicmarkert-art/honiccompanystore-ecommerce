'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser, isAuthenticated } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Processing authentication...')
  
  // Store hash immediately on mount (before React hydration might affect it)
  const [initialHash, setInitialHash] = useState<string>('')
  
  // Capture hash immediately on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      setInitialHash(hash)
    }
  }, [])

  // Log for debugging - run immediately on mount
  useEffect(() => {
    const fullUrl = window.location.href
    const hash = window.location.hash
    const code = searchParams.get('code')
    
    // Callback logging disabled for production cleanliness
  }, []) // Empty deps - run once on mount

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we've already processed this callback (prevent loops)
        const callbackProcessed = typeof window !== 'undefined' ? sessionStorage.getItem('callback_processed') : null
        if (callbackProcessed === 'true') {
          // Google OAuth always redirects to home page
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('oauth_redirect')
            sessionStorage.removeItem('supplier_registration')
          }
          router.push('/')
          return
        }
        
        // Use initial hash if available, otherwise try current hash
        // This ensures we capture the hash even if it gets cleared
        const hash = initialHash || window.location.hash
        
        // If user is already authenticated and there's no hash/code, redirect away
        if (isAuthenticated && !hash && !searchParams.get('code')) {
          // Google OAuth always redirects to home page
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('oauth_redirect')
            sessionStorage.removeItem('supplier_registration')
          }
          router.push('/')
          return
        }
        const fullUrl = window.location.href
        
        // Callback logging disabled for production cleanliness

        // Check for hash fragments first (OAuth tokens)
        const hashWithoutHash = hash.substring(1) // Remove the #
        let hashParams: URLSearchParams | null = null
        let accessToken: string | null = null
        let refreshToken: string | null = null
        
        if (hashWithoutHash) {
          try {
            hashParams = new URLSearchParams(hashWithoutHash)
            accessToken = hashParams.get('access_token')
            refreshToken = hashParams.get('refresh_token')
          } catch (e) {
            }
        }
        
        const error = hashParams?.get('error') || searchParams.get('error')
        const errorDescription = hashParams?.get('error_description') || searchParams.get('error_description')

        // Callback logging disabled for production cleanliness

        // Handle OAuth errors
        if (error) {
          setStatus('error')
          setMessage(errorDescription || error || 'Authentication failed. Please try again.')
          return
        }

        // If we have tokens in the hash, Supabase has already authenticated the user
        if (accessToken) {
          try {
            // Set the session using the tokens from the hash
            const { data: { session }, error: sessionError } = await supabaseClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            if (sessionError) {
              setStatus('error')
              setMessage(sessionError.message || 'Failed to create session. Please try again.')
              return
            }

            if (session && session.user) {
              // Set cookies server-side so API routes can access the session
              // Use the refresh_token from the hash if session.refresh_token is missing
              const refreshTokenToUse = session.refresh_token || refreshToken || ''
              
              if (!refreshTokenToUse) {
                }
              
              try {
                const cookieResponse = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    access_token: session.access_token,
                    refresh_token: refreshTokenToUse,
                  }),
                })

                if (!cookieResponse.ok) {
                  const errorText = await cookieResponse.text()
                  } else {
                  }
              } catch (cookieError) {
                // Continue anyway - session is still valid in localStorage
              }

              setStatus('success')
              setMessage('Successfully signed in!')
              
              // SECURITY: Mark device as verified after successful OAuth login
              if (typeof window !== 'undefined') {
                import('@/lib/device-fingerprint').then(({ markDeviceVerified }) => {
                  markDeviceVerified()
                }).catch(() => {
                  // Ignore errors - device verification is not critical
                })
              }
              
              // Google OAuth always redirects to home page (no supplier redirects)
              // Remove any supplier-related flags
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('oauth_redirect')
                sessionStorage.removeItem('supplier_registration')
              }
              
              // Refresh auth context to update user state (don't wait for it)
              refreshUser().then(() => {
                }).catch((refreshError) => {
                // Continue anyway - session is valid
              })
              
              // Mark callback as processed to prevent loops
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('callback_processed', 'true')
                // Clear after 5 seconds to allow re-authentication if needed
                setTimeout(() => {
                  sessionStorage.removeItem('callback_processed')
                }, 5000)
              }
              
              // Clear the hash from URL
              window.history.replaceState(null, '', window.location.pathname)
              
              // Don't auto-redirect - let user click "Go to Dashboard" button
              return
            } else {
              setStatus('error')
              setMessage('Session created but user data is missing. Please try again.')
              return
            }
          } catch (sessionErr: any) {
            setStatus('error')
            setMessage(sessionErr.message || 'Failed to create session. Please try again.')
            return
          }
        }

        // Check for code parameter (PKCE flow)
        const code = searchParams.get('code')
        const type = searchParams.get('type')
        const token = searchParams.get('token')

        if (code) {
          // Handle OAuth callback or email verification callback
          // Optimize: Set status to loading immediately for better UX
          setStatus('loading')
          setMessage('Verifying email...')
          
          const { data, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            setStatus('error')
            setMessage(exchangeError.message || 'Failed to verify. Please try again.')
            return
          }

          if (data.user) {
            setStatus('success')
            // Check if this is an OAuth sign-in (user already authenticated)
            if (data.session) {
              // Set cookies server-side so API routes can access the session
              try {
                const cookieResponse = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                  }),
                })

                if (!cookieResponse.ok) {
                  } else {
                  }
              } catch (cookieError) {
                // Continue anyway - session is still valid
              }

              setMessage('Successfully signed in!')
            
              // Check if user is supplier and redirect accordingly
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('oauth_redirect')
                const isSupplierRegistration = sessionStorage.getItem('supplier_registration') === 'true'
                sessionStorage.removeItem('supplier_registration')
                
                // Fetch profile to check if user is supplier
                try {
                  const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('is_supplier')
                    .eq('id', data.user.id)
                    .single()
                  
                  const isSupplier = profile?.is_supplier || isSupplierRegistration || false
                  
                  // Refresh auth context to update user state (don't wait for it)
                  refreshUser().then(() => {
                    // Redirect based on user type after auth context is refreshed
                    setTimeout(() => {
                      if (isSupplier) {
                        router.push('/supplier/dashboard')
                      } else {
                        router.push('/products')
                      }
                    }, 500) // Small delay to ensure context is updated
                  }).catch((refreshError) => {
                    // Still redirect based on user type
                    if (isSupplier) {
                      router.push('/supplier/dashboard')
                    } else {
                      router.push('/products')
                    }
                  })
                } catch (profileError) {
                  // Refresh auth context anyway
                  refreshUser().catch((refreshError) => {
                    })
                }
              } else {
                // Refresh auth context to update user state (don't wait for it)
                refreshUser().then(() => {
                  }).catch((refreshError) => {
                  })
              }
              
              // Don't auto-redirect - let user click "Go to Dashboard" button or wait for redirect
            } else {
              // Email verification successful - show success message instead of auto-redirecting
              setStatus('success')
              setMessage('Email verified successfully! You can now log in to your account.')
              
              // Check if email is actually verified
              const isEmailVerified = !!data.user?.email_confirmed_at
              
              if (!isEmailVerified) {
                setStatus('error')
                setMessage('Email verification is still processing. Please wait a moment and try logging in.')
                return
              }
              
              // Do background tasks without blocking UI
              // Run these asynchronously without waiting
              Promise.all([
                // Refresh user context in background
                refreshUser().catch(err => ),
                
                // Send welcome email for new users (fire and forget)
                (async () => {
                  try {
                    const isSupplierRegistration = typeof window !== 'undefined' ? sessionStorage.getItem('supplier_registration') === 'true' : false
                    let isNewUser = false
                    if (data.user?.created_at) {
                      const createdAt = new Date(data.user.created_at)
                      const now = new Date()
                      const timeDiff = now.getTime() - createdAt.getTime()
                      isNewUser = timeDiff < 5 * 60 * 1000
                    }
                    
                    if (isNewUser && data.user?.email) {
                      const response = await fetch('/api/auth/send-welcome-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: data.user.email,
                          name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
                          isSupplier: isSupplierRegistration
                        })
                      })
                      if (response.ok) {
                        }
                      
                      // Create welcome notification for new suppliers
                      if (isSupplierRegistration) {
                        const welcomeResponse = await fetch('/api/notifications/welcome-supplier', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            supplierId: data.user?.id,
                            companyName: data.user?.user_metadata?.full_name || data.user?.email,
                            planSlug: null
                          })
                        })
                        if (welcomeResponse.ok) {
                          }
                      }
                    }
                  } catch (error) {
                    // Don't block user flow
                  }
                })()
              ]).catch(() => {})
              
              // Mark callback as processed
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('callback_processed', 'true')
                setTimeout(() => {
                  sessionStorage.removeItem('callback_processed')
                }, 5000)
              }
              
              // Don't auto-redirect - let user click "Go to Login" button
              return
            }
          }
        } else if (token && type === 'recovery') {
          // Handle password reset callback
          setStatus('success')
          setMessage('Password reset link verified. Redirecting to reset page...')
          router.push(`/auth/reset-password?token=${token}`)
        } else if (!accessToken && !code) {
          // No tokens or code - check if user is already authenticated
          // If so, redirect to appropriate page
          try {
            const { data: { session } } = await supabaseClient.auth.getSession()
            if (session?.user) {
              // Check if user is supplier by fetching profile
              try {
                const { data: profile } = await supabaseClient
                  .from('profiles')
                  .select('is_supplier')
                  .eq('id', session.user.id)
                  .single()
                
                const isSupplier = profile?.is_supplier || false
                
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('oauth_redirect')
                  sessionStorage.removeItem('supplier_registration')
                }
                
                // Redirect suppliers to dashboard, others to products page
                if (isSupplier) {
                  router.push('/supplier/dashboard')
                } else {
                  router.push('/products')
                }
                return
              } catch (profileError) {
                // Fallback to home if profile check fails
                router.push('/')
                return
              }
            }
          } catch (checkError) {
            }
          
          setStatus('error')
          setMessage('No authentication data found in URL. The OAuth callback may have failed. Please try signing in again.')
        }
      } catch (error: any) {
        setStatus('error')
        setMessage(error?.message || 'An unexpected error occurred. Please try again.')
      }
    }

    // Add timeout to prevent infinite loading (increased to 30 seconds for email verification)
    const timeoutId = setTimeout(() => {
      if (status === 'loading') {
        setStatus('error')
        setMessage('Authentication is taking too long. Please try again or contact support if the issue persists.')
      }
    }, 30000) // 30 second timeout (increased for email verification flow)

    handleCallback()

    return () => clearTimeout(timeoutId)
  }, [searchParams, router, status, initialHash, isAuthenticated, refreshUser])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'loading' && 'Processing...'}
            {status === 'success' && (message.includes('verified') ? 'Email Verified!' : 'Successfully Signed In!')}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {status === 'loading' && (
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
            )}
            {status === 'success' && (
              <CheckCircle className="w-12 h-12 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="w-12 h-12 text-red-500" />
            )}
          </div>
          <p className="text-center text-gray-600 dark:text-gray-400">
            {message}
          </p>
          {status === 'success' && (
            <div className="flex flex-col items-center gap-3">
              {message.includes('verified') && !message.includes('signed in') ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Your email has been verified successfully. You can now log in to your account.
                  </p>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/auth/login">Go to Login</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    You have been successfully authenticated. Click below to continue.
                  </p>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/">Go to Dashboard</Link>
                  </Button>
                </>
              )}
            </div>
          )}
          {status === 'error' && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/">Go Home</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/resend-verification">Resend Verification Email</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Processing...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
            </div>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Loading authentication...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}


