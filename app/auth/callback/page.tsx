'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function AuthCallbackPage() {
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
      console.log('📌 Initial hash captured on mount:', hash.substring(0, 100))
    }
  }, [])

  // Log for debugging - run immediately on mount
  useEffect(() => {
    const fullUrl = window.location.href
    const hash = window.location.hash
    const code = searchParams.get('code')
    
    console.log('🔍 Callback page mounted:', {
      fullUrl: fullUrl.substring(0, 300),
      hash: hash.substring(0, 200),
      hashLength: hash.length,
      hasHash: hash.length > 0,
      code: code ? 'present' : 'missing',
      searchParams: Object.fromEntries(searchParams.entries())
    })
    
    // If hash is present, log it immediately before any processing
    if (hash && hash.length > 1) {
      console.log('✅ Hash detected immediately:', {
        hashPreview: hash.substring(0, 100),
        hashFullLength: hash.length
      })
    }
  }, []) // Empty deps - run once on mount

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we've already processed this callback (prevent loops)
        const callbackProcessed = typeof window !== 'undefined' ? sessionStorage.getItem('callback_processed') : null
        if (callbackProcessed === 'true') {
          console.log('⚠️ Callback already processed, skipping...')
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
          console.log('✅ User already authenticated, redirecting away from callback...')
          // Google OAuth always redirects to home page
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('oauth_redirect')
            sessionStorage.removeItem('supplier_registration')
          }
          router.push('/')
          return
        }
        const fullUrl = window.location.href
        
        // Enhanced logging - log everything first
        console.log('🔍 Full callback URL analysis:', {
          fullUrl: fullUrl.substring(0, 200) + (fullUrl.length > 200 ? '...' : ''),
          hash: hash.substring(0, 200) + (hash.length > 200 ? '...' : ''),
          hashLength: hash.length,
          searchParams: Object.fromEntries(searchParams.entries()),
          windowLocationHash: window.location.hash,
        })

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
            console.error('❌ Error parsing hash:', e)
          }
        }
        
        const error = hashParams?.get('error') || searchParams.get('error')
        const errorDescription = hashParams?.get('error_description') || searchParams.get('error_description')

        // Enhanced logging
        console.log('🔍 Processing callback:', {
          hasHash: !!hash,
          hashLength: hash.length,
          hashWithoutHashLength: hashWithoutHash.length,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasError: !!error,
          accessTokenPreview: accessToken ? accessToken.substring(0, 20) + '...' : 'none'
        })

        // Handle OAuth errors
        if (error) {
          console.error('❌ OAuth error:', error, errorDescription)
          setStatus('error')
          setMessage(errorDescription || error || 'Authentication failed. Please try again.')
          return
        }

        // If we have tokens in the hash, Supabase has already authenticated the user
        if (accessToken) {
          console.log('✅ Found access token in hash, setting session...')
          
          try {
            // Set the session using the tokens from the hash
            const { data: { session }, error: sessionError } = await supabaseClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            if (sessionError) {
              console.error('❌ Session error:', sessionError)
              setStatus('error')
              setMessage(sessionError.message || 'Failed to create session. Please try again.')
              return
            }

            if (session && session.user) {
              console.log('✅ Session created successfully:', {
                userId: session.user.id,
                email: session.user.email
              })
              
              // Set cookies server-side so API routes can access the session
              // Use the refresh_token from the hash if session.refresh_token is missing
              const refreshTokenToUse = session.refresh_token || refreshToken || ''
              
              if (!refreshTokenToUse) {
                console.warn('⚠️ No refresh token available - session may not persist')
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
                  console.warn('⚠️ Failed to set cookies:', errorText)
                } else {
                  console.log('✅ Cookies set successfully with refresh token')
                }
              } catch (cookieError) {
                console.error('❌ Error setting cookies:', cookieError)
                // Continue anyway - session is still valid in localStorage
              }

              setStatus('success')
              setMessage('Successfully signed in!')
              
              // Google OAuth always redirects to home page (no supplier redirects)
              // Remove any supplier-related flags
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('oauth_redirect')
                sessionStorage.removeItem('supplier_registration')
              }
              
              // Refresh auth context to update user state (don't wait for it)
              refreshUser().then(() => {
                console.log('✅ Auth context refreshed')
              }).catch((refreshError) => {
                console.error('⚠️ Error refreshing auth context:', refreshError)
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
              console.error('❌ Session created but no user found')
              setStatus('error')
              setMessage('Session created but user data is missing. Please try again.')
              return
            }
          } catch (sessionErr: any) {
            console.error('❌ Exception setting session:', sessionErr)
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
            console.error('Verification error:', exchangeError)
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
                  console.warn('⚠️ Failed to set cookies, but session is valid')
                } else {
                  console.log('✅ Cookies set successfully')
                }
              } catch (cookieError) {
                console.error('❌ Error setting cookies:', cookieError)
                // Continue anyway - session is still valid
              }

              setMessage('Successfully signed in!')
            
              // Google OAuth always redirects to home page (no supplier redirects)
              // Remove any supplier-related flags
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('oauth_redirect')
                sessionStorage.removeItem('supplier_registration')
              }
              
              // Refresh auth context to update user state (don't wait for it)
              refreshUser().then(() => {
                console.log('✅ Auth context refreshed')
              }).catch((refreshError) => {
                console.error('⚠️ Error refreshing auth context:', refreshError)
                // Continue anyway - session is valid
              })
              
              // Don't auto-redirect - let user click "Go to Dashboard" button
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
                refreshUser().catch(err => console.error('⚠️ Error refreshing auth context:', err)),
                
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
                        console.log('✅ Welcome email sent')
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
                          console.log('✅ Welcome notification created')
                        }
                      }
                    }
                  } catch (error) {
                    console.error('⚠️ Background task error:', error)
                    // Don't block user flow
                  }
                })()
              ]).catch(err => console.error('⚠️ Background tasks error:', err))
              
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
          console.log('⚠️ No access token or code found, checking if already authenticated...')
          
          try {
            const { data: { session } } = await supabaseClient.auth.getSession()
            if (session?.user) {
              console.log('✅ User already authenticated, redirecting to home page...')
              // Google OAuth always redirects to home page
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('oauth_redirect')
                sessionStorage.removeItem('supplier_registration')
              }
              router.push('/')
              return
            }
          } catch (checkError) {
            console.error('Error checking session:', checkError)
          }
          
          console.error('❌ No access token or code found')
          console.error('❌ Debug info:', {
            hash: window.location.hash,
            hashLength: window.location.hash.length,
            searchParams: Object.fromEntries(searchParams.entries()),
            fullUrl: window.location.href.substring(0, 300)
          })
          setStatus('error')
          setMessage('No authentication data found in URL. The OAuth callback may have failed. Please try signing in again.')
        }
      } catch (error: any) {
        console.error('❌ Callback error:', error)
        setStatus('error')
        setMessage(error?.message || 'An unexpected error occurred. Please try again.')
      }
    }

    // Add timeout to prevent infinite loading (increased to 30 seconds for email verification)
    const timeoutId = setTimeout(() => {
      if (status === 'loading') {
        console.error('⏱️ Callback timeout - taking too long')
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


