"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CreditCard, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'

interface PremiumPlan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  description: string
  yearlyPrice?: number | null
}

export default function SupplierPaymentPage() {
  return <SupplierPaymentPageContent />
}

function SupplierPaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  
  const planId = searchParams.get('planId')
  const [plan, setPlan] = useState<PremiumPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed' | null>(null)
  const [paymentReferenceId, setPaymentReferenceId] = useState<string | null>(null)
  const [paymentFailureReason, setPaymentFailureReason] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    // Wait a bit for auth check to complete before redirecting
    if (authLoading) {
      return // Still checking auth, wait
    }

    if (!isAuthenticated) {
      // Add small delay to ensure auth check has fully completed
      const redirectTimer = setTimeout(() => {
        // Only redirect if still not authenticated after delay
        if (!isAuthenticated) {
          const redirectUrl = `/supplier/payment${planId ? `?planId=${planId}` : ''}`
          router.push(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`)
        }
      }, 1000) // Wait 1 second for auth to stabilize
      
      return () => clearTimeout(redirectTimer)
    }

    // User is authenticated, fetch plan details if planId is present
    if (isAuthenticated && planId) {
      fetchPlanDetails()
    }
  }, [authLoading, isAuthenticated, planId, router])

  const fetchPlanDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // First check if user has pending premium plan and payment status
      const profileResponse = await fetch('/api/user/profile', { credentials: 'include' })
      const profileData = await profileResponse.json()

      if (!profileData.profile?.pending_plan_id) {
        // Check if planId matches pending plan or fetch it
        if (planId !== profileData.profile?.pending_plan_id) {
          setError('No pending premium plan found. Please select a premium plan first.')
          setLoading(false)
          return
        }
      }

      const targetPlanId = planId || profileData.profile?.pending_plan_id

      // Check payment status if there's a payment reference
      if (profileData.profile?.payment_reference_id) {
        setPaymentReferenceId(profileData.profile.payment_reference_id)
        
        // Fetch current payment status
        try {
          const statusResponse = await fetch(`/api/supplier/payment/status?referenceId=${profileData.profile.payment_reference_id}`, {
            credentials: 'include'
          })
          const statusData = await statusResponse.json()
          
          if (statusData.success && statusData.payment) {
            const status = statusData.payment.payment_status?.toLowerCase() || 'pending'
            setPaymentStatus(status as 'pending' | 'paid' | 'failed')
            setPaymentFailureReason(statusData.payment.payment_failure_reason || null)
            
            // Show appropriate messages
            if (status === 'paid' || status === 'success') {
              toast({
                title: 'Payment Successful!',
                description: 'Your premium plan has been activated. Enjoy unlimited features!',
                duration: 5000
              })
              // Redirect to dashboard after a delay
              setTimeout(() => {
                router.push('/supplier/dashboard')
              }, 3000)
            } else if (status === 'failed' || status === 'cancelled') {
              toast({
                title: 'Payment Failed',
                description: statusData.payment.payment_failure_reason || 'Payment could not be processed. Please try again.',
                variant: 'destructive',
                duration: 5000
              })
            }
          }
        } catch (statusError) {
          // Continue loading plan even if status check fails
        }
      }

      // Fetch plan details
      const plansResponse = await fetch('/api/supplier-plans')
      const plansData = await plansResponse.json()

      if (plansData.success && plansData.plans) {
        const premiumPlan = plansData.plans.find((p: any) => p.id === targetPlanId && (p.slug === 'premium' || p.price > 0))
        
        if (!premiumPlan) {
          setError('Premium plan not found or invalid.')
          setLoading(false)
          return
        }

        setPlan({
          id: premiumPlan.id,
          name: premiumPlan.name,
          slug: premiumPlan.slug,
          price: premiumPlan.price,
          currency: premiumPlan.currency || 'TZS',
          description: premiumPlan.description || 'Premium plan features',
          yearlyPrice: premiumPlan.yearly_price ?? null
        })
      } else {
        setError('Failed to load plan details. Please try again.')
      }
    } catch (err) {
      setError('An error occurred while loading plan details. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const checkPaymentStatus = async () => {
    if (!paymentReferenceId) return
    
    try {
      setProcessing(true)
      const response = await fetch(`/api/supplier/payment/status?referenceId=${paymentReferenceId}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.payment) {
        const status = data.payment.payment_status?.toLowerCase() || 'pending'
        setPaymentStatus(status as 'pending' | 'paid' | 'failed')
        setPaymentFailureReason(data.payment.payment_failure_reason || null)
        
        if (status === 'paid' || status === 'success') {
          toast({
            title: 'Payment Successful!',
            description: 'Your premium plan has been activated. Enjoy unlimited features!',
            duration: 5000
          })
          setTimeout(() => {
            router.push('/supplier/dashboard')
          }, 2000)
        } else if (status === 'failed' || status === 'cancelled') {
          toast({
            title: 'Payment Failed',
            description: data.payment.payment_failure_reason || 'Payment could not be processed. Please try again.',
            variant: 'destructive',
            duration: 5000
          })
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to check payment status. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handlePayment = async () => {
    if (!plan || !user) return

    try {
      setProcessing(true)
      setError(null)

      // Create payment transaction
      const response = await fetch('/api/supplier/payment/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId: plan.id,
          billingCycle
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(getFriendlyErrorMessage(result.error, 'Unable to open payment page. Please try again.'))
      }

      if (result.checkoutUrl) {
        // Store the new reference ID for status checking
        if (result.referenceId) {
          setPaymentReferenceId(result.referenceId)
          setPaymentStatus('pending') // Set to pending since payment was just initiated
        }
        
        // Open ClickPesa checkout in new tab
        window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')
        
        // Show success message
        toast({
          title: 'Payment Page Opened',
          description: 'Please complete your payment in the new tab. You will be redirected back after payment.',
          duration: 5000
        })
        
        // Reset processing state after opening payment page
        setProcessing(false)
      } else {
        throw new Error('Payment gateway did not return a checkout URL')
      }
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err, 'Unable to open payment page. Please try again.')
      setError(msg)
      setProcessing(false)
      toast({
        title: 'Payment Error',
        description: msg,
        variant: 'destructive'
      })
    }
  }

  if (authLoading || loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", themeClasses.bg)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-500" />
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Loading payment page...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  if (error && !plan) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", themeClasses.bg)}>
        <Card className={cn("max-w-md w-full", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn(themeClasses.mainText)}>Payment Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/supplier/upgrade')} className="w-full">
              Go to Upgrade Page
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", themeClasses.bg)}>
        <Card className={cn("max-w-md w-full", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn(themeClasses.mainText)}>No Plan Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("mb-4", themeClasses.textNeutralSecondary)}>
              Please select a premium plan to proceed with payment.
            </p>
            <Button onClick={() => router.push('/supplier/upgrade')} className="w-full">
              Select Premium Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const basePrice = plan.price || 0
  const isYearly = billingCycle === 'yearly'
  const yearlyPrice = plan.yearlyPrice != null ? plan.yearlyPrice : null
  const displayPrice = isYearly && yearlyPrice != null ? yearlyPrice : basePrice
  const billingLabel = isYearly ? '/year' : '/month'

  return (
    <div
      className={cn(
        "min-h-screen p-4 md:p-8 flex items-center justify-center",
        "bg-gradient-to-b from-orange-50 via-white to-white dark:from-zinc-950 dark:via-black dark:to-black"
      )}
    >
      <div className="max-w-3xl w-full mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100/70 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            Premium Supplier Upgrade
          </div>
          <h1 className={cn("text-3xl md:text-4xl font-extrabold tracking-tight", themeClasses.mainText)}>
            Complete Your Premium Plan Payment
          </h1>
          <p className={cn("text-sm md:text-base max-w-2xl mx-auto", themeClasses.textNeutralSecondary)}>
            Unlock powerful tools to grow your business: more visibility, advanced insights, and priority support.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment Status Alerts */}
        {paymentStatus === 'paid' && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Payment Successful!</strong> Your premium plan has been activated. You will be redirected to your dashboard shortly.
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === 'failed' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Payment Failed</strong>
              {paymentFailureReason && (
                <p className="mt-2">{paymentFailureReason}</p>
              )}
              <p className="mt-2">You can try again by clicking the button below.</p>
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === 'pending' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Payment Pending</strong> Your payment is being processed. Please wait a moment and refresh the status.
            </AlertDescription>
          </Alert>
        )}

        <Card className={cn("shadow-lg border-orange-100/60 dark:border-zinc-800/80", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className={cn("flex items-center gap-2 text-xl md:text-2xl", themeClasses.mainText)}>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  Premium Plan Details
                </CardTitle>
                <CardDescription className={cn("mt-1", themeClasses.textNeutralSecondary)}>
                  Review your plan details before proceeding
                </CardDescription>
              </div>
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-300">
                  <CheckCircle className="h-3 w-3" />
                  Most popular for growing sellers
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={cn("font-medium", themeClasses.mainText)}>Plan Name</span>
                    <span className={cn("font-semibold", themeClasses.mainText)}>{plan.name}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Billing</span>
                    <div className="inline-flex items-center gap-1 rounded-full bg-neutral-100/80 p-1 text-xs dark:bg-zinc-900/80">
                      <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        className={cn(
                          "flex-1 rounded-full px-3 py-1.5 font-semibold transition-all",
                          !isYearly
                            ? "bg-white text-orange-600 shadow-sm dark:bg-zinc-800"
                            : "text-neutral-500 dark:text-neutral-400"
                        )}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle('yearly')}
                        className={cn(
                          "flex-1 rounded-full px-3 py-1.5 font-semibold transition-all",
                          isYearly
                            ? "bg-orange-500 text-white shadow-sm"
                            : "text-neutral-500 dark:text-neutral-400"
                        )}
                      >
                        Yearly
                      </button>
                    </div>
                    <p className={cn("text-[11px] md:text-xs", themeClasses.textNeutralSecondary)}>
                      {isYearly
                        ? "You save around 20% compared to paying every month."
                        : "Switch to yearly billing and save around 20%."}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-orange-200/80 bg-orange-50/60 px-4 py-3 text-xs md:text-sm dark:border-orange-500/30 dark:bg-orange-950/20">
                  <p className={cn("font-medium mb-1 text-orange-800 dark:text-orange-200")}>
                    Premium Features Include:
                  </p>
                  <ul className={cn("grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1", themeClasses.textNeutralSecondary)}>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Unlimited product listings
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Advanced analytics & reporting
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Priority customer support
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Featured product listings
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Custom branding options
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-orange-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
                <p className={cn("text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400")}>
                  Total due today
                </p>
                <div className="space-y-3">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-3xl md:text-4xl font-extrabold text-orange-500">
                      {formatPrice(displayPrice, plan.currency)}
                    </span>
                    {isYearly && (
                      <p className="mt-1 text-[11px] md:text-xs text-emerald-600 dark:text-emerald-400">
                        You’re saving around 20% with yearly billing.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className={cn("text-xs md:text-sm font-medium", themeClasses.textNeutralSecondary)}>
                      {billingLabel}
                    </span>
                    {!isYearly && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                        Cancel anytime
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-[11px] md:text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                    </span>
                    <span className={themeClasses.textNeutralSecondary}>
                      Secure ClickPesa payment • Encrypted & protected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-600 dark:bg-zinc-800 dark:text-neutral-300 text-[9px] font-semibold">
                      i
                    </span>
                    <span className={cn("text-[11px]", themeClasses.textNeutralSecondary)}>
                      You’ll get a receipt and confirmation email after payment.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {paymentStatus === 'paid' ? (
              <Button
                onClick={() => router.push('/supplier/dashboard')}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                size="lg"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            ) : paymentStatus === 'failed' ? (
              <Button
                onClick={handlePayment}
                disabled={processing}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Try Payment Again
                  </>
                )}
              </Button>
            ) : paymentStatus === 'pending' ? (
              <div className="space-y-2">
                <Button
                  onClick={checkPaymentStatus}
                  disabled={processing}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Check Payment Status
                    </>
                  )}
                </Button>
                <Button
                  onClick={handlePayment}
                  disabled={processing}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Create New Payment
                </Button>
              </div>
            ) : (
            <Button
              onClick={handlePayment}
              disabled={processing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Proceed to Payment
                </>
              )}
            </Button>
            )}

            <p className={cn("text-[11px] md:text-xs text-center", themeClasses.textNeutralSecondary)}>
              You will be redirected to our secure payment gateway (ClickPesa) to complete your purchase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

