"use client"

import { createContext, useContext, useEffect, useState, startTransition, useCallback } from 'react'
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
  profile?: {
    avatar?: string
    phone?: string
    address?: string
    bio?: string
    is_active?: boolean
    is_verified?: boolean
    is_admin?: boolean
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isLoading: boolean // Add this for compatibility
  isAuthenticated: boolean
  isLoggingIn: boolean
  isAdmin: boolean
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string; type?: string }>
  signUp: (name: string, email: string, password: string, confirmPassword: string, phone?: string) => Promise<{ success: boolean; error?: string; type?: string }>
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
  
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  // Enhanced auth check using official Supabase session API (Best Practice ✅)
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true)
      
      // Check for session indicator cookie first to avoid unnecessary API calls
      const sessionActive = document.cookie.includes('sb-session-active=true')
      if (!sessionActive) {
        setUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
        setLoading(false)
              return
            }
            
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
          
          // Set user info with role from database (never trust client cookies)
          const userInfo: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            isVerified: userData.isVerified,
            profile: userData.profile
          }
          
          setUser(userInfo)
          setIsAuthenticated(true)
          setIsAdmin(userData.role === 'admin')
            
            // Handle role-based routing only if user is trying to access admin
          if (userData.role === 'user' && pathname?.startsWith('/admin')) {
            router.replace('/')
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
      setLoading(false)
    }
  }, []) // Remove pathname dependency to prevent excessive re-renders

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
    await checkAuth()
  }, [checkAuth])

  useEffect(() => {
    // Check auth on component mount only - no periodic checks to avoid UI flickering
    checkAuth()
  }, [checkAuth])

  // Secure sign in using HttpOnly cookies
  const signIn = async (email: string, password: string, remember: boolean = false, preventRedirect: boolean = false) => {
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
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          isVerified: result.user.isVerified,
          profile: result.user.profile
        })
        setIsAuthenticated(true)
        setIsAdmin(result.user.role === 'admin')

        // Redirect immediately after successful login (unless prevented)
        if (!preventRedirect) {
          // Only redirect if we're on the login page, otherwise stay on current page
          if (pathname === '/auth/login' || pathname === '/auth/register') {
            router.replace(result.redirectTo || '/')
          }
          // If on any other page, stay on that page
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

  const signUp = async (name: string, email: string, password: string, confirmPassword: string, phone?: string) => {
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
          body: JSON.stringify({ name, email, password, confirmPassword, phone })
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
        toast({ title: 'Account Created', description: 'Please sign in to continue.' })
        // Open login modal in-place via global event (no redirect)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { tab: 'login' } }))
        }
        return { success: true }
      }

      toast({ title: 'Registration Failed', description: result?.error || 'Please try again.', variant: 'destructive' })
      return { success: false, error: result?.error, type: result?.type }
    } catch (error) {
      toast({ title: 'Registration Error', description: 'Network error. Please try again.', variant: 'destructive' })
      return { success: false, error: 'NETWORK_ERROR', type: 'NETWORK_ERROR' }
    }
  }

  const signOut = async () => {
    try {
      // Use the official Supabase logout API (Best Practice ✅)
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies in the request
      })

      const result = await response.json()
      
      if (result.success) {
        // Clear user state immediately
        setUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
        
        // Clear 2FA session
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('admin-2fa-verified')
          sessionStorage.removeItem('admin-2fa-time')
        }
        
        // Show success message
        toast({
          title: "Signed Out",
          description: "You have been successfully signed out.",
          variant: "default"
        })
        
        // Redirect to home page
        startTransition(() => {
          router.replace('/')
        })
      } else {
        toast({
          title: "Sign Out Error",
          description: result.error || "An error occurred while signing out",
          variant: "destructive"
        })
      }
    } catch (error) {
      
      // Even if there's an error, clear the local state
      setUser(null)
      setIsAuthenticated(false)
      setIsAdmin(false)
      
      toast({
        title: "Signed Out",
        description: "You have been signed out.",
        variant: "default"
      })
      
      startTransition(() => {
        router.replace('/')
      })
    }
  }

  const resetPassword = async (email: string) => {
    try {
      // For now, return a placeholder response
      // You can implement actual password reset logic here
        toast({
        title: "Reset Not Implemented",
        description: "Password reset functionality is not yet implemented.",
          variant: "destructive"
        })
      return { success: false, error: "Password reset not implemented yet" }
    } catch (error) {
      toast({
        title: "Reset Error",
        description: "An error occurred while sending reset email",
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