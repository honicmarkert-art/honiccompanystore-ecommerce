'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { cn } from '@/lib/utils'
import { Megaphone, TrendingUp, Sparkles, Target, DollarSign, Calendar, Plus, Trash2, Edit, X, Upload, Image as ImageIcon, Video } from 'lucide-react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'

interface Promotion {
  id: string
  name: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_purchase_amount: number
  max_discount_amount: number | null
  usage_limit: number | null
  used_count: number
  start_date: string
  end_date: string
  is_active: boolean
  applies_to_all_products: boolean
  product_ids: string[]
  created_at: string
}

export default function SupplierMarketingPage() {
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<{ slug: string } | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  
  // Advertisement states
  const [advertisements, setAdvertisements] = useState<any[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false)
  const [selectedAdFile, setSelectedAdFile] = useState<File | null>(null)
  const [previewAdUrl, setPreviewAdUrl] = useState<string | null>(null)
  const [isUploadingAd, setIsUploadingAd] = useState(false)
  const [adFormData, setAdFormData] = useState({
    title: '',
    description: '',
    link_url: '',
    display_order: 1,
    placement: 'products'
  })
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    minPurchaseAmount: '',
    maxDiscountAmount: '',
    usageLimit: '',
    startDate: '',
    endDate: '',
    appliesToAllProducts: true,
    selectedProductIds: [] as string[]
  })
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Define isPremiumPlan before useEffect hooks that use it
  const isPremiumPlan = currentPlan?.slug === 'premium'

  useEffect(() => {
    fetchCurrentPlan()
    fetchPromotions()
  }, [])

  useEffect(() => {
    if (isPremiumPlan) {
      fetchAdvertisements()
    }
  }, [isPremiumPlan])

  useEffect(() => {
    if (isPremiumPlan) {
      fetchProducts()
    }
  }, [isPremiumPlan])

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await fetch('/api/supplier/products?limit=1000', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setProducts((data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name
        })))
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/user/current-plan', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success && data.plan) {
        setCurrentPlan(data.plan)
      }
    } catch (error) {
      console.error('Error fetching current plan:', error)
    }
  }

  const fetchPromotions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/supplier/promotions', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setPromotions(data.promotions || [])
      } else {
        if (data.error && !data.error.includes('Premium Plan')) {
          toast({
            title: 'Error',
            description: data.error || 'Failed to fetch promotions',
            variant: 'destructive'
          })
        }
      }
    } catch (error) {
      console.error('Error fetching promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPromotionStatus = (promo: Promotion): 'active' | 'scheduled' | 'ended' => {
    const now = new Date()
    const start = new Date(promo.start_date)
    const end = new Date(promo.end_date)
    
    if (!promo.is_active) return 'ended'
    if (now < start) return 'scheduled'
    if (now > end) return 'ended'
    if (promo.usage_limit && promo.used_count >= promo.usage_limit) return 'ended'
    return 'active'
  }

  const handleCreatePromotion = async () => {
    try {
      const url = editingPromotion 
        ? `/api/supplier/promotions/${editingPromotion.id}`
        : '/api/supplier/promotions'
      
      const response = await fetch(url, {
        method: editingPromotion ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue),
          minPurchaseAmount: formData.minPurchaseAmount ? parseFloat(formData.minPurchaseAmount) : 0,
          maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : undefined,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
          productIds: formData.appliesToAllProducts ? [] : formData.selectedProductIds || []
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: editingPromotion ? 'Promotion updated successfully' : 'Promotion created successfully',
        })
        setIsCreateDialogOpen(false)
        resetForm()
        fetchPromotions()
      } else {
        toast({
          title: 'Error',
          description: result.error || `Failed to ${editingPromotion ? 'update' : 'create'} promotion`,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${editingPromotion ? 'update' : 'create'} promotion`,
        variant: 'destructive'
      })
    }
  }

  const handleDeletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return

    try {
      const response = await fetch(`/api/supplier/promotions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Promotion deleted successfully',
        })
        fetchPromotions()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete promotion',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete promotion',
        variant: 'destructive'
      })
    }
  }

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromotion(promo)
    setFormData({
      name: promo.name,
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discount_type,
      discountValue: promo.discount_value.toString(),
      minPurchaseAmount: promo.min_purchase_amount.toString(),
      maxDiscountAmount: promo.max_discount_amount?.toString() || '',
      usageLimit: promo.usage_limit?.toString() || '',
      startDate: new Date(promo.start_date).toISOString().slice(0, 16),
      endDate: new Date(promo.end_date).toISOString().slice(0, 16),
      appliesToAllProducts: promo.applies_to_all_products,
      selectedProductIds: promo.product_ids || []
    })
    setIsCreateDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minPurchaseAmount: '',
      maxDiscountAmount: '',
      usageLimit: '',
      startDate: '',
      endDate: '',
      appliesToAllProducts: true,
      selectedProductIds: []
    })
    setEditingPromotion(null)
  }

  const fetchAdvertisements = async () => {
    try {
      setLoadingAds(true)
      const response = await fetch('/api/supplier/advertisements', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setAdvertisements(data.advertisements || [])
      }
    } catch (error) {
      console.error('Error fetching advertisements:', error)
    } finally {
      setLoadingAds(false)
    }
  }

  const handleAdFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    
    if (![...validImageTypes, ...validVideoTypes].includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, MOV)',
        variant: 'destructive'
      })
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 50MB',
        variant: 'destructive'
      })
      return
    }

    setSelectedAdFile(file)
    setPreviewAdUrl(URL.createObjectURL(file))
  }

  const handleCreateAdvertisement = async () => {
    if (!selectedAdFile) {
      toast({
        title: 'No file selected',
        description: 'Please select an image or video to upload',
        variant: 'destructive'
      })
      return
    }

    if (!adFormData.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for the advertisement',
        variant: 'destructive'
      })
      return
    }

    setIsUploadingAd(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', selectedAdFile)
      formDataToSend.append('title', adFormData.title)
      formDataToSend.append('description', adFormData.description)
      formDataToSend.append('link_url', adFormData.link_url)
      formDataToSend.append('display_order', adFormData.display_order.toString())
      formDataToSend.append('placement', adFormData.placement)

      const response = await fetch('/api/supplier/advertisements', {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message || 'Advertisement created successfully. It will be reviewed and activated by administration.',
        })
        setIsAdDialogOpen(false)
        resetAdForm()
        fetchAdvertisements()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create advertisement',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create advertisement',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingAd(false)
    }
  }

  const handleDeleteAdvertisement = async (id: number) => {
    if (!confirm('Are you sure you want to delete this advertisement?')) return

    try {
      const response = await fetch(`/api/supplier/advertisements?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Advertisement deleted successfully',
        })
        fetchAdvertisements()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete advertisement',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete advertisement',
        variant: 'destructive'
      })
    }
  }

  const resetAdForm = () => {
    setAdFormData({
      title: '',
      description: '',
      link_url: '',
      display_order: 1,
      placement: 'products'
    })
    setSelectedAdFile(null)
    setPreviewAdUrl(null)
  }

  const marketingTools = [
    {
      icon: Megaphone,
      title: 'Create Promotion',
      description: 'Create discount codes and special offers',
      href: null,
      onClick: () => setIsCreateDialogOpen(true)
    },
    {
      icon: TrendingUp,
      title: 'Boost Product Visibility',
      description: 'Promote your products in search results',
      href: '/supplier/featured',
      onClick: null
    },
    {
      icon: Target,
      title: 'Create Advertisement',
      description: 'Create advertisements for your products (requires administration approval)',
      href: null,
      onClick: () => setIsAdDialogOpen(true)
    },
    {
      icon: Sparkles,
      title: 'Featured Listings',
      description: 'Get featured placement on homepage',
      href: '/supplier/featured',
      onClick: null
    }
  ]

  const activePromotions = promotions.filter(p => getPromotionStatus(p) === 'active')
  const scheduledPromotions = promotions.filter(p => getPromotionStatus(p) === 'scheduled')
  const endedPromotions = promotions.filter(p => getPromotionStatus(p) === 'ended')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-bold", themeClasses.mainText)}>Marketing Tools & Promotions</h1>
          <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
            Promote your products and grow your sales
          </p>
        </div>
        {!isPremiumPlan && (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Premium Feature
          </Badge>
        )}
      </div>

      {!isPremiumPlan ? (
        <>
          {/* Upgrade Prompt */}
          <Card className={cn("border-2 border-yellow-500", themeClasses.cardBg)}>
            <CardContent className="p-6 sm:p-8">
              <div className="text-center">
                <Megaphone className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-yellow-500" />
                <h2 className={cn("text-xl sm:text-2xl font-bold mb-2", themeClasses.mainText)}>
                  Marketing Tools Available in Premium Plan
                </h2>
                <p className={cn("text-xs sm:text-sm mb-6", themeClasses.textNeutralSecondary)}>
                  Unlock powerful marketing tools to promote your products and increase sales
                </p>
                <button
                  onClick={async () => {
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
                  className="inline-block px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-md font-semibold text-sm sm:text-base"
                >
                  Upgrade to Premium
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Feature Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketingTools.map((tool, index) => {
              const Icon = tool.icon
              return (
                <Card key={index} className={cn("border-2 opacity-60", themeClasses.cardBorder, themeClasses.cardBg)}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex-shrink-0">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>{tool.title}</h3>
                          <Badge className="bg-yellow-500 text-black text-[10px] sm:text-xs">Premium</Badge>
                        </div>
                        <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <>
          {/* Create Promotion Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Promotion
            </Button>
          </div>

          {/* Active Promotions */}
          {activePromotions.length > 0 && (
            <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
              <CardHeader>
                <CardTitle className={cn(themeClasses.mainText)}>Active Promotions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  {activePromotions.map((promo) => {
                    const status = getPromotionStatus(promo)
                    return (
                      <div
                        key={promo.id}
                        className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>{promo.name}</h3>
                            <Badge className="bg-green-500 text-white text-[10px] sm:text-xs">Active</Badge>
                          </div>
                          <p className={cn("text-xs sm:text-sm mb-1", themeClasses.textNeutralSecondary)}>
                            Code: <span className="font-mono font-semibold">{promo.code}</span>
                          </p>
                          <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                            {promo.discount_type === 'percentage' 
                              ? `${promo.discount_value}% off` 
                              : `${formatPrice(promo.discount_value)} off`}
                            {' • '}
                            {new Date(promo.start_date).toLocaleDateString()} - {new Date(promo.end_date).toLocaleDateString()}
                            {promo.usage_limit && ` • ${promo.used_count}/${promo.usage_limit} used`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPromotion(promo)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePromotion(promo.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduled Promotions */}
          {scheduledPromotions.length > 0 && (
            <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
              <CardHeader>
                <CardTitle className={cn(themeClasses.mainText)}>Scheduled Promotions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  {scheduledPromotions.map((promo) => (
                    <div
                      key={promo.id}
                      className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>{promo.name}</h3>
                          <Badge className="bg-blue-500 text-white text-[10px] sm:text-xs">Scheduled</Badge>
                        </div>
                        <p className={cn("text-xs sm:text-sm mb-1", themeClasses.textNeutralSecondary)}>
                          Code: <span className="font-mono font-semibold">{promo.code}</span>
                        </p>
                        <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                          Starts: {new Date(promo.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePromotion(promo.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Promotions Message */}
          {promotions.length === 0 && !loading && (
            <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
              <CardContent className="p-8 text-center">
                <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className={cn("text-sm sm:text-base", themeClasses.textNeutralSecondary)}>
                  No promotions yet. Create your first promotion to start attracting customers!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Advertisements Section */}
          <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={cn(themeClasses.mainText)}>My Advertisements</CardTitle>
              <Button
                onClick={() => setIsAdDialogOpen(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Advertisement
              </Button>
            </CardHeader>
            <CardContent>
              {loadingAds ? (
                <p className={cn("text-sm text-center", themeClasses.textNeutralSecondary)}>Loading...</p>
              ) : advertisements.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                    No advertisements yet. Create your first advertisement to promote your products!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {advertisements.map((ad) => (
                    <div
                      key={ad.id}
                      className={cn("flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}
                    >
                      <div className="flex-shrink-0">
                        {ad.media_type === 'image' ? (
                          <Image
                            src={ad.media_url}
                            alt={ad.title}
                            width={150}
                            height={100}
                            className="rounded object-cover"
                          />
                        ) : (
                          <video
                            src={ad.media_url}
                            className="w-40 rounded"
                            controls
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>{ad.title}</h3>
                          <Badge className={ad.is_active ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}>
                            {ad.is_active ? 'Active' : 'Pending Review'}
                          </Badge>
                        </div>
                        {ad.description && (
                          <p className={cn("text-xs sm:text-sm mb-1", themeClasses.textNeutralSecondary)}>{ad.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Placement: {ad.placement}</span>
                          <span>•</span>
                          <span>Order: {ad.display_order}</span>
                        </div>
                        {!ad.is_active && (
                          <p className={cn("text-xs mt-2 text-yellow-600 dark:text-yellow-400")}>
                            ⏳ Waiting for administration approval
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAdvertisement(ad.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Marketing Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketingTools.map((tool, index) => {
              const Icon = tool.icon
              return (
                <Card key={index} className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex-shrink-0">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>{tool.title}</h3>
                          {tool.comingSoon && (
                            <Badge className="bg-gray-500 text-white text-[10px] sm:text-xs">Coming Soon</Badge>
                          )}
                        </div>
                        <p className={cn("text-xs sm:text-sm mb-3 sm:mb-4", themeClasses.textNeutralSecondary)}>
                          {tool.description}
                        </p>
                        {tool.href ? (
                          <Link href={tool.href}>
                            <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black text-xs sm:text-sm">
                              Use Tool
                            </Button>
                          </Link>
                        ) : tool.onClick ? (
                          <Button 
                            onClick={tool.onClick}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black text-xs sm:text-sm"
                          >
                            Use Tool
                          </Button>
                        ) : (
                          <Button 
                            disabled
                            className="w-full bg-gray-300 text-gray-500 cursor-not-allowed text-xs sm:text-sm"
                          >
                            Coming Soon
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Create/Edit Promotion Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className={cn("sm:max-w-[600px] max-h-[90vh] overflow-y-auto shadow-xl bg-white dark:bg-neutral-900", themeClasses.cardBorder)}>
          <DialogHeader>
            <DialogTitle className={cn(themeClasses.mainText)}>
              {editingPromotion ? 'Edit Promotion' : 'Create Promotion'}
            </DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              {editingPromotion ? 'Update your discount code' : 'Create a discount code to attract customers and boost sales'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name" className={cn(themeClasses.mainText)}>Promotion Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Sale 2025"
                className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
              />
            </div>
            <div>
              <Label htmlFor="code" className={cn(themeClasses.mainText)}>Promotion Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SUMMER25"
                className={cn("mt-1 font-mono", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                maxLength={50}
                disabled={!!editingPromotion}
              />
              {editingPromotion && (
                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                  Promotion code cannot be changed after creation
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description" className={cn(themeClasses.mainText)}>Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the promotion"
                className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discountType" className={cn(themeClasses.mainText)}>Discount Type</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value: 'percentage' | 'fixed') => setFormData({ ...formData, discountType: value })}
                >
                  <SelectTrigger className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={cn(themeClasses.cardBg)}>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discountValue" className={cn(themeClasses.mainText)}>
                  Discount Value {formData.discountType === 'percentage' ? '(%)' : '(TZS)'}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder={formData.discountType === 'percentage' ? '10' : '1000'}
                  className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  min="0"
                  max={formData.discountType === 'percentage' ? '100' : undefined}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className={cn(themeClasses.mainText)}>Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                />
              </div>
              <div>
                <Label htmlFor="endDate" className={cn(themeClasses.mainText)}>End Date</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minPurchaseAmount" className={cn(themeClasses.mainText)}>Min Purchase (TZS)</Label>
                <Input
                  id="minPurchaseAmount"
                  type="number"
                  value={formData.minPurchaseAmount}
                  onChange={(e) => setFormData({ ...formData, minPurchaseAmount: e.target.value })}
                  placeholder="0"
                  className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="usageLimit" className={cn(themeClasses.mainText)}>Usage Limit (Optional)</Label>
                <Input
                  id="usageLimit"
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  placeholder="Unlimited"
                  className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  min="1"
                />
              </div>
            </div>
            {formData.discountType === 'percentage' && (
              <div>
                <Label htmlFor="maxDiscountAmount" className={cn(themeClasses.mainText)}>Max Discount Amount (TZS) - Optional</Label>
                <Input
                  id="maxDiscountAmount"
                  type="number"
                  value={formData.maxDiscountAmount}
                  onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                  placeholder="No limit"
                  className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  min="0"
                />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id="appliesToAllProducts"
                  checked={formData.appliesToAllProducts}
                  onChange={(e) => setFormData({ ...formData, appliesToAllProducts: e.target.checked, selectedProductIds: [] })}
                  className="w-4 h-4"
                />
                <Label htmlFor="appliesToAllProducts" className={cn("cursor-pointer", themeClasses.mainText)}>
                  Apply to all products
                </Label>
              </div>
              {!formData.appliesToAllProducts && (
                <div className="mt-2 space-y-2">
                  <Label className={cn(themeClasses.mainText)}>Select Products</Label>
                  {loadingProducts ? (
                    <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>Loading products...</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`product-${product.id}`}
                            checked={formData.selectedProductIds.includes(String(product.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  selectedProductIds: [...formData.selectedProductIds, String(product.id)]
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  selectedProductIds: formData.selectedProductIds.filter(id => id !== String(product.id))
                                })
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <Label htmlFor={`product-${product.id}`} className={cn("cursor-pointer text-xs sm:text-sm", themeClasses.mainText)}>
                            {product.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePromotion}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                disabled={!formData.name || !formData.code || !formData.discountValue || !formData.startDate || !formData.endDate || (!formData.appliesToAllProducts && formData.selectedProductIds.length === 0)}
              >
                {editingPromotion ? 'Update Promotion' : 'Create Promotion'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Advertisement Dialog */}
      <Dialog open={isAdDialogOpen} onOpenChange={(open) => {
        setIsAdDialogOpen(open)
        if (!open) resetAdForm()
      }}>
        <DialogContent className={cn("sm:max-w-[700px] max-h-[90vh] overflow-y-auto shadow-xl bg-white dark:bg-neutral-900", themeClasses.cardBorder)}>
          <DialogHeader>
            <DialogTitle className={cn(themeClasses.mainText)}>
              Create Advertisement
            </DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              Upload an advertisement for your products. It will be reviewed and activated by administration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Ad Size Requirements */}
            <div className={cn("p-4 rounded-lg border-2", themeClasses.cardBg, themeClasses.cardBorder)}>
              <div className="flex items-start gap-2 mb-2">
                <ImageIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Recommended Ad Sizes</h4>
                  <div className="space-y-1.5 text-xs">
                    {adFormData.placement === 'products' && (
                      <div className={cn("space-y-1", themeClasses.textNeutralSecondary)}>
                        <p><strong className={themeClasses.mainText}>Products Page:</strong></p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>Banner: 728×90 px (Leaderboard)</li>
                          <li>Large Banner: 970×250 px (Billboard)</li>
                          <li>Responsive: 1200×300 px (recommended)</li>
                        </ul>
                      </div>
                    )}
                    {adFormData.placement === 'china' && (
                      <div className={cn("space-y-1", themeClasses.textNeutralSecondary)}>
                        <p><strong className={themeClasses.mainText}>China Page:</strong></p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>Banner: 728×90 px (Leaderboard)</li>
                          <li>Large Banner: 970×250 px (Billboard)</li>
                          <li>Responsive: 1200×300 px (recommended)</li>
                        </ul>
                      </div>
                    )}
                    {adFormData.placement === 'hero' && (
                      <div className={cn("space-y-1", themeClasses.textNeutralSecondary)}>
                        <p><strong className={themeClasses.mainText}>Hero Section:</strong></p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>Full Width: 1920×600 px (recommended)</li>
                          <li>Standard: 1600×500 px</li>
                          <li>Mobile Optimized: 1200×400 px</li>
                        </ul>
                      </div>
                    )}
                    {adFormData.placement === 'sidebar' && (
                      <div className={cn("space-y-1", themeClasses.textNeutralSecondary)}>
                        <p><strong className={themeClasses.mainText}>Sidebar:</strong></p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>Medium Rectangle: 300×250 px (recommended)</li>
                          <li>Large Rectangle: 336×280 px</li>
                          <li>Skyscraper: 300×600 px</li>
                          <li>Square: 250×250 px</li>
                        </ul>
                      </div>
                    )}
                    {adFormData.placement === 'features' && (
                      <div className={cn("space-y-1", themeClasses.textNeutralSecondary)}>
                        <p><strong className={themeClasses.mainText}>Features Section:</strong></p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>Banner: 728×90 px (Leaderboard)</li>
                          <li>Medium Banner: 468×60 px</li>
                          <li>Responsive: 1200×200 px (recommended)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className={cn("text-xs mt-2 pt-2 border-t", themeClasses.textNeutralSecondary, themeClasses.cardBorder)}>
                    <strong className={themeClasses.mainText}>Note:</strong> Images will be automatically resized to fit. For best results, use the recommended dimensions.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="adFile" className={cn(themeClasses.mainText)}>Media File (Image or Video)</Label>
                  <Input
                    id="adFile"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleAdFileSelect}
                    className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                  <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                    Max 50MB. Videos max 30 seconds.
                  </p>
                </div>
                <div>
                  <Label htmlFor="adTitle" className={cn(themeClasses.mainText)}>Title *</Label>
                  <Input
                    id="adTitle"
                    value={adFormData.title}
                    onChange={(e) => setAdFormData({ ...adFormData, title: e.target.value })}
                    placeholder="Advertisement title"
                    className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>
                <div>
                  <Label htmlFor="adDescription" className={cn(themeClasses.mainText)}>Description</Label>
                  <Textarea
                    id="adDescription"
                    value={adFormData.description}
                    onChange={(e) => setAdFormData({ ...adFormData, description: e.target.value })}
                    placeholder="Optional description"
                    className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="adLinkUrl" className={cn(themeClasses.mainText)}>Link URL</Label>
                  <Input
                    id="adLinkUrl"
                    value={adFormData.link_url}
                    onChange={(e) => setAdFormData({ ...adFormData, link_url: e.target.value })}
                    placeholder="https://..."
                    className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adDisplayOrder" className={cn(themeClasses.mainText)}>Display Order</Label>
                    <Input
                      id="adDisplayOrder"
                      type="number"
                      value={adFormData.display_order}
                      onChange={(e) => setAdFormData({ ...adFormData, display_order: parseInt(e.target.value) || 1 })}
                      className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                      min="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adPlacement" className={cn(themeClasses.mainText)}>Placement</Label>
                    <Select
                      value={adFormData.placement}
                      onValueChange={(value) => setAdFormData({ ...adFormData, placement: value })}
                    >
                      <SelectTrigger className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={cn(themeClasses.cardBg)}>
                        <SelectItem value="products">Products Page</SelectItem>
                        <SelectItem value="china">China Page</SelectItem>
                        <SelectItem value="features">Features Section</SelectItem>
                        <SelectItem value="hero">Hero Section</SelectItem>
                        <SelectItem value="sidebar">Sidebar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div>
                <Label className={cn(themeClasses.mainText)}>Preview</Label>
                {previewAdUrl ? (
                  <div className={cn("mt-1 border rounded-lg p-4", themeClasses.cardBg)}>
                    {selectedAdFile?.type.startsWith('image/') ? (
                      <Image
                        src={previewAdUrl}
                        alt="Preview"
                        width={400}
                        height={200}
                        className="rounded-lg object-cover w-full"
                      />
                    ) : (
                      <video
                        src={previewAdUrl}
                        controls
                        className="w-full rounded-lg"
                      />
                    )}
                  </div>
                ) : (
                  <div className={cn("mt-1 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}>
                    <ImageIcon className="w-12 h-12 mb-2 text-gray-400" />
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No file selected</p>
                    <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>Preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdDialogOpen(false)
                  resetAdForm()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAdvertisement}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                disabled={!selectedAdFile || !adFormData.title.trim() || isUploadingAd}
              >
                {isUploadingAd ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Create Advertisement
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
