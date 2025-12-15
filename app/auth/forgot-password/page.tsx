'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { resetPassword } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const { themeClasses } = useTheme()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    
    try {
      console.log('📧 Requesting password reset for:', email)
      const result = await resetPassword(email)
      
      if (result.success) {
        setIsSuccess(true)
        toast({
          title: "Email Sent",
          description: "Password reset instructions have been sent to your email. Please check your inbox and spam folder.",
        })
        console.log('✅ Password reset email sent successfully')
      } else {
        console.error('❌ Password reset failed:', result.error)
        toast({
          title: "Error",
          description: result.error || "Failed to send reset email. Please check your email address and try again.",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      console.error('❌ Password reset exception:', error)
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Forgot Password</CardTitle>
          <CardDescription className="text-center">
            {isSuccess 
              ? "Check your email for password reset instructions"
              : "Enter your email address and we'll send you a link to reset your password"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  We've sent password reset instructions to <strong>{email}</strong>
                </p>
                <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                  Please check your inbox and follow the instructions to reset your password.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => router.push('/auth/login')}
                  className="w-full"
                >
                  Back to Login
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmail('')
                    setIsSuccess(false)
                  }}
                  className="w-full"
                >
                  Send Another Email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/auth/login"
                  className={cn("text-sm text-orange-500 hover:text-orange-600 hover:underline", themeClasses.textNeutralSecondary)}
                >
                  <ArrowLeft className="inline mr-1 h-3 w-3" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

