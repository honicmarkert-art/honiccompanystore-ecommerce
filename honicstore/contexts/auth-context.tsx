"use client"

import { createContext, useContext, useEffect, useState, startTransition, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// Simple security logging function
const logSecurityEvent = (action: string, userId?: string, details?: any) => {
}

const SECURITY_CONFIG = {
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  sessionTimeout: 60 * 60 * 1000 // 1 hour
}

interface User {
  id: string
  email: string
  name?: string
  role?: 'user' | 'admin'
  isVerified?: boolean
  isSupplier?: boolean
  profile?: {
    avatar?: string
    phone?: string
    address?: string
    bio?: string
    is_active?: boolean
    is_verified?: boolean
    is_admin?: boolean
    is_supplier?: boolean
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isLoading: boolean // Add this for compatibility
  isAuthenticated: boolean
  isLoggingIn: boolean
  isAdmin: boolean
  signIn: (email: string, password: string, remember?: boolean, preventRedirect?: boolean, redirectTo?: string) => Promise<{ success: boolean; error?: string; type?: string }>
  signUp: (name: string, email: string, password: string, confirmPassword: string, phone?: string, isSupplier?: boolean, skipModal?: boolean, planId?: string) => Promise<{ success: boolean; error?: string; type?: string }>
  signInWithGoogle: (redirectTo?: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)
  const checkingAuthRef = useRef(false)
  
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  
  // Use refs for router and pathname to avoid recreating checkAuth
  const routerRef = useRef(router)
  const pathnameRef = useRef(pathname)
  
  useEffect(() => {
    routerRef.current = router
    pathnameRef.current = pathname
  }, [router, pathname])

  // Enhanced auth check using official Supabase session API (Best Practice ✅)
  const checkAuth = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (checkingAuthRef.current) {
      return
    }
    
    // Add a safety timeout to force loading to false after 10 seconds
    let safetyTimeout: NodeJS.Timeout | null = null
    
    try {
      checkingAuthRef.current = true
      setLoading(true)
      
      // Set safety timeout
      safetyTimeout = setTimeout(() => {
        if (checkingAuthRef.current) {
          console.warn('Auth check taking too long, forcing loading to false')
          setLoading(false)
          checkingAuthRef.current = false
        }
      }, 10000) // 10 second safety timeout
      
      // Always check session via API to ensure we get the current user
      // Don't rely on client-side cookies for authentication state
            
      // Use the official session API to check authentication with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort()
        }
      }, 5000) // 5 second timeout for better session restoration
      
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include', // Include cookies in the request
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        const result = await response.json()
        
        if (result.success && result.authenticated && result.user) {
          const userData = result.user
          
          // Check if profile was loaded successfully
          const isProfileLoaded = result.isProfileLoaded === true
          
          // If profile wasn't loaded (Supabase connectivity issue), check for admin email
          let userRole = userData.role
          if (!isProfileLoaded && userData.email) {
            // Fallback: Check if email matches known admin emails
            const adminEmails = ['admin1@honic.com', 'admin@honic.com', 'sieme@honic.com']
            if (adminEmails.includes(userData.email.toLowerCase())) {
              userRole = 'admin'
            }
          }
          
          // Extract isSupplier from profile
          const isSupplier = userData.profile?.is_supplier || false
          
          // OAuth users (like Google) are automatically verified
          // Check if user is from OAuth provider
          const isOAuthUser = userData.profile?.provider === 'google' || 
                              (userData as any)?.app_metadata?.provider === 'google'
          const isVerified = userData.isVerified || isOAuthUser
          
          // Set user info with role from database (never trust client cookies)
          const userInfo: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userRole,
            isVerified: isVerified,
            isSupplier: isSupplier,
            profile: userData.profile
          }
          
          setUser(userInfo)
          setIsAuthenticated(true)
          setIsAdmin(userRole === 'admin')
            
          // Handle role-based routing
          const currentPath = pathnameRef.current || (typeof window !== 'undefined' ? window.location.pathname : '/')
          
          // Redirect non-admin users away from admin pages
          if (userRole === 'user' && currentPath.startsWith('/admin')) {
            routerRef.current.replace('/products')
          }
          
          // Redirect suppliers to dashboard if they're on home page or buyer pages (but not already on supplier pages)
          if (isSupplier && userRole !== 'admin') {
            // Don't redirect if already on supplier pages or auth pages
            if (!currentPath.startsWith('/supplier') && 
                !currentPath.startsWith('/auth') && 
                !currentPath.startsWith('/admin') &&
                currentPath !== '/supplier/dashboard') {
              // Small delay to prevent redirect loops
              setTimeout(() => {
                routerRef.current.replace('/supplier/dashboard')
              }, 100)
            }
          }
          
          // Redirect normal users to products page if they're on home page
          if (!isSupplier && userRole !== 'admin' && currentPath === '/') {
            setTimeout(() => {
              routerRef.current.replace('/products')
            }, 100)
          }
          
          // Force redirect normal users away from supplier pages
          if (!isSupplier && userRole !== 'admin' && currentPath.startsWith('/supplier')) {
            // Don't redirect if on company-info page (registration flow)
            if (currentPath !== '/supplier/company-info') {
              setTimeout(() => {
                routerRef.current.replace('/products')
              }, 100)
            }
          }
      } else {
          // No valid session found
        setUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          setUser(null)
          setIsAuthenticated(false)
          setIsAdmin(false)
        } else {
          throw fetchError // Re-throw non-abort errors
        }
      }
    } catch (error) {
      setUser(null)
      setIsAuthenticated(false)
      setIsAdmin(false)
    } finally {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout)
      }
      setLoading(false)
      checkingAuthRef.current = false
    }
  }, []) // Empty dependency array - use refs for router and pathname

  // Handle role-based routing
  const handleRoleBasedRouting = useCallback((role: 'user' | 'admin', currentPath: string) => {
    // Only redirect if user is trying to access admin pages without admin privileges
    if (role === 'user' && (currentPath.startsWith('/admin') || currentPath.startsWith('/siem-dashboard'))) {
    startTransition(() => {
          router.replace('/')
      })
        }
    // Admin users can access all pages, no redirects needed
  }, [router])

  // Refresh user data
  const refreshUser = useCallback(async () => {
    // Reset the ref to allow a new check
    checkingAuthRef.current = false
    await checkAuth()
  }, []) // Empty dependency - checkAuth is stable

  const hasCheckedAuthRef = useRef(false)
  useEffect(() => {
    // Check auth on component mount only once - no periodic checks to avoid UI flickering
    if (!hasCheckedAuthRef.current) {
      hasCheckedAuthRef.current = true
      checkAuth()
    }
  }, []) // Empty dependency array - only run once on mount

  // Secure sign in using HttpOnly cookies
  const signIn = async (email: string, password: string, remember: boolean = false, preventRedirect: boolean = false, redirectTo?: string) => {
    // Check for lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60)
      logSecurityEvent('Login attempt during lockout', undefined, { email, remainingTime })
      return { 
        success: false, 
        error: `Account temporarily locked. Please try again in ${remainingTime} minutes.`,
        type: 'RATE_LIMIT'
      }
    }

    // Prevent multiple simultaneous login attempts
    if (isLoggingIn) {
      return { success: false, error: "Login already in progress", type: 'NETWORK_ERROR' }
    }
    
    try {
      setIsLoggingIn(true)
      
      // Use the official Supabase login API with timeout (Best Practice ✅)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort()
        }
      }, 10000) // 10 second timeout
      
      let result
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies in the request
          signal: controller.signal,
          body: JSON.stringify({ email, password, remember })
        })
        
        clearTimeout(timeoutId)
        result = await response.json()
        
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return { 
            success: false, 
            error: "Login request timed out. Please try again.",
            type: 'TIMEOUT'
          }
        } else {
          throw fetchError // Re-throw non-abort errors
        }
      }
      

      if (!result.success) {
        // Handle failed login
        const newAttempts = loginAttempts + 1
        setLoginAttempts(newAttempts)
        
        if (newAttempts >= SECURITY_CONFIG.maxLoginAttempts) {
          const lockoutTime = Date.now() + SECURITY_CONFIG.lockoutDuration
          setLockoutUntil(lockoutTime)
          logSecurityEvent('Account locked due to failed attempts', undefined, { 
            email, 
            attempts: newAttempts,
            lockoutUntil: lockoutTime 
          })
        }
        
        logSecurityEvent('Failed login attempt', undefined, { 
          email, 
          attempts: newAttempts,
          error: result.error 
        })
        
            toast({
          title: "Login Failed",
          description: result.error || "An error occurred during login",
          variant: "destructive"
        })

        return { 
          success: false, 
          error: result.error,
          type: result.type || 'INVALID_CREDENTIALS'
        }
      }

      if (result.success && result.user) {
        // Reset login attempts on successful login
        setLoginAttempts(0)
        setLockoutUntil(null)
        
        logSecurityEvent('Successful login', undefined, { email })
        
        // Update UI immediately for faster response
        const isSupplier = result.user.isSupplier || result.user.profile?.is_supplier || false
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          isVerified: result.user.isVerified,
          isSupplier: isSupplier,
          profile: result.user.profile
        })
        setIsAuthenticated(true)
        setIsAdmin(result.user.role === 'admin')

        // Redirect immediately after successful login (unless prevented)
        if (!preventRedirect) {
          // Use the passed redirectTo parameter, or the API response redirectTo, or determine based on role
          let finalRedirect = redirectTo || result.redirectTo
          
          // If no explicit redirect, determine based on user role
          if (!finalRedirect) {
            if (result.user.role === 'admin') {
              finalRedirect = '/' // Admin can go anywhere
            } else if (isSupplier) {
              finalRedirect = '/supplier/dashboard'
            } else {
              finalRedirect = '/products' // Regular buyer goes to products page
            }
          }
          
          router.replace(finalRedirect)
        }

        return { success: true }
      } else {
        // Handle failed login
        const newAttempts = loginAttempts + 1
        setLoginAttempts(newAttempts)
        
        if (newAttempts >= SECURITY_CONFIG.maxLoginAttempts) {
          const lockoutTime = Date.now() + SECURITY_CONFIG.lockoutDuration
          setLockoutUntil(lockoutTime)
          logSecurityEvent('Account locked due to failed attempts', undefined, { 
            email, 
            attempts: newAttempts,
            lockoutUntil: lockoutTime 
          })
        }
        
        logSecurityEvent('Failed login attempt', undefined, { 
          email, 
          attempts: newAttempts,
          error: result.error 
        })
        
        toast({
          title: "Login Failed",
          description: result.error || "An error occurred during login",
          variant: "destructive"
        })

        return { 
          success: false, 
          error: result.error,
          type: result.type
        }
      }
    } catch (error) {
      
      toast({
        title: "Login Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      })
      return { 
        success: false, 
        error: "Network error. Please check your connection and try again.",
        type: 'NETWORK_ERROR'
      }
    } finally {
      setIsLoggingIn(false)
    }
  }

  const signUp = async (name: string, email: string, password: string, confirmPassword: string, phone?: string, isSupplier?: boolean, skipModal?: boolean, planId?: string) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) controller.abort()
      }, 10000)

      let result: any
      try {
        const response = await fetch('/api/auth/supabase-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ name, email, password, confirmPassword, phone, isSupplier, planId })
        })
        clearTimeout(timeoutId)
        result = await response.json()
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          toast({ title: 'Registration Timeout', description: 'Please try again.', variant: 'destructive' })
          return { success: false, error: 'TIMEOUT', type: 'TIMEOUT' }
        }
        throw fetchError
      }

      if (result?.success) {
        // If session is returned, auto-login the user (even if email not verified)
        // Check both result.data?.session and result.session (API might return it at root level)
        const session = result.data?.session || result.session
        const userData = result.user || result.data?.user
        
        if (session && userData) {
          // Set client-side session in Supabase client (for localStorage)
          if (typeof window !== 'undefined' && session) {
            try {
              const { supabaseClient } = await import('@/lib/supabase-client')
              await supabaseClient.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              })
              console.log('✅ Client-side session set for auto-login')
            } catch (sessionError) {
              console.error('⚠️ Error setting client-side session:', sessionError)
              // Continue anyway - server-side cookies are set
            }
          }
          
          // Set user state immediately
          const isVerified = userData.isVerified || !!userData.email_confirmed_at
          const userInfo: User = {
            id: userData.id,
            email: userData.email || email,
            name: name,
            role: 'user',
            isVerified: isVerified,
            isSupplier: isSupplier || false
          }
          
          setUser(userInfo)
          setIsAuthenticated(true)
          
          // Refresh user data from server to get full profile (this will also verify session)
          try {
            await refreshUser()
            console.log('✅ User data refreshed after auto-login')
          } catch (refreshError) {
            console.error('⚠️ Error refreshing user data:', refreshError)
            // Continue anyway - user is already set
          }
          
          if (!skipModal) {
            toast({ 
              title: 'Account Created Successfully!', 
              description: isVerified 
                ? 'Welcome! Your account is ready to use.'
                : 'Please check your email to verify your account. Some features will be limited until verified.',
              duration: 6000
            })
            // Close auth modal via global event
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('close-auth-modal'))
            }
          }
          
          return { 
            success: true, 
            message: result.message,
            autoLoggedIn: true,
            isVerified: isVerified
          }
        } else {
          // No session returned - user needs to verify email first
          // Supabase blocks sign-in for unverified users, so auto-login is not possible
          if (!skipModal) {
            toast({ 
              title: 'Account Created Successfully!', 
              description: result.message || 'Please check your email to verify your account. You can log in after verification.',
              duration: 6000
            })
            // Don't close auth modal - let it switch to login tab with email pre-filled
            // The auth-modal component will handle switching to login tab
          }
          return { 
            success: true, 
            message: result.message || 'Account created successfully! Please check your email to verify your account.',
            autoLoggedIn: false // Explicitly set to false
          }
        }
      }

      toast({ title: 'Registration Failed', description: result?.error || 'Please try again.', variant: 'destructive' })
      return { success: false, error: result?.error, type: result?.type }
    } catch (error) {
      toast({ title: 'Registration Error', description: 'Network error. Please try again.', variant: 'destructive' })
      return { success: false, error: 'NETWORK_ERROR', type: 'NETWORK_ERROR' }
    }
  }

  const signInWithGoogle = async () => {
    try {
      const getURL = () => {
        // Use window.location.origin for client-side to get the exact current URL
        if (typeof window !== 'undefined') {
          return window.location.origin
        }
        // Fallback for SSR
        let url =
          process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
          process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
          'http://localhost:3000'
        // Make sure to include `https://` when not localhost.
        url = url.startsWith('http') ? url : `https://${url}`
        // Remove trailing slash
        url = url.endsWith('/') ? url.slice(0, -1) : url
        return url
      }

      // Import supabase client dynamically to avoid SSR issues
      const { supabaseClient } = await import('@/lib/supabase-client')
      
      const redirectTo = `${getURL()}/auth/callback`
      
      // Log the redirect URI for debugging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 App redirect URL (configured in Supabase):', redirectTo)
        console.log('📋 Make sure this URL is in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs')
      }
      
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        toast({
          title: "Google Sign-In Failed",
          description: error.message || "An error occurred during Google sign-in",
          variant: "destructive"
        })
        return { success: false, error: error.message }
      }

      // If successful, the user will be redirected to Google, then back to the callback
      // The callback will handle the session exchange and redirect
      return { success: true }
    } catch (error: any) {
      console.error('Google sign-in error:', error)
      toast({
        title: "Google Sign-In Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      })
      return { success: false, error: "Network error" }
    }
  }

  const signOut = async () => {
    try {
      // First, sign out from Supabase client-side to clear localStorage
      if (typeof window !== 'undefined') {
        try {
          const { supabaseClient } = await import('@/lib/supabase-client')
          await supabaseClient.auth.signOut()
          console.log('✅ Client-side Supabase session cleared')
        } catch (clientError) {
          console.error('⚠️ Error clearing client-side Supabase session:', clientError)
          // Continue with server-side logout
        }
      }

      // Use the official Supabase logout API (Best Practice ✅)
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies in the request
      })

      const result = await response.json()
      
      // Always clear local state regardless of API response
        setUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
        
      // Clear all local storage and session storage
      if (typeof window !== 'undefined') {
        // Clear Supabase's localStorage key
        localStorage.removeItem('supabase.auth.token')
        
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear specific auth-related items
        sessionStorage.removeItem('admin-2fa-verified')
        sessionStorage.removeItem('admin-2fa-time')
        
        // Clear any custom auth tokens that might exist
        localStorage.removeItem('auth-token')
        localStorage.removeItem('refresh-token')
        localStorage.removeItem('user-role')
        localStorage.removeItem('guest_cart') // Clear guest cart on logout
      }
      
      if (result.success) {
        // Show success message
        toast({
          title: "Signed Out",
          description: "You have been successfully signed out.",
          variant: "default"
        })
      } else {
        // Show warning but still proceed with logout
        toast({
          title: "Signed Out",
          description: "You have been signed out locally.",
          variant: "default"
        })
      }
      
      // Force hard redirect to home page to ensure clean state
      // Use window.location.replace to prevent back button and route guard interference
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      } else {
        router.push('/')
        router.refresh()
      }
      
    } catch (error) {
      // Even if there's an error, clear the local state
      setUser(null)
      setIsAuthenticated(false)
      setIsAdmin(false)
      
      // Clear all storage on error as well
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      toast({
        title: "Signed Out",
        description: "You have been signed out.",
        variant: "default"
      })
      
      // Force hard redirect to home page
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      } else {
        router.push('/')
        router.refresh()
      }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { supabaseAuth } = await import('@/lib/supabase-auth')
      const result = await supabaseAuth.resetPassword(email)
      
      if (result.success) {
        toast({
          title: "Email Sent",
          description: result.message || "Password reset instructions have been sent to your email.",
        })
        return { success: true }
      } else {
        toast({
          title: "Reset Error",
          description: result.error || "Failed to send reset email. Please try again.",
          variant: "destructive"
        })
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      console.error('Reset password error:', error)
      toast({
        title: "Reset Error",
        description: error?.message || "An error occurred while sending reset email",
        variant: "destructive"
      })
      return { success: false, error: "Network error" }
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    isLoading: loading, // Add this for compatibility
    isAuthenticated,
    isLoggingIn,
    isAdmin,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    checkAuth,
    resetPassword,
    refreshUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 