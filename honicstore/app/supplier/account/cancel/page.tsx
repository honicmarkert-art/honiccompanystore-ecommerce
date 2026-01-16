"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, X, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function DeleteAccountPage() {
  const router = useRouter()
  const { signOut, user } = useAuth()
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const deletionReasons = [
    'No longer need the service',
    'Found a better alternative',
    'Too expensive',
    'Technical issues',
    'Poor customer support',
    'Not generating enough sales',
    'Other'
  ]

  const handleDelete = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      toast({
        title: 'Confirmation Required',
        description: 'Please type "DELETE MY ACCOUNT" to confirm account deletion',
        variant: 'destructive'
      })
      return
    }

    if (!reason) {
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
          reason,
          feedback: feedback.trim() || null
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
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/supplier/dashboard"
          className={cn("inline-flex items-center gap-2 mb-6 text-sm hover:underline", themeClasses.textNeutralSecondary)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <Card className={cn("border-red-200 dark:border-red-900", themeClasses.cardBg)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className={cn("text-2xl", themeClasses.mainText)}>
                  Delete Supplier Account
                </CardTitle>
                <CardDescription className="mt-1">
                  We're sorry to see you go. Please let us know why you're deleting your account.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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

            <div className="space-y-2">
              <Label className={cn("text-base font-semibold", themeClasses.mainText)}>
                Reason for Deletion *
              </Label>
              <div className="space-y-2">
                {deletionReasons.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      reason === r
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                        : cn("border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800", themeClasses.cardBg)
                    )}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className={cn("text-sm", themeClasses.mainText)}>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className={cn("text-base font-semibold", themeClasses.mainText)}>
                Additional Feedback (Optional)
              </Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us more about your experience or what we could improve..."
                rows={4}
                className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
              />
            </div>

            <div className="space-y-2">
              <Label className={cn("text-base font-semibold", themeClasses.mainText)}>
                Type "DELETE MY ACCOUNT" to confirm *
              </Label>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={handleDelete}
                disabled={isDeleting || confirmText !== 'DELETE MY ACCOUNT' || !reason}
                variant="destructive"
                className="flex-1"
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </Button>
              <Button
                onClick={() => router.back()}
                variant="outline"
                disabled={isDeleting}
                className={cn(themeClasses.cardBorder)}
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

