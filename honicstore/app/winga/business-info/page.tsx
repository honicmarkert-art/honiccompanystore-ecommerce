'use client'

// Note: ISR (revalidate) cannot be used in client components
// CPU optimization is handled via API route caching and CDN caching instead

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building2, MapPin, Phone, Save, Upload, Image as ImageIcon, FileText, AlertTriangle, ArrowRight, User, IdCard, Camera, Lightbulb } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function WingaBusinessInfoPage() {
  return <WingaBusinessInfoContent />
}

function WingaBusinessInfoContent() {
  const { themeClasses } = useTheme()
  const { user, isAuthenticated, checkAuth } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isActive, setIsActive] = useState<boolean | null>(null)
  const [formData, setFormData] = useState({
    companyName: '',
    location: '',
    officeNumber: '',
    tinOrNida: '',
    fullLegalName: '',
    region: '',
    nation: 'Tanzania'
  })
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [nidaCardPhoto, setNidaCardPhoto] = useState<string | null>(null)
  const [selfFacePhoto, setSelfFacePhoto] = useState<string | null>(null)
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null)

  const hasLoadedRef = useRef(false)
  useEffect(() => {
    // Prevent multiple calls
    if (hasLoadedRef.current) {
      setIsLoading(false)
      return
    }
    
    const checkAuthAndLoad = async () => {
      try {
        // Only check auth if not authenticated
        if (!isAuthenticated) {
          await checkAuth()
          // Wait a bit for auth state to update
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        // Check again after potential auth update
        if (!isAuthenticated) {
          router.push('/auth/login')
          setIsLoading(false)
          return
        }
        
        hasLoadedRef.current = true
        
        // Load existing business info if available
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            setFormData({
              companyName: data.profile.company_name || '',
              location: data.profile.location || '',
              officeNumber: data.profile.office_number || '',
              tinOrNida: data.profile.tin_or_nida || '',
              fullLegalName: data.profile.full_legal_name || '',
              region: data.profile.region || '',
              nation: data.profile.nation || 'Tanzania'
            })
            if (data.profile.nida_card_photo_url) {
              setNidaCardPhoto(data.profile.nida_card_photo_url)
            }
            if (data.profile.self_face_photo_url) {
              setSelfFacePhoto(data.profile.self_face_photo_url)
            }
            setCompanyLogo(data.profile.company_logo || null)
            // Set account active status
            setIsActive(data.profile.is_active !== false) // Default to true if null
          }
        }
      } catch (error) {
        } finally {
        setIsLoading(false)
      }
    }
    
    checkAuthAndLoad()
  }, []) // Empty dependency array - only run once on mount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/user/update-company-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        // Check if user has pending premium plan - redirect to payment
        if (result.pendingPremiumPlan) {
          toast({
            title: 'Information Submitted',
            description: 'Redirecting to payment page to complete your premium plan upgrade...',
            duration: 5000,
          })
          
          // Small delay to allow toast to show
          setTimeout(() => {
            router.push(`/supplier/payment?planId=${result.pendingPremiumPlan.id}`)
          }, 1000)
          return
        }
        
        toast({
          title: 'Information Submitted',
          description: 'Your account will be activated after we review and confirm your information. Please ensure all details are correct.',
          duration: 10000,
        })
        // Don't redirect - stay on page to show updated data
        // Refresh the form data to show updated values
        const refreshResponse = await fetch('/api/user/profile')
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          if (refreshData.profile) {
            setFormData({
              companyName: refreshData.profile.company_name || '',
              location: refreshData.profile.location || '',
              officeNumber: refreshData.profile.office_number || '',
              tinOrNida: refreshData.profile.tin_or_nida || '',
              fullLegalName: refreshData.profile.full_legal_name || '',
              region: refreshData.profile.region || '',
              nation: refreshData.profile.nation || 'Tanzania'
            })
            setCompanyLogo(refreshData.profile.company_logo || null)
            // Update isActive status after submission (will be false after submission)
            setIsActive(refreshData.profile.is_active !== false)
            // Trigger a custom event to refresh business name in layout
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('company-info-updated'))
            }
          }
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update business information',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload a valid image file (PNG, JPG, GIF, WebP, or SVG)",
        variant: "destructive",
      })
      return
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      })
      return
    }

    setIsUploadingLogo(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/supplier/logo-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setCompanyLogo(result.url)
        toast({
          title: "Success",
          description: "Business logo uploaded successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to upload logo",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while uploading the logo",
        variant: "destructive",
      })
    } finally {
      setIsUploadingLogo(false)
      // Reset file input
      event.target.value = ''
    }
  }

  // Only show loading on initial load, not during form submission
  // Add timeout to prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true)
        setIsLoading(false)
      }, 5000) // 5 second timeout
      return () => clearTimeout(timer)
    } else {
      setLoadingTimeout(false)
    }
  }, [isLoading])
  
  if (isLoading && !loadingTimeout && !hasLoadedRef.current) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", themeClasses.mainBg)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className={cn("mt-4", themeClasses.mainText)}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className={cn("text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2", themeClasses.mainText)}>
          Winga & Business Detail
        </h1>
        <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
          Update your broker/connector information. As a Winga, you help customers find products - no shop or stock needed!
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Hero Section - Right Side */}
        <div className="hidden lg:block order-2">
            <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
              <CardContent className="p-8 lg:p-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-4 rounded-lg bg-purple-100 dark:bg-purple-900/20")}>
                      <Building2 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h2 className={cn("text-2xl font-bold", themeClasses.mainText)}>
                        Complete Your Winga Profile
                      </h2>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        Help customers find you and your products
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded bg-purple-100 dark:bg-purple-900/20 mt-1")}>
                        <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold", themeClasses.mainText)}>Business Information</h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          Share your business or trading name to help customers identify you
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded bg-blue-100 dark:bg-blue-900/20 mt-1")}>
                        <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold", themeClasses.mainText)}>Location Details</h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          Let customers know where you operate (markets, online, etc.)
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded bg-green-100 dark:bg-green-900/20 mt-1")}>
                        <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold", themeClasses.mainText)}>Contact Information</h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          Provide your business number for customer inquiries
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={cn("pt-6 border-t", themeClasses.cardBorder)}>
                      <div className={cn("p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800")}>
                        <p className={cn("text-sm text-purple-800 dark:text-purple-300 flex items-start gap-2")}>
                          <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span><strong>Winga Tip:</strong> As a broker/connector, you help customers find products without owning stock. Your TIN/NIDA number increases trust and gives priority in search results.</span>
                        </p>
                      </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Section - Left Side */}
          <div className="order-1">
            <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                <CardContent className="p-4 sm:p-6">
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    {/* Business Logo Upload */}
                    <div>
                      <Label htmlFor="companyLogo" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Business Logo
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Upload your business logo. This will be displayed on your product detail pages.
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="relative">
                          {companyLogo ? (
                            <Image
                              src={companyLogo}
                              alt="Business Logo"
                              width={64}
                              height={64}
                              className={cn("w-16 h-16 object-contain border rounded-md", themeClasses.cardBorder, themeClasses.cardBg)}
                            />
                          ) : (
                            <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                              <ImageIcon className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            id="companyLogo"
                            accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
                            onChange={handleLogoUpload}
                            className="hidden"
                            disabled={isUploadingLogo}
                          />
                          <Label
                            htmlFor="companyLogo"
                            className={cn(
                              "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                              themeClasses.cardBorder,
                              themeClasses.cardBg,
                              isUploadingLogo && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <Upload className="h-4 w-4" />
                            <span>{isUploadingLogo ? "Uploading..." : companyLogo ? "Change Logo" : "Upload Logo"}</span>
                          </Label>
                          <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                            Supports PNG, JPG, GIF, WebP, SVG (max 5MB)
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="companyName" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Business / Trading Name (Appearance Name) *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        This name will appear on your products (like business name). Your personal name or trading name (e.g., "John's Connections" or just "John Doe")
                      </p>
                      <div className="relative mt-1">
                        <Building2 className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="companyName"
                          type="text"
                          value={formData.companyName ?? ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                          placeholder="Enter your business or trading name"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="location" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Operating Location <span className="text-yellow-600 dark:text-yellow-400">(Recommended)</span>
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Where you operate (e.g., "Kariakoo Market", "Dar es Salaam", "Online via WhatsApp/Instagram")
                      </p>
                      <div className="relative mt-1">
                        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="location"
                          type="text"
                          value={formData.location ?? ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Enter your operating location"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="officeNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Business Phone Number *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Your phone number for customer contact (WhatsApp, calls, etc.)
                      </p>
                      <div className="relative mt-1">
                        <Phone className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="officeNumber"
                          type="tel"
                          value={formData.officeNumber ?? ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, officeNumber: e.target.value }))}
                          placeholder="Enter your business phone number"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="fullLegalName" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Full Legal Name (NIDA Name) *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Enter your full legal name as it appears on your NIDA card
                      </p>
                      <div className="relative mt-1">
                        <User className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="fullLegalName"
                          type="text"
                          value={formData.fullLegalName ?? ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, fullLegalName: e.target.value }))}
                          placeholder="Enter your full legal name"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="tinOrNida" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        NIDA Number (Winga Personal Detail) * *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Important for trust, verification, and priority in search results and orders
                      </p>
                      <div className="relative mt-1">
                        <FileText className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="tinOrNida"
                          type="text"
                          value={formData.tinOrNida ?? ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, tinOrNida: e.target.value }))}
                          placeholder="Enter your NIDA number"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                      <div className={cn("mt-2 p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800")}>
                        <p className={cn("text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2")}>
                          <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span><strong>Why this matters for Wingas:</strong> Providing your NIDA number increases your trust and gives us priority you in search results and order processing. This helps verify your authenticity as a broker/connector. This is better for legal, security, and trust reasons.</span>
                        </p>
                      </div>
                    </div>

                    {/* NIDA Card Photo Upload (Optional) */}
                    <div>
                      <Label htmlFor="nidaCardPhoto" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        NIDA Card Photo <span className="text-yellow-600 dark:text-yellow-400">(Optional - can upload later)</span>
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Upload a clear photo of your NIDA card for verification and comparison purposes
                      </p>
                      <div className={cn("mt-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800")}>
                        <p className={cn("text-xs text-yellow-800 dark:text-yellow-300")}>
                          <strong>⚠️ Important:</strong> While this field is optional, your account cannot be activated until the NIDA card photo is uploaded. Please upload it as soon as possible to complete your account activation.
                        </p>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        {nidaCardPhoto ? (
                          <div className="relative flex flex-col items-center gap-2">
                            <Image
                              src={nidaCardPhoto}
                              alt="NIDA Card"
                              width={64}
                              height={64}
                              className={cn("w-16 h-16 object-cover border rounded-md", themeClasses.cardBorder, themeClasses.cardBg)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-1 text-[10px] px-2 h-6"
                              onClick={() => window.open(nidaCardPhoto, '_blank', 'noopener,noreferrer')}
                            >
                              Preview
                            </Button>
                          </div>
                        ) : (
                          <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                            <IdCard className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                          </div>
                        )}
                        <div className="flex-1">
                          {!nidaCardPhoto ? (
                            <>
                              <input
                                type="file"
                                id="nidaCardPhoto"
                                accept=".png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    const reader = new FileReader()
                                    reader.onload = (event) => {
                                      setNidaCardPhoto(event.target?.result as string)
                                    }
                                    reader.readAsDataURL(file)
                                  }
                                }}
                                className="hidden"
                                disabled={uploadingDocument === 'nida_card'}
                              />
                              <Label
                                htmlFor="nidaCardPhoto"
                                className={cn(
                                  "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                  themeClasses.cardBorder,
                                  themeClasses.cardBg,
                                  uploadingDocument === 'nida_card' && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Upload className="h-4 w-4" />
                                <span>{uploadingDocument === 'nida_card' ? "Uploading..." : "Upload NIDA Card Photo"}</span>
                              </Label>
                              <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                PNG, JPG (max 10MB) - Required for account activation
                              </p>
                            </>
                          ) : (
                            <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                              NIDA card photo is already uploaded.{" "}
                              <button
                                type="button"
                                onClick={() =>
                                  router.push('/supplier/support?subject=Update%20NIDA%20Card%20Photo&category=verification')
                                }
                                className="underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                Please contact support if you need to update it.
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Self Face Photo Upload (Optional) */}
                    <div>
                      <Label htmlFor="selfFacePhoto" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Self Face Photo <span className="text-yellow-600 dark:text-yellow-400">(Optional - can upload later)</span>
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Upload a clear photo of yourself for comparison with your NIDA card photo
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {selfFacePhoto ? (
                          <div className="relative flex flex-col items-center gap-2">
                            <Image
                              src={selfFacePhoto}
                              alt="Self Face"
                              width={64}
                              height={64}
                              className={cn("w-16 h-16 object-cover border rounded-full", themeClasses.cardBorder, themeClasses.cardBg)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-1 text-[10px] px-2 h-6"
                              onClick={() => window.open(selfFacePhoto, '_blank', 'noopener,noreferrer')}
                            >
                              Preview
                            </Button>
                          </div>
                        ) : (
                          <div className={cn("w-16 h-16 border rounded-full flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                            <Camera className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                          </div>
                        )}
                        <div className="flex-1">
                          {!selfFacePhoto ? (
                            <>
                              <input
                                type="file"
                                id="selfFacePhoto"
                                accept=".png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    const reader = new FileReader()
                                    reader.onload = (event) => {
                                      setSelfFacePhoto(event.target?.result as string)
                                    }
                                    reader.readAsDataURL(file)
                                  }
                                }}
                                className="hidden"
                                disabled={uploadingDocument === 'self_face'}
                              />
                              <Label
                                htmlFor="selfFacePhoto"
                                className={cn(
                                  "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                  themeClasses.cardBorder,
                                  themeClasses.cardBg,
                                  uploadingDocument === 'self_face' && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Camera className="h-4 w-4" />
                                <span>{uploadingDocument === 'self_face' ? "Uploading..." : "Upload Self Face Photo"}</span>
                              </Label>
                              <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                PNG, JPG (max 10MB) - Can be uploaded later
                              </p>
                            </>
                          ) : (
                            <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                              Self face photo is already uploaded.{" "}
                              <button
                                type="button"
                                onClick={() =>
                                  router.push('/supplier/support?subject=Update%20Self%20Face%20Photo&category=verification')
                                }
                                className="underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                Please contact support if you need to update it.
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="region" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Region *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Your business region within Tanzania (e.g., Dar es Salaam, Arusha, Mwanza, Dodoma)
                      </p>
                      <div className="relative mt-1">
                        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="region"
                          type="text"
                          value={formData.region ?? ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                          placeholder="Enter your region"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="nation" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Nation *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Currently only Tanzania is supported
                      </p>
                      <div className="relative mt-1">
                        <Building2 className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="nation"
                          type="text"
                          value={formData.nation ?? 'Tanzania'}
                          disabled
                          className={cn("pl-9 sm:pl-10 text-sm bg-gray-100 dark:bg-gray-800", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                      <p className={cn("text-[10px] sm:text-xs mt-1", themeClasses.textNeutralSecondary)}>
                        Nation is set to Tanzania by default. Other nations are not available at this time.
                      </p>
                    </div>

                    {/* Warning Message - Only show when account is inactive */}
                    {isActive === false && (
                      <div className={cn("p-3 sm:p-4 rounded-lg border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20", themeClasses.cardBorder)}>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className={cn("font-semibold mb-1 text-xs sm:text-sm text-red-800 dark:text-red-300")}>
                              Important Notice
                            </h4>
                            <p className={cn("text-[10px] sm:text-xs text-red-700 dark:text-red-400")}>
                              Your account will be set to inactive and will be activated after we review and confirm your information. 
                              <strong className="block mt-1 sm:mt-2">Please ensure all information is correct. Providing incorrect or false information will result in permanent account deletion.</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white text-sm sm:text-base"
                      >
                        {isSubmitting ? (
                          'Saving...'
                        ) : (
                          (formData.companyName || formData.officeNumber || formData.tinOrNida || formData.region) ? 'Update' : 'Submit for Review'
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
          </div>
        </div>
    </>
  )
}


