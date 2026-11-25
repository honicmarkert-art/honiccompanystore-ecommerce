"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye, EyeOff, Mail, Lock, User, Phone, Store, CheckCircle, ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { validateEmailFormat } from '@/lib/email-validation'
import { Turnstile, TURNSTILE_SITE_KEY } from '@/components/turnstile'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'login' | 'register'
  redirectUrl?: string
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login', redirectUrl }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTab, setCurrentTab] = useState<'login' | 'register'>(defaultTab)
  const { toast } = useToast()
  const { signIn, signUp, signInWithGoogle, user } = useAuth()
  // Bot check on sign-up (only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set); a token works once
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const router = useRouter()
  const [authError, setAuthError] = useState<string>("")
  const [authSuccess, setAuthSuccess] = useState<string>("")
  // "Keep me signed in" is on by default (most shoppers use their own phone); untick on shared computers
  const [rememberMe, setRememberMe] = useState(true)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string>("") // Store email from registration
  const [showVerificationMessage, setShowVerificationMessage] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string>("")
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  })

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [registerEmailError, setRegisterEmailError] = useState<string>("")
  const [registerEmailValidationTimeout, setRegisterEmailValidationTimeout] = useState<NodeJS.Timeout | null>(null)
  // Removed redirect card state - redirect happens immediately via AuthContext
  
  // Check if this is a supplier flow (hide Google sign-in for suppliers)
  const isSupplierFlow = redirectUrl?.startsWith('/supplier') || 
                         (typeof window !== 'undefined' && sessionStorage.getItem('supplier_registration') === 'true')

  // Update current tab when defaultTab prop changes or modal opens
  // For supplier flow, always force login tab (no registration)
  useEffect(() => {
    if (isOpen) {
      if (isSupplierFlow) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only data after mount, so the server render matches
        setCurrentTab('login') // Force login tab for supplier flow
      } else {
        setCurrentTab(defaultTab)
      }
    }
  }, [defaultTab, isOpen, isSupplierFlow])

  // Pre-fill login email when registeredEmail is set
  useEffect(() => {
    if (registeredEmail && currentTab === 'login' && isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps local state in sync with props/route changes
      setLoginForm(prev => ({
        ...prev,
        email: registeredEmail
      }))
    }
  }, [registeredEmail, currentTab, isOpen])

  // Check for pending verification email when modal opens on login tab
  useEffect(() => {
    if (isOpen && currentTab === 'login') {
      const pendingEmail = typeof window !== 'undefined' ? sessionStorage.getItem('pending_verification_email') : null
      if (pendingEmail) {
        // Check if email is already verified before showing message
        const checkVerificationStatus = async () => {
          try {
            const response = await fetch('/api/auth/check-verification-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: pendingEmail })
            })
            
            const result = await response.json()
            
            if (result.isVerified) {
              // Email is already verified - don't show verification message
              // Clear the pending email and allow login
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('pending_verification_email')
              }
              setShowVerificationMessage(false)
              setPendingVerificationEmail("")
              setLoginForm(prev => ({ ...prev, email: pendingEmail }))
            } else {
              // Email not verified - show verification message
              setPendingVerificationEmail(pendingEmail)
              setShowVerificationMessage(true)
              setLoginForm(prev => ({ ...prev, email: pendingEmail }))
            }
          } catch (error) {
            // If check fails, show verification message (safer default)
            setPendingVerificationEmail(pendingEmail)
            setShowVerificationMessage(true)
            setLoginForm(prev => ({ ...prev, email: pendingEmail }))
          }
        }
        
        checkVerificationStatus()
      }
    }
  }, [isOpen, currentTab])

  // Clear registered email when switching away from login tab
  useEffect(() => {
    if (currentTab !== 'login') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps local state in sync with props/route changes
      setRegisteredEmail("")
      setShowVerificationMessage(false)
      setPendingVerificationEmail("")
    }
  }, [currentTab])

  // Clear all messages and form state when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      // Clear all messages and state when modal closes
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps local state in sync with props/route changes
      setAuthError("")
      setAuthSuccess("")
      setRegisteredEmail("")
      setIsLoading(false)
      setIsGoogleLoading(false)
      // Clear login form
      setLoginForm({
        email: '',
        password: ''
      })
      // Clear register form
      setRegisterForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
      })
      setAgreeToTerms(false)
    } else {
      // When modal opens, ensure tab matches defaultTab
      setCurrentTab(defaultTab)
      // Clear messages when modal opens (in case they were set before)
      setAuthError("")
      setAuthSuccess("")
      setIsLoading(false)
      setIsGoogleLoading(false)
    }
  }, [isOpen, defaultTab])

  // Listen for close-auth-modal event (for auto-login after registration)
  // Only close if we're not in the middle of switching to login tab after registration
  useEffect(() => {
    const handleCloseModal = () => {
      if (isOpen && !registeredEmail) {
        // Only close if we don't have a registered email (meaning we're not switching to login)
        setTimeout(() => {
          onClose()
        }, 500)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('close-auth-modal', handleCloseModal)
      return () => {
        window.removeEventListener('close-auth-modal', handleCloseModal)
      }
    }
  }, [isOpen, onClose, registeredEmail])

  // Login form state
  
  // Cleanup email validation timeout on unmount
  useEffect(() => {
    return () => {
      if (registerEmailValidationTimeout) {
        clearTimeout(registerEmailValidationTimeout)
      }
    }
  }, [registerEmailValidationTimeout])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError("")
    
    // SECURITY: Sanitize inputs to prevent XSS
    const sanitizeInput = (input: string): string => {
      return input
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .substring(0, 255) // Limit length
    }
    
    const sanitizedEmail = sanitizeInput(loginForm.email).toLowerCase()
    const sanitizedPassword = loginForm.password // Don't sanitize password (may contain special chars)
    
    if (!sanitizedEmail || !sanitizedPassword) {
      setAuthError("Enter your email and password.")
      setIsLoading(false)
      return
    }

    // SECURITY: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitizedEmail)) {
      setAuthError("Please enter a valid email address.")
      setIsLoading(false)
      return
    }

    try {
      const result = await signIn(sanitizedEmail, sanitizedPassword, rememberMe, true)
      if (!result.success) {
        // Check if error is due to email not verified
        const errorType = (result as any).type
        if (errorType === 'EMAIL_NOT_VERIFIED' || result.error?.toLowerCase().includes('verify') || result.error?.toLowerCase().includes('verification')) {
          // Show verification message card
          setPendingVerificationEmail(loginForm.email)
          setShowVerificationMessage(true)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('pending_verification_email', loginForm.email)
          }
          setAuthError("")
        } else {
          // Show inline error for other errors
          setAuthError(result.error || "Login failed. Please try again.")
        }
      } else {
        // Login successful - hide verification message if shown
        setShowVerificationMessage(false)
        setPendingVerificationEmail("")
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pending_verification_email')
        }
        
        // Redirect immediately - no success card
        // AuthContext will handle the redirect automatically
        onClose()
      }
    } catch (error) {
      setAuthError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setAuthError("")
    try {
      // Store redirect destination if provided (for supplier pages)
      const redirectDestination = redirectUrl || (typeof window !== 'undefined' ? sessionStorage.getItem('oauth_redirect') : null)
      const result = await signInWithGoogle(redirectDestination || undefined)
      if (!result.success) {
        setAuthError(result.error || "Google sign-in failed. Please try again.")
      } else {
        // Google sign-in will redirect, so we don't need to close modal here
        setAuthSuccess("Redirecting to Google...")
      }
    } catch (error) {
      setAuthError("Network error. Please check your connection and try again.")
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple rapid submissions
    if (isLoading) return
    
    setIsLoading(true)
    setAuthError("")
    
    // SECURITY: Sanitize inputs to prevent XSS
    const sanitizeInput = (input: string, maxLength: number = 255): string => {
      return input
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .substring(0, maxLength) // Limit length
    }
    
    // Sanitize all inputs
    const sanitizedFullName = sanitizeInput(registerForm.fullName, 100)
    const sanitizedEmail = sanitizeInput(registerForm.email, 255).toLowerCase()
    const sanitizedPhone = registerForm.phone ? sanitizeInput(registerForm.phone, 20) : ''
    const password = registerForm.password // Don't sanitize password (may contain special chars)
    const confirmPassword = registerForm.confirmPassword // Don't sanitize password
    
    // Clear previous errors
    setAuthError("")
    
    // Basic validation
    if (!sanitizedFullName || !sanitizedEmail || !password || !confirmPassword) {
      setAuthError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

    // SECURITY: Validate name format (letters, spaces, hyphens, apostrophes only)
    const nameRegex = /^[a-zA-Z\s'-]+$/
    if (!nameRegex.test(sanitizedFullName)) {
      setAuthError("Name can only contain letters, spaces, hyphens, and apostrophes")
      setIsLoading(false)
      return
    }

    // SECURITY: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitizedEmail)) {
      setAuthError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    if (password.length > 128) {
      setAuthError("Password is too long (maximum 128 characters)")
      setIsLoading(false)
      return
    }

    // Check password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
    if (!passwordRegex.test(password)) {
      setAuthError("Password must contain at least one uppercase letter, one lowercase letter, and one number")
      setIsLoading(false)
      return
    }

    // Check if terms are agreed to
    if (!agreeToTerms) {
      setAuthError("You must agree to the Terms and Privacy Policy to create an account")
      setIsLoading(false)
      return
    }

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setAuthError("Please complete the security check below.")
      setIsLoading(false)
      return
    }

    try {
      const result = await signUp(
        sanitizedFullName,
        sanitizedEmail,
        password,
        confirmPassword,
        sanitizedPhone || undefined,
        undefined,
        undefined,
        undefined,
        captchaToken || undefined
      )
      
      if (result.success) {
        // Check if auto-logged in (session was created)
        const autoLoggedIn = (result as any).autoLoggedIn
        
        if (autoLoggedIn) {
          setAuthSuccess(result.message || "Account created successfully! You're now logged in.")
          setAuthError("")
          
          // Clear form
          setRegisterForm({
            fullName: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: ''
          })
          
          // Close modal after short delay to show success message
          setTimeout(() => {
            onClose()
            // Refresh the page to ensure auth state is updated everywhere
            router.refresh()
          }, 1500)
        } else {
          // No auto-login - show success message, switch to login tab, and pre-fill email
          setAuthError("")
          
          // Store the registered email to pre-fill login form
          const registeredEmailValue = registerForm.email
          setRegisteredEmail(registeredEmailValue)
          
          // Clear registration form
          setRegisterForm({
            fullName: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: ''
          })
          setAgreeToTerms(false)
          
          // Switch to login tab and pre-fill email
          setCurrentTab('login')
          setLoginForm({
            email: registeredEmailValue,
            password: ''
          })
          
          // Don't show duplicate success message - the verification card will show the message
          // setAuthSuccess("Account created! Please verify your email to use account features. Check your inbox for the verification link.")
        }
      } else {
        // Show specific error message
        setAuthError(result.error || "Registration failed. Please try again.")
      }
    } catch (error) {
      setAuthError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
      if (TURNSTILE_SITE_KEY) setCaptchaReset((k) => k + 1)
    }
  }

  // Resend the verification email (same API and messages as before)
  const resendVerification = async () => {
    setIsResendingVerification(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingVerificationEmail })
      })
      const result = await response.json()
      if (result.success) {
        toast({ title: 'Verification email sent', description: 'Please check your inbox and spam folder.', duration: 5000 })
      } else if (result.type === 'ALREADY_VERIFIED') {
        toast({ title: 'Email already verified', description: 'You can sign in now.', duration: 5000 })
        setShowVerificationMessage(false)
        setPendingVerificationEmail("")
        if (typeof window !== 'undefined') sessionStorage.removeItem('pending_verification_email')
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to resend verification email', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' })
    } finally {
      setIsResendingVerification(false)
    }
  }

  const validateRegisterEmail = (email: string) => {
    setRegisterEmailError("")
    if (registerEmailValidationTimeout) clearTimeout(registerEmailValidationTimeout)
    const timeout = setTimeout(async () => {
      if (!email.trim()) return
      const emailValidation = validateEmailFormat(email.trim())
      if (!emailValidation.isValid) {
        setRegisterEmailError(emailValidation.error || "Please enter a valid email address")
        return
      }
      try {
        const response = await fetch('/api/auth/validate-email-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        })
        const domainValidation = await response.json()
        setRegisterEmailError(domainValidation.isValid ? "" : (domainValidation.error || "Invalid email domain. Please check your email address."))
      } catch {
        setRegisterEmailError(emailValidation.error || "")
      }
    }, 500)
    setRegisterEmailValidationTimeout(timeout)
  }

  const switchTab = (tab: 'login' | 'register') => {
    setAuthError("")
    setAuthSuccess("")
    setRegisteredEmail("")
    setCurrentTab(tab)
  }

  const passwordChecks = [
    { ok: registerForm.password.length >= 8, label: '8+ characters' },
    { ok: /[A-Z]/.test(registerForm.password) && /[a-z]/.test(registerForm.password), label: 'Upper & lower case' },
    { ok: /\d/.test(registerForm.password), label: 'A number' },
  ]

  const field = "h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-base text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 sm:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
  const labelCls = "mb-1.5 block text-[13px] font-semibold text-neutral-700 dark:text-neutral-300"
  const iconCls = "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"

  const googleButton = (
    <>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" /> or <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isGoogleLoading}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {isGoogleLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
        ) : (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>
    </>
  )

  const messages = (
    <>
      {authSuccess && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-100" role="status">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />{authSuccess}
        </p>
      )}
      {authError && (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100" role="alert">{authError}</p>
      )}
    </>
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setAuthError("")
          setAuthSuccess("")
          setRegisteredEmail("")
          setIsLoading(false)
          setIsGoogleLoading(false)
          onClose()
        }
      }}
    >
      <DialogContent
        className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-[440px] gap-0 overflow-y-auto overscroll-contain rounded-3xl border-0 p-0 shadow-2xl sm:rounded-3xl dark:bg-neutral-950"
        // Prevent accidental close from outside interactions (e.g. browser password prompts); use the × button
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-white px-6 pb-5 pt-6 dark:from-orange-950/30 dark:via-neutral-950 dark:to-neutral-950">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-300/30 blur-3xl" />
          <BrandLogo size="md" href={null} />
          <DialogHeader className="mt-4 space-y-1 text-left">
            <DialogTitle className="text-2xl font-black tracking-tight text-neutral-950 dark:text-white">
              {currentTab === 'login' ? 'Welcome back' : 'Create your account'}
            </DialogTitle>
            <p className="text-sm text-neutral-500">
              {currentTab === 'login'
                ? (isSupplierFlow ? 'Sign in to manage your supplier account.' : 'Sign in to check out faster and track your orders.')
                : 'Save your details, track orders and get price alerts.'}
            </p>
          </DialogHeader>

          {!isSupplierFlow && (
            <div role="tablist" className="relative mt-5 grid grid-cols-2 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-neutral-200 transition-transform duration-200 dark:bg-neutral-800 dark:ring-neutral-700"
                style={{ transform: currentTab === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
              />
              {([['login', 'Sign in'], ['register', 'Create account']] as const).map(([tab, text]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={currentTab === tab}
                  onClick={() => switchTab(tab)}
                  className={cn('relative z-10 rounded-lg py-2 text-sm font-bold transition-colors', currentTab === tab ? 'text-neutral-950 dark:text-white' : 'text-neutral-500 hover:text-neutral-800')}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-5">
          {currentTab === 'login' ? (
            <>
              {messages}

              {showVerificationMessage && pendingVerificationEmail && (
                <div className="mb-4 rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100 dark:bg-orange-950/30 dark:ring-orange-900">
                  <p className="flex items-center gap-2 text-sm font-bold text-orange-900 dark:text-orange-200"><Mail className="h-4 w-4" /> Check your email</p>
                  <p className="mt-1 text-xs leading-relaxed text-orange-800 dark:text-orange-300">
                    We sent a verification link to <strong>{pendingVerificationEmail}</strong>. Open it to activate your account, then sign in.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={resendVerification} disabled={isResendingVerification} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100 disabled:opacity-60">
                      {isResendingVerification ? 'Sending…' : 'Resend email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerificationMessage(false)
                        setPendingVerificationEmail("")
                        setLoginForm({ email: '', password: '' })
                        if (typeof window !== 'undefined') sessionStorage.removeItem('pending_verification_email')
                        switchTab('register')
                      }}
                      className="text-xs font-semibold text-orange-700 underline-offset-2 hover:underline"
                    >
                      Use a different email
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <input id="login-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className={field} required />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="login-password" className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300">Password</label>
                    <button type="button" onClick={() => { onClose(); router.push('/auth/forgot-password') }} className="-my-2 py-2 text-xs font-semibold text-orange-600 hover:text-orange-700">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className={cn(field, 'pr-11')} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:text-neutral-700">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-orange-500" />
                  Keep me signed in
                </label>
                <button type="submit" disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60">
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>

              {!isSupplierFlow && googleButton}
            </>
          ) : (
            <>
              {messages}
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label htmlFor="register-fullname" className={labelCls}>Full name</label>
                  <div className="relative">
                    <User className={iconCls} />
                    <input id="register-fullname" autoComplete="name" placeholder="e.g. Amina Juma" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} className={field} required />
                  </div>
                </div>
                <div>
                  <label htmlFor="register-email" className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => { setRegisterForm({ ...registerForm, email: e.target.value }); validateRegisterEmail(e.target.value) }}
                      className={cn(field, registerEmailError && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
                      required
                    />
                  </div>
                  {registerEmailError && <p className="mt-1 text-xs text-red-600">{registerEmailError}</p>}
                </div>
                <div>
                  <label htmlFor="register-phone" className={labelCls}>Phone <span className="font-normal text-neutral-400">optional</span></label>
                  <div className="relative">
                    <Phone className={iconCls} />
                    <input
                      id="register-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0712 345 678"
                      value={registerForm.phone}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^+\d]/g, '')
                        const finalValue = sanitized.startsWith('+') ? '+' + sanitized.slice(1).replace(/[^0-9]/g, '') : sanitized.replace(/\+/g, '')
                        setRegisterForm({ ...registerForm, phone: finalValue })
                      }}
                      className={field}
                    />
                  </div>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="register-password" className={labelCls}>Password</label>
                    <div className="relative">
                      <Lock className={iconCls} />
                      <input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create one" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className={cn(field, 'pr-10')} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:text-neutral-700">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="register-confirm" className={labelCls}>Confirm</label>
                    <div className="relative">
                      <Lock className={iconCls} />
                      <input id="register-confirm" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat it" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} className={cn(field, 'pr-10', registerForm.confirmPassword && registerForm.confirmPassword !== registerForm.password && 'border-red-400')} required />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:text-neutral-700">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {registerForm.password && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Password requirements">
                    {passwordChecks.map((c) => (
                      <li key={c.label} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500')}>
                        <Check className={cn('h-3 w-3', !c.ok && 'opacity-30')} />{c.label}
                      </li>
                    ))}
                  </ul>
                )}
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  <input type="checkbox" checked={agreeToTerms} onChange={(e) => setAgreeToTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500" />
                  <span>
                    I agree to the{' '}
                    <Link href="/terms" className="font-semibold text-orange-600 hover:underline" onClick={(e) => { e.stopPropagation(); onClose() }}>Terms</Link> and{' '}
                    <Link href="/privacy" className="font-semibold text-orange-600 hover:underline" onClick={(e) => { e.stopPropagation(); onClose() }}>Privacy Policy</Link>
                  </span>
                </label>
                <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} className="min-h-[65px]" />
                <button type="submit" disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60">
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : <>Create account <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>

              {!isSupplierFlow && googleButton}

              <Link href="/become-supplier" onClick={() => onClose()} className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-50 p-3 text-sm transition hover:bg-orange-50 dark:bg-neutral-900">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-orange-600 ring-1 ring-neutral-200 dark:bg-neutral-800"><Store className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-neutral-900 dark:text-white">Want to sell on Honic?</span><span className="block text-xs text-neutral-500">Open a supplier account</span></span>
                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </Link>
            </>
          )}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Your details are encrypted and never shared.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
