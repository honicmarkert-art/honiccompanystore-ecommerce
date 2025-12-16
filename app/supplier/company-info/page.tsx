'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building2, MapPin, Phone, Save, ArrowRight, FileText, AlertTriangle, Upload, Image as ImageIcon, Camera, IdCard, FileCheck, Download, Eye, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
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
    registrationType: '' as 'tin' | 'business_registration' | 'company_registration' | '',
    businessRegistrationNumber: '',
    region: '',
    nation: 'Tanzania',
    detailSentence: ''
  })
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<{ slug: string } | null>(null)
  
  // Document states
  const [businessTinCertificate, setBusinessTinCertificate] = useState<string | null>(null)
  const [companyCertificate, setCompanyCertificate] = useState<string | null>(null)
  const [nidaCardFront, setNidaCardFront] = useState<string | null>(null)
  const [nidaCardRear, setNidaCardRear] = useState<string | null>(null)
  const [selfPicture, setSelfPicture] = useState<string | null>(null)
  
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null)
  
  // Document preview dialog state
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  
  // Declaration states
  const [nidaDeclarationAccepted, setNidaDeclarationAccepted] = useState(false)
  const [certificationDeclarationAccepted, setCertificationDeclarationAccepted] = useState(false)

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
          const contentType = response.headers.get('content-type') || ''
          if (!contentType.includes('application/json')) {
            console.error('Profile API returned non-JSON response')
            setIsLoading(false)
            return
          }
          const data = await response.json()
          if (data.profile) {
            // Determine registration type from existing data
            let registrationType: 'tin' | 'business_registration' | 'company_registration' | '' = ''
            if (data.profile.business_registration_number) {
              // Try to infer type from the number format or use default
              const regNumber = data.profile.business_registration_number
              if (regNumber.startsWith('TIN') || regNumber.match(/^\d{9}$/)) {
                registrationType = 'tin'
              } else if (regNumber.includes('BR') || regNumber.includes('Business')) {
                registrationType = 'business_registration'
              } else if (regNumber.includes('CR') || regNumber.includes('Company')) {
                registrationType = 'company_registration'
              } else {
                // Default to business_registration if can't determine
                registrationType = 'business_registration'
              }
            }
            
            setFormData({
              companyName: data.profile.company_name || '',
              location: data.profile.location || '',
              officeNumber: data.profile.office_number || '',
              registrationType: registrationType,
              businessRegistrationNumber: data.profile.business_registration_number || '',
              region: data.profile.region || '',
              nation: data.profile.nation || 'Tanzania',
              detailSentence: data.profile.detail_sentence || ''
            })
            setCompanyLogo(data.profile.company_logo || null)
            // Load document URLs
            // Load document URLs if they exist
            if (data.profile.business_tin_certificate_url) {
              setBusinessTinCertificate(data.profile.business_tin_certificate_url)
            }
            if (data.profile.company_certificate_url) {
              setCompanyCertificate(data.profile.company_certificate_url)
            }
            if (data.profile.nida_card_front_url) {
              setNidaCardFront(data.profile.nida_card_front_url)
            }
            if (data.profile.nida_card_rear_url) {
              setNidaCardRear(data.profile.nida_card_rear_url)
            }
            if (data.profile.self_picture_url) {
              setSelfPicture(data.profile.self_picture_url)
            }
            // Set account active status
            setIsActive(data.profile.is_active !== false) // Default to true if null
            
            // Reset declaration states when loading existing data
            // If user already has submitted info, they've already accepted declarations
            if (data.profile.company_name || data.profile.business_registration_number) {
              setNidaDeclarationAccepted(true)
              setCertificationDeclarationAccepted(true)
            }
          }
        }
        
        // Fetch current plan
        const planResponse = await fetch('/api/user/current-plan', {
          credentials: 'include'
        })
        if (planResponse.ok) {
          const contentType = planResponse.headers.get('content-type') || ''
          if (!contentType.includes('application/json')) {
            console.error('Current plan API returned non-JSON response')
            setIsLoading(false)
            return
          }
          const planData = await planResponse.json()
          if (planData.success && planData.plan) {
            setCurrentPlan(planData.plan)
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
      // Include document URLs in submission
      const submitData: any = { ...formData }
      if (businessTinCertificate) submitData.businessTinCertificateUrl = businessTinCertificate
      if (companyCertificate) submitData.companyCertificateUrl = companyCertificate
      if (nidaCardFront) submitData.nidaCardFrontUrl = nidaCardFront
      if (nidaCardRear) submitData.nidaCardRearUrl = nidaCardRear
      if (selfPicture) submitData.selfPictureUrl = selfPicture

      const response = await fetch('/api/user/update-company-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(submitData)
      })

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type') || ''
      let result: any
      
      if (contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // If not JSON, it's likely an HTML error page
        const text = await response.text()
        throw new Error(`Server returned ${response.status} error. ${text.substring(0, 100)}`)
      }

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
          const contentType = refreshResponse.headers.get('content-type') || ''
          if (!contentType.includes('application/json')) {
            console.error('Profile refresh API returned non-JSON response')
            return
          }
          const refreshData = await refreshResponse.json()
          if (refreshData.profile) {
            // Determine registration type from existing data
            let registrationType: 'tin' | 'business_registration' | 'company_registration' | '' = ''
            if (refreshData.profile.business_registration_number) {
              const regNumber = refreshData.profile.business_registration_number
              if (regNumber.startsWith('TIN') || regNumber.match(/^\d{9}$/)) {
                registrationType = 'tin'
              } else if (regNumber.includes('BR') || regNumber.includes('Business')) {
                registrationType = 'business_registration'
              } else if (regNumber.includes('CR') || regNumber.includes('Company')) {
                registrationType = 'company_registration'
              } else {
                registrationType = 'business_registration'
              }
            }
            
            setFormData({
              companyName: refreshData.profile.company_name || '',
              location: refreshData.profile.location || '',
              officeNumber: refreshData.profile.office_number || '',
              registrationType: registrationType,
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

  const openDocumentPreview = (url: string) => {
    setPreviewDocumentUrl(url)
    setIsPreviewOpen(true)
  }

  const handleDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    documentType: 'business_tin_certificate' | 'company_certificate' | 'nida_card_front' | 'nida_card_rear' | 'self_picture'
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload a valid image file (PNG, JPG, GIF, WebP) or PDF",
        variant: "destructive",
      })
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 10MB",
        variant: "destructive",
      })
      return
    }

    setUploadingDocument(documentType)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', documentType)

      const response = await fetch('/api/supplier/document-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type') || ''
      let result: any
      
      if (contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // If not JSON, it's likely an HTML error page
        const text = await response.text()
        throw new Error(`Server returned ${response.status} error. ${text.substring(0, 100)}`)
      }

      if (response.ok && result.success) {
        // Update the appropriate state
        switch (documentType) {
          case 'business_tin_certificate':
            setBusinessTinCertificate(result.url)
            break
          case 'company_certificate':
            setCompanyCertificate(result.url)
            break
          case 'nida_card_front':
            setNidaCardFront(result.url)
            break
          case 'nida_card_rear':
            setNidaCardRear(result.url)
            break
          case 'self_picture':
            setSelfPicture(result.url)
            break
        }
        
        // Update profile with document URL
        const updateData: any = {
          companyName: formData.companyName,
          officeNumber: formData.officeNumber,
          region: formData.region,
          nation: formData.nation
        }
        
        // Add optional fields if they exist
        if (formData.location) updateData.location = formData.location
        // Include registration type and number
        if (formData.registrationType) {
          updateData.registrationType = formData.registrationType
        }
        if (formData.businessRegistrationNumber) {
          updateData.businessRegistrationNumber = formData.businessRegistrationNumber
        }
        if (formData.detailSentence) updateData.detailSentence = formData.detailSentence
        
        // Add document URL
        const documentFieldMap: Record<string, string> = {
          'business_tin_certificate': 'businessTinCertificateUrl',
          'company_certificate': 'companyCertificateUrl',
          'nida_card_front': 'nidaCardFrontUrl',
          'nida_card_rear': 'nidaCardRearUrl',
          'self_picture': 'selfPictureUrl'
        }
        
        updateData[documentFieldMap[documentType]] = result.url
        
        const updateResponse = await fetch('/api/user/update-company-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(updateData)
        })

        if (updateResponse.ok) {
          toast({
            title: "Success",
            description: "Document uploaded successfully",
          })
        } else {
          // Safely parse error response
          const contentType = updateResponse.headers.get('content-type') || ''
          let errorData: any = { error: "Document uploaded but failed to save. Please try again." }
          
          if (contentType.includes('application/json')) {
            try {
              errorData = await updateResponse.json()
            } catch (e) {
              // If JSON parsing fails, use default error
            }
          }
          
          toast({
            title: "Warning",
            description: errorData.error || "Document uploaded but failed to save. Please try again.",
            variant: "destructive",
          })
        }
      } else {
        const errorMessage = result?.error || result?.message || "Failed to upload document"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Document upload error:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An error occurred while uploading the document"
      toast({
        title: "Error",
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage,
        variant: "destructive",
      })
    } finally {
      setUploadingDocument(null)
      // Reset file input
      event.target.value = ''
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

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type') || ''
      let result: any
      
      if (contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // If not JSON, it's likely an HTML error page
        const text = await response.text()
        throw new Error(`Server returned ${response.status} error. ${text.substring(0, 100)}`)
      }

      if (response.ok && result.success) {
        setCompanyLogo(result.url)
        toast({
          title: "Success",
          description: "Company logo uploaded successfully",
        })
      } else {
        const errorMessage = result?.error || result?.message || "Failed to upload logo"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Logo upload error:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An error occurred while uploading the logo"
      toast({
        title: "Error",
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage,
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
                      <Label htmlFor="registrationType" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        Registration Type *
                      </Label>
                      <p className={cn("text-[10px] sm:text-xs mt-1 mb-2", themeClasses.textNeutralSecondary)}>
                        Select the type of registration number you have
                      </p>
                      <div className="relative mt-1">
                        <FileText className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 z-10 pointer-events-none", themeClasses.textNeutralSecondary)} />
                        <Select
                          value={formData.registrationType}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, registrationType: value as 'tin' | 'business_registration' | 'company_registration' }))}
                          required
                        >
                          <SelectTrigger 
                            className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                          >
                            <SelectValue placeholder="Select registration type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tin">TIN Number</SelectItem>
                            <SelectItem value="business_registration">Business Registration Number</SelectItem>
                            <SelectItem value="company_registration">Company Registration Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.registrationType && (
                      <div>
                        <Label htmlFor="businessRegistrationNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {formData.registrationType === 'tin' && 'TIN Number *'}
                          {formData.registrationType === 'business_registration' && 'Business Registration Number *'}
                          {formData.registrationType === 'company_registration' && 'Company Registration Number *'}
                        </Label>
                        <div className="relative mt-1">
                          <FileText className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5", themeClasses.textNeutralSecondary)} />
                          <Input
                            id="businessRegistrationNumber"
                            type="text"
                            value={formData.businessRegistrationNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, businessRegistrationNumber: e.target.value }))}
                            placeholder={
                              formData.registrationType === 'tin' 
                                ? "Enter your TIN number"
                                : formData.registrationType === 'business_registration'
                                ? "Enter your business registration number"
                                : "Enter your company registration number"
                            }
                            className={cn("pl-9 sm:pl-10 text-sm", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                            required
                          />
                        </div>
                      </div>
                    )}

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

                    {/* Document Uploads - Free and Premium Plans */}
                    {currentPlan && (currentPlan.slug === 'free' || currentPlan.slug === 'premium') && formData.registrationType && (
                      <div className={cn("pt-4 border-t", themeClasses.cardBorder)}>
                        <h3 className={cn("text-base font-semibold mb-3", themeClasses.mainText)}>
                          <FileCheck className="inline w-4 h-4 mr-2" />
                          {formData.registrationType === 'tin' && 'TIN Certificate Document'}
                          {formData.registrationType === 'business_registration' && 'Business Registration Certificate'}
                          {formData.registrationType === 'company_registration' && 'Company Registration Certificate'}
                        </h3>
                        <p className={cn("text-xs mb-4", themeClasses.textNeutralSecondary)}>
                          {formData.registrationType === 'tin' && 'Please upload your Business TIN Certificate document'}
                          {formData.registrationType === 'business_registration' && 'Please upload your Business Registration Certificate document'}
                          {formData.registrationType === 'company_registration' && 'Please upload your Company Registration Certificate document'}
                        </p>

                        {/* TIN Certificate Upload - shown when TIN is selected */}
                        {formData.registrationType === 'tin' && (
                          <div>
                            <Label htmlFor="businessTinCertificate" className={cn("text-sm", themeClasses.mainText)}>
                              Business TIN Certificate *
                            </Label>
                            <div className="flex items-center gap-4 mt-2">
                              {businessTinCertificate ? (
                                <div className="relative group">
                                  {businessTinCertificate.includes('.pdf') || businessTinCertificate.includes('application/pdf') ? (
                                    <div 
                                      className={cn("w-16 h-16 border rounded-md flex items-center justify-center cursor-pointer hover:bg-opacity-80 transition-colors", themeClasses.cardBorder, themeClasses.cardBg)}
                                      onClick={() => openDocumentPreview(businessTinCertificate)}
                                    >
                                      <FileText className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                    </div>
                                  ) : (
                                    <div 
                                      className="cursor-pointer"
                                      onClick={() => openDocumentPreview(businessTinCertificate)}
                                    >
                                      <Image
                                        src={businessTinCertificate}
                                        alt="TIN Certificate"
                                        width={64}
                                        height={64}
                                        className={cn("w-16 h-16 object-cover border rounded-md hover:opacity-80 transition-opacity", themeClasses.cardBorder, themeClasses.cardBg)}
                                      />
                                    </div>
                                  )}
                                  <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                  <FileText className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                </div>
                              )}
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id="businessTinCertificate"
                                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                                  onChange={(e) => handleDocumentUpload(e, 'business_tin_certificate')}
                                  className="hidden"
                                  disabled={uploadingDocument === 'business_tin_certificate'}
                                />
                                <div className="flex items-center gap-2">
                                  <Label
                                    htmlFor="businessTinCertificate"
                                    className={cn(
                                      "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                      themeClasses.cardBorder,
                                      themeClasses.cardBg,
                                      uploadingDocument === 'business_tin_certificate' && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <Upload className="h-4 w-4" />
                                    <span>
                                      {uploadingDocument === 'business_tin_certificate' 
                                        ? "Uploading..." 
                                        : businessTinCertificate 
                                          ? "Change TIN Certificate" 
                                          : "Upload TIN Certificate"}
                                    </span>
                                  </Label>
                                  {businessTinCertificate && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openDocumentPreview(businessTinCertificate)}
                                      className="flex items-center gap-2"
                                    >
                                      <Eye className="h-4 w-4" />
                                      Preview
                                    </Button>
                                  )}
                                </div>
                                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                  PNG, JPG, PDF (max 10MB)
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Company Certificate Upload - shown when Business Registration or Company Registration is selected */}
                        {(formData.registrationType === 'business_registration' || formData.registrationType === 'company_registration') && (
                          <div>
                            <Label htmlFor="companyCertificate" className={cn("text-sm", themeClasses.mainText)}>
                              {formData.registrationType === 'business_registration' && 'Business Registration Certificate *'}
                              {formData.registrationType === 'company_registration' && 'Company Registration Certificate *'}
                            </Label>
                            <div className="flex items-center gap-4 mt-2">
                              {companyCertificate ? (
                                <div className="relative group">
                                  {companyCertificate.includes('.pdf') || companyCertificate.includes('application/pdf') ? (
                                    <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center cursor-pointer hover:bg-opacity-80 transition-colors", themeClasses.cardBorder, themeClasses.cardBg)}
                                      onClick={() => openDocumentPreview(companyCertificate)}
                                    >
                                      <FileText className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                    </div>
                                  ) : (
                                    <div 
                                      className="cursor-pointer"
                                      onClick={() => openDocumentPreview(companyCertificate)}
                                    >
                                      <Image
                                        src={companyCertificate}
                                        alt={formData.registrationType === 'business_registration' ? 'Business Registration Certificate' : 'Company Registration Certificate'}
                                        width={64}
                                        height={64}
                                        className={cn("w-16 h-16 object-cover border rounded-md hover:opacity-80 transition-opacity", themeClasses.cardBorder, themeClasses.cardBg)}
                                      />
                                    </div>
                                  )}
                                  <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                  <FileText className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                </div>
                              )}
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id="companyCertificate"
                                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                                  onChange={(e) => handleDocumentUpload(e, 'company_certificate')}
                                  className="hidden"
                                  disabled={uploadingDocument === 'company_certificate'}
                                />
                                <div className="flex items-center gap-2">
                                  <Label
                                    htmlFor="companyCertificate"
                                    className={cn(
                                      "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                      themeClasses.cardBorder,
                                      themeClasses.cardBg,
                                      uploadingDocument === 'company_certificate' && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <Upload className="h-4 w-4" />
                                    <span>
                                      {uploadingDocument === 'company_certificate' 
                                        ? "Uploading..." 
                                        : companyCertificate 
                                          ? (formData.registrationType === 'business_registration' ? "Change Business Certificate" : "Change Company Certificate")
                                          : (formData.registrationType === 'business_registration' ? "Upload Business Certificate" : "Upload Company Certificate")}
                                    </span>
                                  </Label>
                                {companyCertificate && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDocumentPreview(companyCertificate)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                  </Button>
                                )}
                                </div>
                                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                  PNG, JPG, PDF (max 10MB) - Click thumbnail to view full size
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Document Uploads - Winga Plan */}
                    {currentPlan && currentPlan.slug === 'winga' && (
                      <div className={cn("pt-4 border-t", themeClasses.cardBorder)}>
                        <h3 className={cn("text-base font-semibold mb-3", themeClasses.mainText)}>
                          <IdCard className="inline w-4 h-4 mr-2" />
                          Identity Documents
                        </h3>
                        <p className={cn("text-xs mb-4", themeClasses.textNeutralSecondary)}>
                          Please upload your NIDA card (front and rear) and a self picture
                        </p>

                        {/* NIDA Card Front */}
                        <div className="mb-4">
                          <Label htmlFor="nidaCardFront" className={cn("text-sm", themeClasses.mainText)}>
                            NIDA Card - Front *
                          </Label>
                          <div className="flex items-center gap-4 mt-2">
                            {nidaCardFront ? (
                              <Image
                                src={nidaCardFront}
                                alt="NIDA Card Front"
                                width={64}
                                height={64}
                                className={cn("w-16 h-16 object-cover border rounded-md", themeClasses.cardBorder, themeClasses.cardBg)}
                              />
                            ) : (
                              <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                <IdCard className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                              </div>
                            )}
                            <div className="flex-1">
                              <input
                                type="file"
                                id="nidaCardFront"
                                accept=".png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => handleDocumentUpload(e, 'nida_card_front')}
                                className="hidden"
                                disabled={uploadingDocument === 'nida_card_front'}
                              />
                              <Label
                                htmlFor="nidaCardFront"
                                className={cn(
                                  "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                  themeClasses.cardBorder,
                                  themeClasses.cardBg,
                                  uploadingDocument === 'nida_card_front' && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Upload className="h-4 w-4" />
                                <span>
                                  {uploadingDocument === 'nida_card_front' 
                                    ? "Uploading..." 
                                    : nidaCardFront 
                                      ? "Change Front" 
                                      : "Upload NIDA Front"}
                                </span>
                              </Label>
                              <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                PNG, JPG (max 10MB)
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* NIDA Card Rear */}
                        <div className="mb-4">
                          <Label htmlFor="nidaCardRear" className={cn("text-sm", themeClasses.mainText)}>
                            NIDA Card - Rear *
                          </Label>
                          <div className="flex items-center gap-4 mt-2">
                            {nidaCardRear ? (
                              <div className="relative group">
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => openDocumentPreview(nidaCardRear)}
                                >
                                  <Image
                                    src={nidaCardRear}
                                    alt="NIDA Card Rear"
                                    width={64}
                                    height={64}
                                    className={cn("w-16 h-16 object-cover border rounded-md hover:opacity-80 transition-opacity", themeClasses.cardBorder, themeClasses.cardBg)}
                                  />
                                </div>
                                <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3 h-3 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                <IdCard className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                              </div>
                            )}
                            <div className="flex-1">
                              <input
                                type="file"
                                id="nidaCardRear"
                                accept=".png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => handleDocumentUpload(e, 'nida_card_rear')}
                                className="hidden"
                                disabled={uploadingDocument === 'nida_card_rear'}
                              />
                              <div className="flex items-center gap-2">
                                <Label
                                  htmlFor="nidaCardRear"
                                  className={cn(
                                    "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                    themeClasses.cardBorder,
                                    themeClasses.cardBg,
                                    uploadingDocument === 'nida_card_rear' && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span>
                                    {uploadingDocument === 'nida_card_rear' 
                                      ? "Uploading..." 
                                      : nidaCardRear 
                                        ? "Change Rear" 
                                        : "Upload NIDA Rear"}
                                  </span>
                                </Label>
                                {nidaCardRear && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDocumentPreview(nidaCardRear)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                  </Button>
                                )}
                              </div>
                              <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                PNG, JPG (max 10MB) - Click thumbnail to view full size
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Self Picture */}
                        <div>
                          <Label htmlFor="selfPicture" className={cn("text-sm", themeClasses.mainText)}>
                            Self Picture *
                          </Label>
                          <div className="flex items-center gap-4 mt-2">
                            {selfPicture ? (
                              <div className="relative group">
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => openDocumentPreview(selfPicture)}
                                >
                                  <Image
                                    src={selfPicture}
                                    alt="Self Picture"
                                    width={64}
                                    height={64}
                                    className={cn("w-16 h-16 object-cover border rounded-full hover:opacity-80 transition-opacity", themeClasses.cardBorder, themeClasses.cardBg)}
                                  />
                                </div>
                                <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3 h-3 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className={cn("w-16 h-16 border rounded-full flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                <Camera className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                              </div>
                            )}
                            <div className="flex-1">
                              <input
                                type="file"
                                id="selfPicture"
                                accept=".png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => handleDocumentUpload(e, 'self_picture')}
                                className="hidden"
                                disabled={uploadingDocument === 'self_picture'}
                              />
                              <div className="flex items-center gap-2">
                                <Label
                                  htmlFor="selfPicture"
                                  className={cn(
                                    "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                    themeClasses.cardBorder,
                                    themeClasses.cardBg,
                                    uploadingDocument === 'self_picture' && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <Camera className="h-4 w-4" />
                                  <span>
                                    {uploadingDocument === 'self_picture' 
                                      ? "Uploading..." 
                                      : selfPicture 
                                        ? "Change Picture" 
                                        : "Upload Self Picture"}
                                  </span>
                                </Label>
                                {selfPicture && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDocumentPreview(selfPicture)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                  </Button>
                                )}
                              </div>
                              <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                PNG, JPG (max 10MB) - Click thumbnail to view full size
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

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

                    {/* Declarations Section */}
                    <div className={cn("pt-4 border-t space-y-4", themeClasses.cardBorder)}>
                      {/* NIDA Declaration for Winga Plans */}
                      {currentPlan && currentPlan.slug === 'winga' && (
                        <div className={cn("p-4 rounded-lg border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="nidaDeclaration"
                              checked={nidaDeclarationAccepted}
                              onCheckedChange={(checked) => setNidaDeclarationAccepted(checked === true)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label 
                                htmlFor="nidaDeclaration" 
                                className={cn("text-sm font-semibold cursor-pointer", themeClasses.mainText)}
                              >
                                NIDA Declaration *
                              </Label>
                              <p className={cn("text-xs mt-2 leading-relaxed", themeClasses.textNeutralSecondary)}>
                                I hereby declare that:
                              </p>
                              <ul className={cn("text-xs mt-2 ml-4 space-y-1 list-disc", themeClasses.textNeutralSecondary)}>
                                <li>The NIDA card information provided is accurate and belongs to me</li>
                                <li>The self-picture uploaded is a recent and accurate representation of myself</li>
                                <li>I understand that providing false or misleading information will result in account suspension or termination</li>
                                <li>I agree to comply with all applicable laws and regulations regarding identity verification</li>
                                <li>I understand that this information will be used for verification purposes and to build trust with customers</li>
                              </ul>
                              {!nidaDeclarationAccepted && (
                                <p className={cn("text-xs mt-2 text-red-600 dark:text-red-400")}>
                                  You must accept this declaration to submit your information
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Certification Declaration for Free and Premium Plans */}
                      {currentPlan && (currentPlan.slug === 'free' || currentPlan.slug === 'premium') && (
                        <div className={cn("p-4 rounded-lg border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="certificationDeclaration"
                              checked={certificationDeclarationAccepted}
                              onCheckedChange={(checked) => setCertificationDeclarationAccepted(checked === true)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label 
                                htmlFor="certificationDeclaration" 
                                className={cn("text-sm font-semibold cursor-pointer", themeClasses.mainText)}
                              >
                                Certification Declaration *
                              </Label>
                              <p className={cn("text-xs mt-2 leading-relaxed", themeClasses.textNeutralSecondary)}>
                                I hereby declare that:
                              </p>
                              <ul className={cn("text-xs mt-2 ml-4 space-y-1 list-disc", themeClasses.textNeutralSecondary)}>
                                <li>The {formData.registrationType === 'tin' ? 'TIN Certificate' : formData.registrationType === 'business_registration' ? 'Business Registration Certificate' : 'Company Registration Certificate'} provided is authentic and valid</li>
                                <li>All business information provided is accurate and up-to-date</li>
                                <li>I understand that providing false or misleading information will result in account suspension or termination</li>
                                <li>I agree to comply with all applicable laws and regulations regarding business registration</li>
                                <li>I understand that this information will be used for verification purposes and to build trust with customers</li>
                                <li>The uploaded certificate document is a true copy of the original document</li>
                              </ul>
                              {!certificationDeclarationAccepted && (
                                <p className={cn("text-xs mt-2 text-red-600 dark:text-red-400")}>
                                  You must accept this declaration to submit your information
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={
                          isSubmitting || 
                          (currentPlan?.slug === 'winga' && !nidaDeclarationAccepted) ||
                          ((currentPlan?.slug === 'free' || currentPlan?.slug === 'premium') && !certificationDeclarationAccepted)
                        }
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-neutral-950 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Document Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className={cn(themeClasses.mainText)}>Document Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6 overflow-hidden">
            {previewDocumentUrl && (
              <div className="w-full h-full border rounded-lg overflow-hidden">
                {previewDocumentUrl.includes('.pdf') || previewDocumentUrl.includes('application/pdf') ? (
                  <iframe
                    src={previewDocumentUrl}
                    className="w-full h-full border-0"
                    title="Document Preview"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                    <img
                      src={previewDocumentUrl}
                      alt="Document Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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

