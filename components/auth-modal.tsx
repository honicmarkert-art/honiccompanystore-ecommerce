"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const { signIn, signUp } = useAuth()
  const router = useRouter()
  const [authError, setAuthError] = useState<string>("")
  const [authSuccess, setAuthSuccess] = useState<string>("")
  const [rememberMe, setRememberMe] = useState(false)

  // Update current tab when defaultTab prop changes
  useEffect(() => {
    setCurrentTab(defaultTab)
  }, [defaultTab])

  // Login form state
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError("")
    
    if (!loginForm.email || !loginForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      })
      setIsLoading(false)
      return
    }

    try {
      const result = await signIn(loginForm.email, loginForm.password, rememberMe, true)
      if (!result.success) {
        // Show inline error and let AuthContext toast as well
        setAuthError(result.error || "Login failed. Please try again.")
      } else {
        setAuthSuccess("Login successful! Welcome back.")
        // Auto-close after successful login (short delay for UX)
        setTimeout(() => {
          if (redirectUrl) {
            router.push(redirectUrl)
          }
          onClose()
        }, 800)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Login failed. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple rapid submissions
    if (isLoading) return
    
    setIsLoading(true)
    setAuthError("")
    
    // Clear previous errors
    setAuthError("")
    
    // Basic validation
    if (!registerForm.fullName || !registerForm.email || !registerForm.password || !registerForm.confirmPassword) {
      setAuthError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (registerForm.password.length < 8) {
      setAuthError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    // Check password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
    if (!passwordRegex.test(registerForm.password)) {
      setAuthError("Password must contain at least one uppercase letter, one lowercase letter, and one number")
      setIsLoading(false)
      return
    }

    try {
      const result = await signUp(
        registerForm.fullName,
        registerForm.email,
        registerForm.password,
        registerForm.confirmPassword,
        registerForm.phone
      )
      
      if (result.success) {
        // Show success inline only (no toast, no auto-close)
        setAuthSuccess(result.message || "Account created successfully! Please check your email to verify your account.")
        setAuthError("")

        // Clear form
        setRegisterForm({
          fullName: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: ''
        })
      } else {
        // Show specific error message
        setAuthError(result.error || "Registration failed. Please try again.")
        
        // Keep toast for errors
        toast({ title: "Registration Failed", description: result.error || "Please check your information and try again.", variant: "destructive" })
      }
    } catch (error) {
      console.error('Registration error:', error)
      setAuthError("Network error. Please check your connection and try again.")
      toast({
        title: "Network Error",
        description: "Please check your internet connection and try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog 
      open={isOpen}
      onOpenChange={(open) => {
        // Only close when explicitly requested
        if (!open) onClose()
      }}
    >
      <DialogContent 
        className="w-[calc(100vw-2rem)] sm:max-w-[380px] max-h-[70vh] p-0 top-[35%] mx-auto bg-white dark:bg-gray-900 rounded-lg overflow-y-auto overscroll-contain"
        // Prevent accidental close due to outside interactions (e.g., browser prompts)
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-3 pb-1">
          <DialogTitle className="text-center text-base font-bold text-gray-900 dark:text-gray-100">
            Welcome to Honic Co.
          </DialogTitle>
        </DialogHeader>

        {currentTab === 'login' ? (
          <Card className="border-0 shadow-none mt-4 bg-white dark:bg-gray-900">
            <CardHeader className="px-4 pb-1">
              <CardTitle className="text-sm text-gray-900 dark:text-gray-100">Sign In to Your Account</CardTitle>
              <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {authSuccess && (
                <Alert className="mb-2 border-green-200 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{authSuccess}</AlertDescription>
                </Alert>
              )}
              {authError && (
                <Alert variant="destructive" className="mb-2">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleLogin} className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="login-email" className="text-xs text-gray-900 dark:text-gray-100">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleLogin(e)
                        }
                      }}
                      className="pl-10 h-8 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="login-password" className="text-xs text-gray-900 dark:text-gray-100">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleLogin(e)
                        }
                      }}
                      className="pl-10 pr-10 h-8 text-sm"
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 py-1 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="rounded border-gray-300"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <Label htmlFor="remember" className="text-xs text-gray-900 dark:text-gray-100">
                      Remember me
                    </Label>
                  </div>
                  <Button type="button" variant="link" className="text-xs text-orange-500 hover:text-orange-600">
                    Forgot password?
                  </Button>
                </div>

                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 h-8 text-sm" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-2">
                <Separator className="my-2" />
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Button
                      type="button"
                      variant="link"
                      className="text-orange-500 hover:text-orange-600 p-0 h-auto text-xs"
                      onClick={() => setCurrentTab('register')}
                    >
                      Create one here
                    </Button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-none mt-4 bg-white dark:bg-gray-900">
            <CardHeader className="px-4 pb-1">
              <CardTitle className="text-sm text-gray-900 dark:text-gray-100">Create Your Account</CardTitle>
              <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                Join Honic Co. and start your journey
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {authSuccess && (
                <Alert className="mb-2 border-green-200 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{authSuccess}</AlertDescription>
                </Alert>
              )}
              {authError && (
                <Alert variant="destructive" className="mb-2">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleRegister} className="space-y-1.5">
                <div className="space-y-1">
                  <Label htmlFor="register-fullname" className="text-xs text-gray-900 dark:text-gray-100">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="register-fullname"
                      type="text"
                      placeholder="Full name"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleRegister(e)
                        }
                      }}
                      className="pl-10 h-8 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="register-email" className="text-xs text-gray-900 dark:text-gray-100">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleRegister(e)
                        }
                      }}
                      className="pl-10 h-8 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="register-phone" className="text-xs text-gray-900 dark:text-gray-100">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="Phone"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleRegister(e)
                        }
                      }}
                      className="pl-10 h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="space-y-1">
                    <Label htmlFor="register-password" className="text-xs text-gray-900 dark:text-gray-100">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleRegister(e)
                          }
                        }}
                        className="pl-10 pr-10 h-8 text-sm"
                        autoComplete="new-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-2 py-1 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="register-confirm-password" className="text-xs text-gray-900 dark:text-gray-100">Confirm *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleRegister(e)
                          }
                        }}
                        className="pl-10 pr-10 h-8 text-sm"
                        autoComplete="new-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-2 py-1 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="terms"
                    className="rounded border-gray-300"
                    required
                  />
                  <Label htmlFor="terms" className="text-xs text-gray-900 dark:text-gray-100">
                    I agree to the{' '}
                    <Link href="/services/terms-of-service" className="text-orange-500 hover:text-orange-600 underline" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link href="/services/privacy-policy" className="text-orange-500 hover:text-orange-600 underline" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                      Privacy
                    </Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 h-8 text-sm" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-1.5">
                <Separator className="my-1.5" />
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Already have an account?{' '}
                    <Button
                      type="button"
                      variant="link"
                      className="text-orange-500 hover:text-orange-600 p-0 h-auto text-xs"
                      onClick={() => setCurrentTab('login')}
                    >
                      Sign in here
                    </Button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
} 