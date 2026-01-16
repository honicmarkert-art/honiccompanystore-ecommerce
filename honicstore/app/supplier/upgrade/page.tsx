'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Crown, ArrowUp, CheckCircle, Sparkles, Zap, TrendingUp, Shield, Package, MessageCircle, ArrowDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SupplierPlan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  term: string | null
}

export default function SupplierUpgradePage() {
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<SupplierPlan | null>(null)
  const [premiumPlan, setPremiumPlan] = useState<SupplierPlan | null>(null)
  const [wingaPlan, setWingaPlan] = useState<SupplierPlan | null>(null)
  const [freePlan, setFreePlan] = useState<SupplierPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<SupplierPlan | null>(null)

  const fetchPlans = useCallback(async () => {
    // Don't fetch if already fetched or not authenticated
    if (hasFetched || !isAuthenticated || !user) {
      return
    }

    try {
      setHasFetched(true)
      setLoading(true)
      
      // Fetch current plan
      const currentPlanResponse = await fetch('/api/user/current-plan', {
        credentials: 'include'
      })
      const currentPlanData = await currentPlanResponse.json()
      
      if (currentPlanData.success && currentPlanData.isSupplier) {
        setCurrentPlan(currentPlanData.plan)
      }

      // Fetch all available plans
      const plansResponse = await fetch('/api/supplier-plans')
      const plansData = await plansResponse.json()
      
      if (plansData.success && plansData.plans) {
        const premium = plansData.plans.find((p: SupplierPlan) => p.slug === 'premium')
        const winga = plansData.plans.find((p: SupplierPlan) => p.slug === 'winga')
        const free = plansData.plans.find((p: SupplierPlan) => p.slug === 'free')
        if (premium) {
          setPremiumPlan(premium)
        }
        if (winga) {
          setWingaPlan(winga)
        }
        if (free) {
          setFreePlan(free)
        }
      }
    } catch (error) {
      // Reset hasFetched on error so we can retry
      setHasFetched(false)
      toast({
        title: 'Error',
        description: 'Failed to load plan information',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user, toast, hasFetched])

  useEffect(() => {
    // Wait for auth to finish loading before checking
    // The SupplierRouteGuard in the layout handles authentication, so we just need to wait
    if (authLoading) {
      return
    }

    // Only proceed if user is authenticated (SupplierRouteGuard ensures this)
    // But we still check here as a safety measure
    if (!isAuthenticated || !user) {
      // Don't redirect here - let SupplierRouteGuard handle it
      return
    }

    // Only fetch plans once when authenticated and plans haven't been fetched yet
    if (isAuthenticated && user && !currentPlan && !premiumPlan) {
      fetchPlans()
    }
  }, [user, isAuthenticated, authLoading, currentPlan, premiumPlan, fetchPlans])

  // Calculate plan status (must be before useEffect that uses it)
  const isFreePlan = currentPlan?.slug === 'free'
  const isPremiumPlan = currentPlan?.slug === 'premium'
  const isWingaPlan = currentPlan?.slug === 'winga'

  const handlePlanChange = async (targetPlan: SupplierPlan, requiresRegistration: boolean = false) => {
    if (!targetPlan || !user) return

    // Check if registration number is required (Winga → Free or Winga → Premium)
    if (requiresRegistration && !registrationNumber.trim()) {
      setShowRegistrationForm(true)
      setSelectedTargetPlan(targetPlan)
      return
    }

    try {
      setIsUpgrading(true)
      
      // For free plans (downgrade), assign immediately without payment
      if (targetPlan.price === 0) {
        const assignResponse = await fetch('/api/supplier/assign-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            planId: targetPlan.id,
            registrationNumber: requiresRegistration ? registrationNumber.trim() : undefined
          })
        })

        const assignData = await assignResponse.json()

        if (!assignData.success) {
          throw new Error(assignData.error || 'Failed to change plan')
        }

        toast({
          title: 'Plan Changed',
          description: `Successfully changed to ${targetPlan.name}`,
        })
        
        // Clear registration form
        setShowRegistrationForm(false)
        setRegistrationNumber('')
        setSelectedTargetPlan(null)
        
        // Refresh page to show updated plan
        router.refresh()
        setTimeout(() => {
          window.location.reload()
        }, 1000)
        return
      }

      // For paid plans, initiate payment flow
      // Step 1: Create upgrade transaction
      const initiateResponse = await fetch('/api/supplier/upgrade/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId: targetPlan.id,
          amount: targetPlan.price,
          registrationNumber: requiresRegistration ? registrationNumber.trim() : undefined
        })
      })

      const initiateData = await initiateResponse.json()

      if (!initiateData.success || !initiateData.upgrade) {
        throw new Error(initiateData.error || 'Failed to initiate upgrade')
      }

      const { referenceId } = initiateData.upgrade

      // Step 2: Get user profile for customer details
      const profileResponse = await fetch('/api/user/profile', {
        credentials: 'include'
      })
      const profileData = await profileResponse.json()

      // Step 3: Create ClickPesa checkout link
      const paymentResponse = await fetch('/api/supplier/upgrade/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          referenceId: referenceId,
          customerDetails: {
            fullName: profileData.profile?.full_name || user.name || 'Supplier',
            email: profileData.profile?.email || user.email || '',
            phone: profileData.profile?.phone || ''
          }
        })
      })

      const paymentData = await paymentResponse.json()

      if (!paymentData.success || !paymentData.checkoutUrl) {
        throw new Error(paymentData.error || 'Failed to create payment link')
      }

      // Step 4: Open ClickPesa checkout in new tab
      toast({
        title: 'Payment Page Opened',
        description: 'Please complete your payment in the new tab. You will be redirected back after payment.',
        duration: 5000
      })
      window.open(paymentData.checkoutUrl, '_blank', 'noopener,noreferrer')
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
      setIsUpgrading(false)
      setShowRegistrationForm(false)
      setSelectedTargetPlan(null)
      setRegistrationNumber('')
    }
  }

  const handleUpgrade = async () => {
    if (!premiumPlan || !user) return
    await handlePlanChange(premiumPlan, currentPlan?.slug === 'winga')
  }

  // Determine which plan transitions are allowed
  const canUpgradeToPremium = isFreePlan || isWingaPlan
  const canUpgradeToWinga = false // Free cannot upgrade to Winga
  const canDowngradeToFree = isPremiumPlan || isWingaPlan
  const canDowngradeToWinga = false // Premium cannot downgrade to Winga
  const requiresRegistrationForPremium = isWingaPlan // Winga → Premium requires registration number
  const requiresRegistrationForFree = isWingaPlan // Winga → Free requires registration number

  const premiumFeatures = [
    { icon: Zap, title: 'Priority Support', description: 'Faster response times', responseTime: '2-4 hours', comingSoon: true },
    { icon: MessageCircle, title: 'Live Chat', description: 'Chat with our support team', responseTime: 'Instant', comingSoon: true },
    { icon: TrendingUp, title: 'Enhanced Visibility', description: 'Your products appear higher in search results' },
    { icon: Sparkles, title: 'Advanced Analytics', description: 'Detailed insights into your sales and performance' },
    { icon: Shield, title: 'Premium Badge', description: 'Showcase your premium status to customers' },
    { icon: Crown, title: 'Unlimited Products', description: 'List as many products as you want' },
    { icon: CheckCircle, title: 'Featured Listings', description: 'Get featured placement on category pages' }
  ]

  // Show loading while auth is checking or plans are loading
  if (authLoading || loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", themeClasses.mainBg)}>
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
      </div>
    )
  }

  if (isPremiumPlan) {
    return (
      <div className={cn("min-h-screen py-12", themeClasses.mainBg)}>
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="inline-block p-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500">
                  <Crown className="w-12 h-12 text-white" />
                </div>
                <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>
                  You're Already Premium!
                </h1>
                <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>
                  You're currently on the Premium plan. Enjoy all the benefits!
                </p>
                {freePlan && (
                  <div className="mt-6">
                    <Button 
                      variant="outline"
                      onClick={() => handlePlanChange(freePlan)}
                      disabled={isUpgrading}
                      className="w-full"
                    >
                      <ArrowDown className="w-4 h-4 mr-2" />
                      Downgrade to Free Plan
                    </Button>
                    <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                      Your plan will automatically downgrade to Free when your payment period ends
                    </p>
                  </div>
                )}
                <Button onClick={() => router.push('/supplier/dashboard')} className="mt-4">
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen py-12", themeClasses.mainBg)}>
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block p-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 mb-6">
            <ArrowUp className="w-12 h-12 text-white" />
          </div>
          <h1 className={cn("text-4xl md:text-5xl font-bold mb-4", themeClasses.mainText)}>
            Upgrade to Premium
          </h1>
          <p className={cn("text-lg md:text-xl max-w-2xl mx-auto", themeClasses.textNeutralSecondary)}>
            Unlock powerful features and grow your business faster with our Premium plan
          </p>
        </div>

        {/* Pricing Plans Section */}
        <div className="text-center mb-8">
          <h2 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
            Choose Your Plan
          </h2>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Select the perfect plan for your business needs
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Current Plan */}
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <CardTitle className={cn(themeClasses.mainText)}>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                      <Package className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                        {currentPlan?.name || 'Free Plan'}
                      </h3>
                      <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                        {currentPlan?.price === 0 ? 'TSh 0.00' : formatPrice(currentPlan?.price || 0)}
                        {currentPlan?.term && (
                          <span className={cn("text-sm font-normal ml-1", themeClasses.textNeutralSecondary)}>
                            /{currentPlan.term}
                          </span>
                        )}
                      </p>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        Perfect for getting started
                      </p>
                      {/* Badges */}
                      <div className="flex justify-start mt-2">
                        <span className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                          Starter Plan
                        </span>
                        <span className="px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          Perfect for Small Business
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Winga Plan */}
          <Card className={cn("border-2 border-purple-500", themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <CardTitle className={cn(themeClasses.mainText)}>Winga Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-400 to-purple-600">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                        {wingaPlan?.name || 'Winga Plan'}
                      </h3>
                      <p className={cn("text-2xl font-bold text-purple-600", themeClasses.mainText)}>
                        {wingaPlan ? formatPrice(wingaPlan.price) : 'TSh 0.00'}
                        {wingaPlan?.term && (
                          <span className={cn("text-sm font-normal ml-1", themeClasses.textNeutralSecondary)}>
                            /{wingaPlan.term}
                          </span>
                        )}
                      </p>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        Perfect for Winga business partners
                      </p>
                      {/* Badges */}
                      <div className="flex justify-start mt-2 flex-wrap gap-1">
                        <span className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                          Winga Partner
                        </span>
                        <span className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          5% Commission
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className={cn(themeClasses.textNeutralSecondary)}>Up to 10 products</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className={cn(themeClasses.textNeutralSecondary)}>5% commission rate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className={cn(themeClasses.textNeutralSecondary)}>Basic analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className={cn(themeClasses.textNeutralSecondary)}>Email support</span>
                  </div>
                </div>
                {canDowngradeToFree && freePlan ? (
                  <Button
                    variant="outline"
                    className="w-full mt-4 border-gray-300"
                    onClick={() => handlePlanChange(freePlan, requiresRegistrationForFree)}
                    disabled={isUpgrading}
                  >
                    <ArrowDown className="w-4 h-4 mr-2" />
                    {isWingaPlan ? 'Change to Free Plan' : 'Downgrade to Free'}
                  </Button>
                ) : null}
                {canUpgradeToPremium && premiumPlan ? (
                  <Button
                    className="w-full mt-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    onClick={() => handlePlanChange(premiumPlan, requiresRegistrationForPremium)}
                    disabled={isUpgrading}
                  >
                    <ArrowUp className="w-4 h-4 mr-2" />
                    {isWingaPlan ? 'Upgrade to Premium' : 'Upgrade Now'}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className={cn("border-2 border-yellow-500", themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <CardTitle className={cn(themeClasses.mainText)}>Premium Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                        {premiumPlan?.name || 'Premium Plan'}
                      </h3>
                      <p className={cn("text-2xl font-bold text-yellow-600", themeClasses.mainText)}>
                        {premiumPlan ? formatPrice(premiumPlan.price) : 'Loading...'}
                        {premiumPlan?.term && (
                          <span className={cn("text-sm font-normal ml-1", themeClasses.textNeutralSecondary)}>
                            /{premiumPlan.term}
                          </span>
                        )}
                      </p>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        For growing businesses
                      </p>
                      {/* Badges */}
                      <div className="flex justify-start mt-2">
                        <span className="px-3 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-r border-yellow-200 dark:border-yellow-800">
                          Best Value
                        </span>
                        <span className="px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-r border-blue-200 dark:border-blue-800">
                          Medium & Large Business
                        </span>
                        <span className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          Recommended
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {canUpgradeToPremium ? (
                  <Button
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-6 text-lg"
                    onClick={() => handlePlanChange(premiumPlan!, requiresRegistrationForPremium)}
                    disabled={isUpgrading || !premiumPlan}
                  >
                    {isUpgrading ? (
                      <>
                        <ArrowUp className="w-5 h-5 mr-2 animate-pulse" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ArrowUp className="w-5 h-5 mr-2" />
                        {isWingaPlan ? 'Upgrade to Premium' : 'Upgrade Now'}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-gray-400 text-white font-semibold py-6 text-lg cursor-not-allowed"
                    disabled={true}
                  >
                    Not Available
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Premium Features */}
        <div className="mb-12">
          <h2 className={cn("text-3xl font-bold text-center mb-8", themeClasses.mainText)}>
            Premium Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {premiumFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/20">
                        <Icon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className={cn("font-semibold", themeClasses.mainText)}>
                            {feature.title}
                          </h3>
                          {feature.comingSoon && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400">
                              Coming Soon
                            </Badge>
                          )}
                        </div>
                        <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>
                          {feature.description}
                        </p>
                        {feature.responseTime && (
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            Response time: {feature.responseTime}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn(themeClasses.mainText)}>Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", themeClasses.cardBorder)}>
                    <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Feature</th>
                    <th className={cn("text-center py-3 px-4 font-semibold", themeClasses.mainText)}>Free</th>
                    <th className={cn("text-center py-3 px-4 font-semibold text-yellow-600", themeClasses.mainText)}>Premium</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={cn("border-b", themeClasses.cardBorder)}>
                    <td className={cn("py-3 px-4", themeClasses.mainText)}>Product Listings</td>
                    <td className={cn("text-center py-3 px-4", themeClasses.textNeutralSecondary)}>Limited</td>
                    <td className={cn("text-center py-3 px-4 text-yellow-600 font-semibold", themeClasses.mainText)}>Unlimited</td>
                  </tr>
                  <tr className={cn("border-b", themeClasses.cardBorder)}>
                    <td className={cn("py-3 px-4", themeClasses.mainText)}>Support</td>
                    <td className={cn("text-center py-3 px-4", themeClasses.textNeutralSecondary)}>Standard</td>
                    <td className={cn("text-center py-3 px-4 text-yellow-600 font-semibold", themeClasses.mainText)}>Priority</td>
                  </tr>
                  <tr className={cn("border-b", themeClasses.cardBorder)}>
                    <td className={cn("py-3 px-4", themeClasses.mainText)}>Analytics</td>
                    <td className={cn("text-center py-3 px-4", themeClasses.textNeutralSecondary)}>Basic</td>
                    <td className={cn("text-center py-3 px-4 text-yellow-600 font-semibold", themeClasses.mainText)}>Advanced</td>
                  </tr>
                  <tr className={cn("border-b", themeClasses.cardBorder)}>
                    <td className={cn("py-3 px-4", themeClasses.mainText)}>Search Visibility</td>
                    <td className={cn("text-center py-3 px-4", themeClasses.textNeutralSecondary)}>Standard</td>
                    <td className={cn("text-center py-3 px-4 text-yellow-600 font-semibold", themeClasses.mainText)}>Enhanced</td>
                  </tr>
                  <tr>
                    <td className={cn("py-3 px-4", themeClasses.mainText)}>Featured Listings</td>
                    <td className={cn("text-center py-3 px-4", themeClasses.textNeutralSecondary)}>✗</td>
                    <td className={cn("text-center py-3 px-4 text-yellow-600 font-semibold", themeClasses.mainText)}>✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Registration Number Dialog for Winga → Premium */}
        <Dialog open={showRegistrationForm} onOpenChange={setShowRegistrationForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registration Number Required</DialogTitle>
              <DialogDescription>
                To change your plan from Winga Plan, please provide your business registration number (TIN No or NIDA No).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="registration-number">TIN No or NIDA No *</Label>
                <Input
                  id="registration-number"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="Enter your registration number"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is important for trust and priority in search and orders.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (selectedTargetPlan && registrationNumber.trim()) {
                      handlePlanChange(selectedTargetPlan, false)
                    } else {
                      toast({
                        title: 'Registration Number Required',
                        description: 'Please enter your registration number to continue.',
                        variant: 'destructive'
                      })
                    }
                  }}
                  disabled={!registrationNumber.trim() || isUpgrading}
                  className="flex-1"
                >
                  Continue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRegistrationForm(false)
                    setRegistrationNumber('')
                    setSelectedTargetPlan(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Back Button */}
        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={() => router.push('/supplier/dashboard')}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}



