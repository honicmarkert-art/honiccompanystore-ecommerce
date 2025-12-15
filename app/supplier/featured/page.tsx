'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { Star, TrendingUp, Eye, CheckCircle, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

interface Product {
  id: number
  name: string
  image: string
  price: number
  views: number
  is_featured: boolean
}

export default function SupplierFeaturedPage() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<{ slug: string } | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [hasValidPremiumPayment, setHasValidPremiumPayment] = useState<boolean>(false)

  useEffect(() => {
    fetchProducts()
    fetchCurrentPlan()
  }, [])

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/user/current-plan', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success && data.plan) {
        setCurrentPlan(data.plan)
        setPendingPlanId(data.pendingPlanId || null)
        setHasValidPremiumPayment(data.hasValidPremiumPayment || false)
      }
    } catch (error) {
      console.error('Error fetching current plan:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/supplier/products?limit=1000', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setProducts((data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          image: p.image || '/placeholder-product.jpg',
          price: p.price,
          views: p.views || 0,
          is_featured: p.is_featured || false
        })))
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFeatured = async (productId: number, currentStatus: boolean) => {
    if (!isPremiumPlan) {
      toast({
        title: 'Premium Feature',
        description: 'Featured product placement is available in Premium Plan only.',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/supplier/products/toggle-featured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          isFeatured: !currentStatus
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: currentStatus ? 'Product Unfeatured' : 'Product Featured',
          description: currentStatus 
            ? 'Product removed from featured listings'
            : 'Product added to featured listings',
        })
        
        setProducts(products.map(p => 
          p.id === productId ? { ...p, is_featured: !currentStatus } : p
        ))
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update featured status',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update featured status',
        variant: 'destructive'
      })
    }
  }

  const isPremiumPlan = currentPlan?.slug === 'premium' && hasValidPremiumPayment
  const isFreePlan = currentPlan?.slug === 'free'
  // Check if premium plan payment is pending (even if API returns free plan due to pending payment)
  const isPremiumPendingPayment = pendingPlanId && !hasValidPremiumPayment
  const featuredProducts = products.filter(p => p.is_featured)
  const nonFeaturedProducts = products.filter(p => !p.is_featured)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-bold", themeClasses.mainText)}>Featured Product Placement</h1>
          <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
            Get your products featured in search results and homepage
          </p>
        </div>
        {!isPremiumPlan && (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs sm:text-sm px-2 sm:px-3 w-fit">
            Premium Feature
          </Badge>
        )}
      </div>

      {!isPremiumPlan ? (
        <>
          {/* Upgrade Prompt */}
          <Card className={cn("border-2 border-yellow-500", themeClasses.cardBg)}>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="text-center">
                <Star className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-yellow-500" />
                <h2 className={cn("text-xl sm:text-2xl font-bold mb-2", themeClasses.mainText)}>
                  {isPremiumPendingPayment 
                    ? 'Complete Payment to Access Featured Placement'
                    : 'Featured Product Placement Available in Premium Plan'}
                </h2>
                <p className={cn("text-xs sm:text-sm mb-4 sm:mb-6 px-2", themeClasses.textNeutralSecondary)}>
                  {isPremiumPendingPayment
                    ? 'Complete your premium plan payment to get your products featured prominently in search results and on the homepage'
                    : 'Get your products featured prominently in search results and on the homepage to increase visibility and sales'}
                </p>
                <button
                  onClick={async () => {
                    if (isPremiumPendingPayment && pendingPlanId) {
                      router.push(`/supplier/payment?planId=${pendingPlanId}`)
                      return
                    }
                    
                    try {
                      // Fetch premium plan
                      const plansResponse = await fetch('/api/supplier-plans', {
                        credentials: 'include'
                      })
                      const plansData = await plansResponse.json()
                      
                      if (!plansData.success || !plansData.plans) {
                        throw new Error('Failed to fetch plans')
                      }
                      
                      const premiumPlan = plansData.plans.find((p: any) => p.slug === 'premium')
                      if (!premiumPlan) {
                        throw new Error('Premium plan not found')
                      }
                      
                      // Initiate upgrade to get referenceId
                      const initiateResponse = await fetch('/api/supplier/upgrade/initiate', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                          planId: premiumPlan.id,
                          amount: premiumPlan.price
                        })
                      })
                      
                      // Check response status before parsing JSON
                      if (!initiateResponse.ok) {
                        if (initiateResponse.status === 401) {
                          throw new Error('Your session has expired. Please refresh the page and try again.')
                        }
                        const errorData = await initiateResponse.json().catch(() => ({ error: 'Failed to initiate upgrade' }))
                        throw new Error(errorData.error || `Server error: ${initiateResponse.status}`)
                      }
                      
                      const initiateData = await initiateResponse.json()
                      
                      if (!initiateData.success || !initiateData.upgrade) {
                        throw new Error(initiateData.error || 'Failed to initiate upgrade')
                      }
                      
                      const { referenceId } = initiateData.upgrade
                      
                      // Redirect to payment page
                      router.push(`/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`)
                    } catch (error: any) {
                      console.error('Error initiating upgrade:', error)
                      toast({
                        title: 'Error',
                        description: error.message || 'Failed to initiate upgrade. Please try again.',
                        variant: 'destructive'
                      })
                    }
                  }}
                  className="inline-block px-4 sm:px-6 py-2 sm:py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-md font-semibold text-sm sm:text-base"
                >
                  {isPremiumPendingPayment && currentPlan?.slug !== 'free' ? 'Complete Payment' : 'Upgrade to Premium'}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Benefits Preview */}
          <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
            <CardHeader>
              <CardTitle className={cn(themeClasses.mainText)}>Benefits of Featured Placement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Eye, title: 'Increased Visibility', desc: 'Products appear at the top of search results' },
                  { icon: TrendingUp, title: 'Higher Sales', desc: 'Featured products get 3x more views' },
                  { icon: Star, title: 'Premium Badge', desc: 'Show premium badge on featured products' }
                ].map((benefit, index) => {
                  const Icon = benefit.icon
                  return (
                    <div key={index} className={cn("p-4 rounded-lg border opacity-60", themeClasses.cardBorder, themeClasses.cardBg)}>
                      <Icon className="w-8 h-8 text-yellow-500 mb-2" />
                      <h3 className={cn("font-semibold mb-1", themeClasses.mainText)}>{benefit.title}</h3>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>{benefit.desc}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Featured Products */}
          {featuredProducts.length > 0 && (
            <Card className={cn("border-2 border-yellow-500", themeClasses.cardBg)}>
              <CardHeader>
                <CardTitle className={cn(themeClasses.mainText)}>Currently Featured Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredProducts.map((product) => (
                    <Card key={product.id} className={cn("border-2 border-yellow-500", themeClasses.cardBg)}>
                      <CardContent className="p-4">
                        <div className="relative mb-3">
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={200}
                            height={200}
                            className="w-full h-32 object-cover rounded"
                          />
                          <Badge className="absolute top-2 right-2 bg-yellow-500 text-black">
                            Featured
                          </Badge>
                        </div>
                        <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>{product.name}</h3>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {product.views} views
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleFeatured(product.id, true)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Unfeature
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Products */}
          <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
            <CardHeader>
              <CardTitle className={cn(themeClasses.mainText)}>Available Products</CardTitle>
            </CardHeader>
            <CardContent>
              {nonFeaturedProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nonFeaturedProducts.map((product) => (
                    <Card key={product.id} className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                      <CardContent className="p-4">
                        <div className="relative mb-3">
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={200}
                            height={200}
                            className="w-full h-32 object-cover rounded"
                          />
                        </div>
                        <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>{product.name}</h3>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {product.views} views
                          </span>
                          <Button
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-black"
                            onClick={() => handleToggleFeatured(product.id, false)}
                          >
                            <Star className="w-4 h-4 mr-1" />
                            Feature
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
                  {products.length === 0 ? 'No products available' : 'All products are featured'}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}



