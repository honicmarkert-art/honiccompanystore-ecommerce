"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Lock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function AccountSettingsPage() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [phone, setPhone] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  
  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            setPhone(data.profile.phone || null)
          }
        }
      } catch (error) {
        } finally {
        setLoadingProfile(false)
      }
    }
    
    if (user) {
      fetchProfile()
    }
  }, [user])
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordChangeStep, setPasswordChangeStep] = useState<'request-otp' | 'verify-otp'>('request-otp')
  const [otpCode, setOtpCode] = useState('')

  // Delete account state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteFeedback, setDeleteFeedback] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const deletionReasons = [
    'No longer need the service',
    'Found a better alternative',
    'Too expensive',
    'Technical issues',
    'Poor customer support',
    'Not generating enough sales',
    'Other'
  ]

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    // Step 1: Request OTP
    if (passwordChangeStep === 'request-otp') {
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all password fields',
          variant: 'destructive'
        })
        return
      }

      if (newPassword.length < 8) {
        toast({
          title: 'Validation Error',
          description: 'New password must be at least 8 characters long',
          variant: 'destructive'
        })
        return
      }

      if (newPassword !== confirmPassword) {
        toast({
          title: 'Validation Error',
          description: 'New passwords do not match',
          variant: 'destructive'
        })
        return
      }

      if (currentPassword === newPassword) {
        toast({
          title: 'Validation Error',
          description: 'New password must be different from current password',
          variant: 'destructive'
        })
        return
      }

      setIsChangingPassword(true)

      try {
        const response = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            step: 'request-otp',
            currentPassword,
            newPassword
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to send verification code')
        }

        toast({
          title: 'Verification Code Sent',
          description: 'Please check your email for the verification code'
        })

        // Move to verification step
        setPasswordChangeStep('verify-otp')
        setCurrentPassword('') // Clear current password for security
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Failed',
          variant: 'destructive'
        })
      } finally {
        setIsChangingPassword(false)
      }
      return
    }

    // Step 2: Verify OTP and change password
    if (passwordChangeStep === 'verify-otp') {
      if (!otpCode || otpCode.length !== 6) {
        toast({
          title: 'Validation Error',
          description: 'Please enter the 6-digit verification code',
          variant: 'destructive'
        })
        return
      }

      setIsChangingPassword(true)

      try {
        const response = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            step: 'verify-otp',
            otpCode,
            newPassword
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to change password')
        }

        toast({
          title: 'Success',
          description: 'Password changed successfully'
        })

        // Reset form
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setOtpCode('')
        setPasswordChangeStep('request-otp')
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to change password. Please try again.',
          variant: 'destructive'
        })
      } finally {
        setIsChangingPassword(false)
      }
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      toast({
        title: 'Confirmation Required',
        description: 'Please type "DELETE MY ACCOUNT" to confirm account deletion',
        variant: 'destructive'
      })
      return
    }

    if (!deleteReason) {
      toast({
        title: 'Reason Required',
        description: 'Please select a reason for deletion',
        variant: 'destructive'
      })
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch('/api/supplier/account/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: deleteReason,
          feedback: deleteFeedback.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast({
        title: 'Account Deleted',
        description: 'Your account has been successfully deleted. You will be logged out shortly.',
        duration: 5000
      })

      // Sign out and redirect after a short delay
      setTimeout(async () => {
        await signOut()
        router.push('/')
      }, 2000)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
      setIsDeleting(false)
    }
  }

  return (
    <div className={cn("min-h-screen p-4 md:p-8", themeClasses.backgroundColor)}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link 
          href="/supplier/dashboard"
          className={cn("inline-flex items-center gap-2 mb-6 text-sm hover:underline", themeClasses.textNeutralSecondary)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div>
          <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
            Account Settings
          </h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Manage your account settings and preferences
          </p>
        </div>

        {/* Change Password Section */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className={cn("text-xl", themeClasses.mainText)}>
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordChangeStep === 'request-otp' ? (
                <>
                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Current Password *</Label>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>New Password *</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new password (min. 8 characters)"
                        className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                        required
                        minLength={8}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Confirm New Password *</Label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full"
                  >
                    {isChangingPassword ? 'Sending Verification Code...' : 'Send Verification Code'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      A verification code has been sent to your email address. Please enter the 6-digit code below to complete the password change.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Verification Code *</Label>
                    <Input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText, "text-center text-2xl tracking-widest")}
                      required
                      maxLength={6}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPasswordChangeStep('request-otp')
                        setOtpCode('')
                        setCurrentPassword('')
                      }}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isChangingPassword || otpCode.length !== 6}
                      className="flex-1"
                    >
                      {isChangingPassword ? 'Changing Password...' : 'Verify & Change Password'}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Account Information Section */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <User className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <CardTitle className={cn("text-xl", themeClasses.mainText)}>
                  Account Information
                </CardTitle>
                <CardDescription>
                  Your account details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Email</Label>
                <p className={cn("text-base", themeClasses.mainText)}>{user?.email || 'N/A'}</p>
              </div>
              {loadingProfile ? (
                <div>
                  <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Phone Number</Label>
                  <p className={cn("text-base", themeClasses.textNeutralSecondary)}>Loading...</p>
                </div>
              ) : (
                <div>
                  <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Phone Number</Label>
                  <p className={cn("text-base", themeClasses.mainText)}>{phone || 'Not provided'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delete Account Section */}
        <Card className={cn("border-red-200 dark:border-red-900", themeClasses.cardBg)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className={cn("text-xl text-red-600 dark:text-red-400", themeClasses.mainText)}>
                  Delete Account
                </CardTitle>
                <CardDescription>
                  Permanently delete your supplier account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                ⚠️ Warning: This action cannot be undone
              </p>
              <ul className={cn("mt-2 text-sm list-disc list-inside space-y-1", themeClasses.textNeutralSecondary)}>
                <li>Your account will be permanently deactivated</li>
                <li>All your products will be hidden from customers</li>
                <li>You will lose access to all supplier features</li>
                <li>Your order history and analytics will be preserved but inaccessible</li>
              </ul>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className={cn(themeClasses.cardBg, "max-w-2xl max-h-[90vh] overflow-y-auto")}>
                <AlertDialogHeader>
                  <AlertDialogTitle className={cn(themeClasses.mainText)}>
                    Delete Supplier Account
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    We're sorry to see you go. Please let us know why you're deleting your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Reason for Deletion *</Label>
                    <div className="space-y-2">
                      {deletionReasons.map((r) => (
                        <label
                          key={r}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            deleteReason === r
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                              : cn("border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800", themeClasses.cardBg)
                          )}
                        >
                          <input
                            type="radio"
                            name="deleteReason"
                            value={r}
                            checked={deleteReason === r}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className={cn("text-sm", themeClasses.mainText)}>{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Additional Feedback (Optional)</Label>
                    <Textarea
                      value={deleteFeedback}
                      onChange={(e) => setDeleteFeedback(e.target.value)}
                      placeholder="Tell us more about your experience or what we could improve..."
                      rows={4}
                      className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Type "DELETE MY ACCOUNT" to confirm *</Label>
                    <Input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE MY ACCOUNT"
                      className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => {
                    setDeleteReason('')
                    setDeleteFeedback('')
                    setDeleteConfirmText('')
                  }}>
                    Go Back
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText !== 'DELETE MY ACCOUNT' || !deleteReason}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete My Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

