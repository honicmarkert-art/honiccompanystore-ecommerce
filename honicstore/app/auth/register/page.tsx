"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/hooks/use-theme"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2, CheckCircle, XCircle, Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { validateEmailFormat } from "@/lib/email-validation"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null)
  const [emailValidationTimeout, setEmailValidationTimeout] = useState<NodeJS.Timeout | null>(null)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeout) {
        clearTimeout(emailCheckTimeout)
      }
      if (emailValidationTimeout) {
        clearTimeout(emailValidationTimeout)
      }
    }
  }, [emailCheckTimeout, emailValidationTimeout])

  const { signUp } = useAuth()
  const { themeClasses } = useTheme()
  const router = useRouter()
  const { openAuthModal } = useGlobalAuthModal()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Name validation
    if (!formData.name) {
      newErrors.name = "Full name is required"
    } else if (formData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters long"
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters and spaces"
    }

    // Email validation with domain check
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else {
      const emailValidation = validateEmailFormat(formData.email)
      if (!emailValidation.isValid) {
        newErrors.email = emailValidation.error || "Please enter a valid email address"
      } else {
        setEmailSuggestion(null)
      }
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long"
    } else if (!/(?=.*[a-z])/.test(formData.password)) {
      newErrors.password = "Password must contain at least one lowercase letter"
    } else if (!/(?=.*[A-Z])/.test(formData.password)) {
      newErrors.password = "Password must contain at least one uppercase letter"
    } else if (!/(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Password must contain at least one number"
    } else if (!/(?=.*[@$!%*?&])/.test(formData.password)) {
      newErrors.password = "Password must contain at least one special character (@$!%*?&)"
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match"
    }

    // Terms agreement
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the terms and conditions"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    // Check if email exists before submitting
    if (emailExists) {
      setErrors(prev => ({ ...prev, email: 'An account with this email address already exists. Please use a different email or try logging in.' }))
      return
    }

    // Final email check before submission
    try {
      const emailCheckResponse = await fetch(`/api/auth/check-email?email=${encodeURIComponent(formData.email.toLowerCase().trim())}`)
      const emailCheckData = await emailCheckResponse.json()
      
      if (emailCheckData.exists) {
        setEmailExists(true)
        setErrors(prev => ({ ...prev, email: 'An account with this email address already exists. Please use a different email or try logging in.' }))
        return
      }
    } catch (error) {
      // Continue with submission if check fails (server will validate)
    }

    setIsSubmitting(true)
    setErrors({})
    
    try {
      const result = await signUp(formData.name, formData.email, formData.password, formData.confirmPassword)

      if (!result.success) {
        // Error is already shown by the auth context
        return
      }

      // If registration succeeded but user needs to verify email, open login modal with email pre-filled
      if (result.success && !(result as any).autoLoggedIn) {
        // Store email in sessionStorage for the login modal to pick up
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_verification_email', formData.email)
        }
        
        // Open login modal after a short delay
        setTimeout(() => {
          openAuthModal('login')
        }, 500)
      }
    } catch (error) {
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Real-time email validation as user types
    if (field === 'email' && typeof value === 'string') {
      // Clear previous validation timeout
      if (emailValidationTimeout) {
        clearTimeout(emailValidationTimeout)
      }

      // Clear previous errors
      setErrors(prev => ({ ...prev, email: "" }))
      setEmailExists(false)

      // Validate email after user stops typing (debounce)
      const timeout = setTimeout(async () => {
        if (value.trim().length > 0) {
          // Step 1: Basic format validation
          const emailValidation = validateEmailFormat(value.trim())
          
          if (!emailValidation.isValid) {
            setErrors(prev => ({ 
              ...prev, 
              email: emailValidation.error || "Please enter a valid email address" 
            }))
            return
          }

          // Step 2: DNS/SMTP validation for invalid domains
          try {
            const response = await fetch('/api/auth/validate-email-domain', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: value.trim() })
            })
            
            const domainValidation = await response.json()
            
            if (!domainValidation.isValid) {
              setErrors(prev => ({ 
                ...prev, 
                email: domainValidation.error || "Invalid email domain. Please check your email address." 
              }))
            } else {
              setErrors(prev => ({ ...prev, email: "" }))
            }
          } catch (error) {
            // If DNS check fails, use format validation result
            setErrors(prev => ({ 
              ...prev, 
              email: emailValidation.error || "Please enter a valid email address" 
            }))
          }
        }
      }, 500) // Wait 500ms after user stops typing (longer for DNS check)

      setEmailValidationTimeout(timeout)
    } else {
      // Clear error when user starts typing other fields
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: "" }))
      }
    }
  }

  const getPasswordStrength = () => {
    if (!formData.password) return { strength: 0, color: "gray" }
    
    let strength = 0
    if (formData.password.length >= 8) strength++
    if (/(?=.*[a-z])/.test(formData.password)) strength++
    if (/(?=.*[A-Z])/.test(formData.password)) strength++
    if (/(?=.*\d)/.test(formData.password)) strength++
    if (/(?=.*[@$!%*?&])/.test(formData.password)) strength++
    
    const colors = ["red", "orange", "yellow", "lightgreen", "green"]
    return { strength, color: colors[strength - 1] || "gray" }
  }

  const passwordStrength = getPasswordStrength()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <Link 
          href="/home"
          className={cn(
            "inline-flex items-center gap-2 text-sm mb-6 hover:underline transition-colors",
            themeClasses.textNeutralSecondary
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <Card className="w-full shadow-xl border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Create Account
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Join us and start shopping today
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Want to sell?</p>
                  <p className="text-xs text-muted-foreground">Join as seller</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    toast({
                      title: "Coming Soon",
                      description: "Become Seller feature will be available soon!",
                      duration: 3000,
                    })
                  }}
                  className="border-2 border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-500 dark:hover:text-black whitespace-nowrap"
                >
                  <Store className="mr-1.5 h-3.5 w-3.5" />
                  Become Seller
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={cn(
                      "pl-10",
                      errors.name && "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    autoComplete="name"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={async (e) => {
                      const email = e.target.value
                      handleInputChange("email", email) // This now handles real-time validation
                      setEmailExists(false)
                      
                      // Clear previous timeout
                      if (emailCheckTimeout) {
                        clearTimeout(emailCheckTimeout)
                      }
                      
                      // Only check email existence if format is valid (after real-time validation)
                      const emailValidation = validateEmailFormat(email.trim())
                      if (!emailValidation.isValid || !email || !/\S+@\S+\.\S+/.test(email)) {
                        return
                      }
                      
                      // Debounce email existence check (wait 500ms after user stops typing)
                      const timeout = setTimeout(async () => {
                        setCheckingEmail(true)
                        try {
                          const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email.toLowerCase().trim())}`)
                          const data = await response.json()
                          
                          if (data.exists) {
                            setEmailExists(true)
                            setErrors(prev => ({ ...prev, email: 'An account with this email address already exists. Please use a different email or try logging in.' }))
                          } else {
                            setEmailExists(false)
                            if (errors.email === 'An account with this email address already exists. Please use a different email or try logging in.') {
                              setErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.email
                                return newErrors
                              })
                            }
                          }
                        } catch (error) {
                          // Don't block user if check fails
                        } finally {
                          setCheckingEmail(false)
                        }
                      }, 500)
                      
                      setEmailCheckTimeout(timeout)
                    }}
                    className={cn(
                      "pl-10",
                      (errors.email || emailExists) && "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                </div>
                {checkingEmail && (
                  <p className="text-xs mt-1 text-muted-foreground">Checking email availability...</p>
                )}
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={cn(
                      "pl-10 pr-10",
                      errors.password && "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    autoComplete="new-password"
                    data-1p-ignore
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            level <= passwordStrength.strength
                              ? `bg-${passwordStrength.color}-500`
                              : "bg-gray-200 dark:bg-gray-700"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password strength: {passwordStrength.strength}/5
                    </p>
                  </div>
                )}
                
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={cn(
                      "pl-10 pr-10",
                      errors.confirmPassword && "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    autoComplete="new-password"
                    data-1p-ignore
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isSubmitting}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Terms Agreement */}
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                  <Label htmlFor="agreeToTerms" className="text-sm leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-blue-600 hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href={`/privacy?return=${encodeURIComponent('/auth/register')}`} className="text-blue-600 hover:underline">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
                {errors.agreeToTerms && (
                  <p className="text-sm text-red-500">{errors.agreeToTerms}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            {/* Sign In Link */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
 
 
 
 