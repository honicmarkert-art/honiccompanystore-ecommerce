'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building2, MapPin, Phone, Save, ArrowRight, FileText, AlertTriangle, Upload, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { SupplierRouteGuard } from '@/components/supplier-route-guard'

// All Tanzania regions
const TANZANIA_REGIONS = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Mjini Magharibi',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pemba North',
  'Pemba South',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Unguja North',
  'Unguja South'
]

function CompanyInfoPageContent() {
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
    businessRegistrationNumber: '',
    region: '',
    nation: 'Tanzania',
    detailSentence: ''
  })
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

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
        
        // Load existing company info if available
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            setFormData({
              companyName: data.profile.company_name || '',
              location: data.profile.location || '',
              officeNumber: data.profile.office_number || '',
              businessRegistrationNumber: data.profile.business_registration_number || '',
              region: data.profile.region || '',
              nation: data.profile.nation || 'Tanzania',
              detailSentence: data.profile.detail_sentence || ''
            })
            setCompanyLogo(data.profile.company_logo || null)
            // Set account active status
            setIsActive(data.profile.is_active !== false) // Default to true if null
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error)
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
              businessRegistrationNumber: refreshData.profile.business_registration_number || '',
              region: refreshData.profile.region || '',
              nation: refreshData.profile.nation || 'Tanzania',
              detailSentence: refreshData.profile.detail_sentence || ''
            })
            setCompanyLogo(refreshData.profile.company_logo || null)
            // Update isActive status after submission (will be false after submission)
            setIsActive(refreshData.profile.is_active !== false)
            // Trigger a custom event to refresh company name in layout
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('company-info-updated'))
            }
          }
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update company information',
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
          description: "Company logo uploaded successfully",
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className={cn("mt-4", themeClasses.mainText)}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={cn("min-h-screen", themeClasses.mainBg)}>
      <div className="container mx-auto px-4 py-8 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Hero Section - Right Side */}
          <div className="hidden lg:block order-2">
            <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
              <CardContent className="p-8 lg:p-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/20")}>
                      <Building2 className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <h2 className={cn("text-2xl font-bold", themeClasses.mainText)}>
                        Complete Your Business Profile
                      </h2>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        Help us get to know your business better
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded bg-blue-100 dark:bg-blue-900/20 mt-1")}>
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold", themeClasses.mainText)}>Business Information</h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          Share your company details to help customers find and trust your business
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded bg-green-100 dark:bg-green-900/20 mt-1")}>
                        <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold", themeClasses.mainText)}>Location Details</h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          Let customers know where your business is located
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded bg-purple-100 dark:bg-purple-900/20 mt-1")}>
                        <Phone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className={cn("font-semibold", themeClasses.mainText)}>Contact Information</h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          Provide your office number for business inquiries
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={cn("pt-6 border-t", themeClasses.cardBorder)}>
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      This information will be used to verify your business and help customers connect with you.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Section - Left Side */}
          <div className="order-1">
            <div className="max-w-md mx-auto lg:max-w-none">
              <div className="mb-4 sm:mb-6">
                <h1 className={cn("text-2xl sm:text-3xl font-bold mb-1 sm:mb-2", themeClasses.mainText)}>
                  Company Information
                </h1>
                <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                  Please provide your business details to complete your supplier profile
                </p>
              </div>

              <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                <CardContent className="p-4 sm:p-6">
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div>
                      <Label htmlFor="companyName" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Company / Business Name *
                      </Label>
                      <div className="relative mt-1">
                        <Building2 className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="companyName"
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                          placeholder="Enter your company or business name"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="location" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Location *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Please provide the most correct and exact location. You can include nearby famous places or landmarks to help identify your location accurately.
                      </p>
                      <div className="relative mt-1">
                        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="location"
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Enter your business location"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="officeNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Office Number *
                      </Label>
                      <div className="relative mt-1">
                        <Phone className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="officeNumber"
                          type="tel"
                          value={formData.officeNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, officeNumber: e.target.value }))}
                          placeholder="Enter your office phone number"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="businessRegistrationNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Business / Company Registration Number *
                      </Label>
                      <div className="relative mt-1">
                        <FileText className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                        <Input
                          id="businessRegistrationNumber"
                          type="text"
                          value={formData.businessRegistrationNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, businessRegistrationNumber: e.target.value }))}
                          placeholder="Enter your business registration number"
                          className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="region" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Region *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Select your business region within Tanzania
                      </p>
                      <div className="relative mt-1">
                        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 z-10 pointer-events-none", themeClasses.textNeutralSecondary)} />
                        <Select
                          value={formData.region}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                          required
                        >
                          <SelectTrigger 
                            className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          >
                            <SelectValue placeholder="Select your region" />
                          </SelectTrigger>
                          <SelectContent>
                            {TANZANIA_REGIONS.map((region) => (
                              <SelectItem key={region} value={region}>
                                {region}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          value={formData.nation}
                          disabled
                          className={cn("pl-9 sm:pl-10 text-sm bg-gray-100 dark:bg-gray-800", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          required
                        />
                      </div>
                      <p className={cn("text-[10px] sm:text-xs mt-1", themeClasses.textNeutralSecondary)}>
                        Nation is set to Tanzania by default. Other nations are not available at this time.
                      </p>
                    </div>

                    {/* Detail Sentence */}
                    <div>
                      <Label htmlFor="detailSentence" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Product Detail Sentence (appears after rating on all your products)
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        This text will appear after the rating on all your product pages. If left empty, "Shop quality products with confidence" will be shown by default.
                      </p>
                      <Input
                        id="detailSentence"
                        type="text"
                        value={formData.detailSentence}
                        onChange={(e) => setFormData(prev => ({ ...prev, detailSentence: e.target.value }))}
                        placeholder="e.g., Shop quality products with confidence"
                        maxLength={100}
                        className={cn("text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                      />
                      <p className={cn("text-[10px] sm:text-xs mt-1", themeClasses.textNeutralSecondary)}>
                        {formData.detailSentence.length}/100 characters
                      </p>
                    </div>

                    {/* Company Logo Upload */}
                    <div>
                      <Label htmlFor="companyLogo" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Company Logo
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Upload your company logo. This will be displayed on your product detail pages.
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="relative">
                          {companyLogo ? (
                            <Image
                              src={companyLogo}
                              alt="Company Logo"
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
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-neutral-950 text-sm sm:text-base"
                      >
                        {isSubmitting ? (
                          'Saving...'
                        ) : (
                          (formData.companyName || formData.location || formData.officeNumber || formData.businessRegistrationNumber) ? 'Update' : 'Submit for Review'
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CompanyInfoPage() {
  return (
    <SupplierRouteGuard>
      <CompanyInfoPageContent />
    </SupplierRouteGuard>
  )
}

