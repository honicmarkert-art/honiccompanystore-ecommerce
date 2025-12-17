import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './use-toast'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  isVerified: boolean
  createdAt?: Date
  lastLogin?: Date
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface LoginData {
  email: string
  password: string
}

interface RegisterData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false
  })
  
  const router = useRouter()
  const { toast } = useToast()

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token) {
        setAuthState(prev => ({ ...prev, isLoading: false }))
        return
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAuthState({
          user: data.user,
          token,
          isLoading: false,
          isAuthenticated: true
        })
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('auth-token')
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false
        })
      }
    } catch (error) {
      console.error('Auth check error:', error)
      localStorage.removeItem('auth-token')
      setAuthState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false
      })
    }
  }, [])

  const login = useCallback(async (data: LoginData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (response.ok) {
        // Store token
        localStorage.setItem('auth-token', result.token)
        
        setAuthState({
          user: result.user,
          token: result.token,
          isLoading: false,
          isAuthenticated: true
        })

        toast({
          title: 'Success',
          description: 'Logged in successfully',
        })

        // Redirect based on role
        if (result.user.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/')
        }

        return { success: true }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Login failed',
          variant: 'destructive'
        })
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Login error:', error)
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive'
      })
      return { success: false, error: 'Network error' }
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [router, toast])

  const register = useCallback(async (data: RegisterData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (response.ok) {
        // Don't auto-login, just show success message
        toast({
          title: 'Account Created Successfully!',
          description: 'Please check your email to verify your account, then login.',
        })

        // Redirect to login page
        router.push('/auth/login')
        return { success: true }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Registration failed',
          variant: 'destructive'
        })
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Registration error:', error)
      toast({
        title: 'Error',
        description: 'An error occurred during registration',
        variant: 'destructive'
      })
      return { success: false, error: 'Network error' }
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [router, toast])

  const logout = useCallback(async () => {
    try {
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error('Logout API error:', error)
    }

    // Clear local state
    localStorage.removeItem('auth-token')
    setAuthState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false
    })

    toast({
      title: 'Success',
      description: 'Logged out successfully',
    })

    // Redirect to home
    router.push('/')
  }, [router, toast])

  const verifyEmail = useCallback(async (token: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })

      const result = await response.json()

      if (response.ok) {
        // Update user state if currently logged in
        setAuthState(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, isVerified: true } : null
        }))

        toast({
          title: 'Success',
          description: result.message || 'Email verified successfully',
        })

        return { success: true }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Email verification failed',
          variant: 'destructive'
        })
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Email verification error:', error)
      toast({
        title: 'Error',
        description: 'An error occurred during email verification',
        variant: 'destructive'
      })
      return { success: false, error: 'Network error' }
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [toast])

  return {
    ...authState,
    login,
    register,
    logout,
    verifyEmail,
    checkAuth
  }
} 
 
 
 
 
 
 
 
 