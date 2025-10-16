"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCompanyContext } from "@/components/company-provider"
import { toast } from "@/hooks/use-toast"
import { 
  Settings, 
  Building2, 
  Save, 
  RotateCcw, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Shield,
  Palette,
  Bell,
  Database,
  Key,
  Server,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Upload,
  Image as ImageIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { ImagePreviewModal } from "@/components/image-preview-modal"
import { ImageUpload } from "@/components/image-upload"
import { MultiImageUpload } from "@/components/multi-image-upload"

interface SettingsData {
  // Company Branding
  companyName: string
  companyColor: string
  companyLogo: string
  mainHeadline: string
  heroBackgroundImage: string
  heroTaglineAlignment: string
  // Service Images (Multiple images support)
  serviceRetailImages: string[]
  servicePrototypingImages: string[]
  servicePcbImages: string[]
  serviceAiImages: string[]
  serviceStemImages: string[]
  serviceHomeImages: string[]
  serviceImageRotationTime: number
  // Legacy single image support
  serviceRetailImage: string
  servicePrototypingImage: string
  servicePcbImage: string
  serviceAiImage: string
  serviceStemImage: string
  
  // Contact Information
  websiteUrl: string
  contactEmail: string
  contactPhone: string
  address: string
  
  // Localization
  currency: string
  timezone: string
  language: string
  
  // Theme Settings
  theme: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  
  // Navigation Settings
  navTranslucent: boolean
  navOpacity: number
  navTheme: string
  
  // Footer Settings
  footerTheme: string
  footerColumns: number
  
  // Product Display Settings
  productsPerRowMobile: number
  productsPerRowTablet: number
  productsPerRowDesktop: number
  productCardSpacing: number
  productCardRadius: number
  
  // Cart Settings
  cartCompactMode: boolean
  cartItemSpacing: number
  showClearCartButton: boolean
  showSaveForLater: boolean
  
  // Mobile Settings
  mobileNavHeight: string
  mobileFontSize: string
  mobileCategoryIconsSmall: boolean
  mobileFooterColumns: number
  
  // JSON Settings
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
    orderUpdates: boolean
    promotional: boolean
    securityAlerts: boolean
  }
  apiKeys: {
    googleMaps: string
    dpoPayment: string
    stripe: string
    emailService: string
    smsService: string
  }
  security: {
    twoFactorAuth: boolean
    sessionTimeout: number
    passwordPolicy: string
    loginAttempts: number
    lockoutDuration: number
  }
  performance: {
    cacheEnabled: boolean
    imageOptimization: boolean
    cdnEnabled: boolean
    lazyLoading: boolean
    preloadCritical: boolean
  }
  seo: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string
    ogImage: string
    favicon: string
  }
  socialLinks: {
    facebook: string
    twitter: string
    instagram: string
    linkedin: string
    youtube: string
  }
  paymentSettings: {
    defaultCurrency: string
    supportedCurrencies: string[]
    paymentMethods: string[]
    shippingCost: number
  }
  businessHours: {
    monday: { open: string; close: string; closed: boolean }
    tuesday: { open: string; close: string; closed: boolean }
    wednesday: { open: string; close: string; closed: boolean }
    thursday: { open: string; close: string; closed: boolean }
    friday: { open: string; close: string; closed: boolean }
    saturday: { open: string; close: string; closed: boolean }
    sunday: { open: string; close: string; closed: boolean }
  }
}

export default function SettingsPage() {
  const { 
    companyName, 
    companyColor, 
    companyLogo, 
  mainHeadline,
  heroBackgroundImage,
  heroTaglineAlignment,
  updateCompanyName,
    updateCompanyColor, 
    updateCompanyLogo, 
    updateMainHeadline,
  updateHeroBackgroundImage,
  updateHeroTaglineAlignment,
  resetCompanyName,
    resetCompanyColor, 
    resetCompanyLogo, 
    resetMainHeadline,
  resetHeroBackgroundImage,
  resetHeroTaglineAlignment,
  isLoaded,
    settings: adminSettings,
    updateSettings
  } = useCompanyContext()
  
  // Initialize settings with current admin settings data
  const [settings, setSettings] = useState<SettingsData>({
    // Company Branding
    companyName: companyName,
    companyColor: companyColor,
    companyLogo: companyLogo,
    mainHeadline: mainHeadline,
    heroBackgroundImage: heroBackgroundImage,
    heroTaglineAlignment: adminSettings?.heroTaglineAlignment || 'left',
    // Service Images (Multiple images)
    serviceRetailImages: adminSettings?.serviceRetailImages || [],
    servicePrototypingImages: adminSettings?.servicePrototypingImages || [],
    servicePcbImages: adminSettings?.servicePcbImages || [],
    serviceAiImages: adminSettings?.serviceAiImages || [],
    serviceStemImages: adminSettings?.serviceStemImages || [],
    serviceHomeImages: adminSettings?.serviceHomeImages || [],
    serviceImageRotationTime: adminSettings?.serviceImageRotationTime || 5,
    // Legacy single image support
    serviceRetailImage: adminSettings?.serviceRetailImage || '',
    servicePrototypingImage: adminSettings?.servicePrototypingImage || '',
    servicePcbImage: adminSettings?.servicePcbImage || '',
    serviceAiImage: adminSettings?.serviceAiImage || '',
    serviceStemImage: adminSettings?.serviceStemImage || '',
    
    // Contact Information
    websiteUrl: adminSettings?.websiteUrl || "",
    contactEmail: adminSettings?.contactEmail || "",
    contactPhone: adminSettings?.contactPhone || "",
    address: adminSettings?.address || "",
    
    // Localization
    currency: adminSettings?.currency || "TZS",
    timezone: adminSettings?.timezone || "Africa/Dar_es_Salaam",
    language: adminSettings?.language || "en",
    
    // Theme Settings
    theme: adminSettings?.theme || "system",
    primaryColor: adminSettings?.primaryColor || "#3B82F6",
    secondaryColor: adminSettings?.secondaryColor || "#6B7280",
    accentColor: adminSettings?.accentColor || "#F59E0B",
    
    // Navigation Settings
    navTranslucent: adminSettings?.navTranslucent ?? true,
    navOpacity: adminSettings?.navOpacity || 0.95,
    navTheme: adminSettings?.navTheme || "auto",
    
    // Footer Settings
    footerTheme: adminSettings?.footerTheme || "dark",
    footerColumns: adminSettings?.footerColumns || 5,
    
    // Product Display Settings
    productsPerRowMobile: adminSettings?.productsPerRowMobile || 3,
    productsPerRowTablet: adminSettings?.productsPerRowTablet || 4,
    productsPerRowDesktop: adminSettings?.productsPerRowDesktop || 5,
    productCardSpacing: adminSettings?.productCardSpacing || 4,
    productCardRadius: adminSettings?.productCardRadius || 0.5,
    
    // Cart Settings
    cartCompactMode: adminSettings?.cartCompactMode ?? true,
    cartItemSpacing: adminSettings?.cartItemSpacing || 0,
    showClearCartButton: adminSettings?.showClearCartButton ?? false,
    showSaveForLater: adminSettings?.showSaveForLater ?? true,
    
    // Mobile Settings
    mobileNavHeight: adminSettings?.mobileNavHeight || "h-4",
    mobileFontSize: adminSettings?.mobileFontSize || "text-xs",
    mobileCategoryIconsSmall: adminSettings?.mobileCategoryIconsSmall ?? true,
    mobileFooterColumns: adminSettings?.mobileFooterColumns || 3,
    
    // JSON Settings
    notifications: adminSettings?.notifications || {
      email: true,
      sms: false,
      push: true,
      orderUpdates: true,
      promotional: false,
      securityAlerts: true
    },
    apiKeys: adminSettings?.apiKeys || {
      googleMaps: "",
      dpoPayment: "",
      stripe: "",
      emailService: "",
      smsService: ""
    },
    security: adminSettings?.security || {
      twoFactorAuth: false,
      sessionTimeout: 30,
      passwordPolicy: "strong",
      loginAttempts: 5,
      lockoutDuration: 15
    },
    performance: adminSettings?.performance || {
      cacheEnabled: true,
      imageOptimization: true,
      cdnEnabled: false,
      lazyLoading: true,
      preloadCritical: true
    },
    seo: adminSettings?.seo || {
      metaTitle: "honiccompanystore - Shopping",
      metaDescription: "Your trusted source for technology and innovation",
      metaKeywords: "technology, innovation, electronics, arduino",
      ogImage: "/og-image.png",
      favicon: "/favicon.ico"
    },
    socialLinks: adminSettings?.socialLinks || {
      facebook: "",
      twitter: "",
      instagram: "",
      linkedin: "",
      youtube: ""
    },
    paymentSettings: adminSettings?.paymentSettings || {
      defaultCurrency: "TZS",
      supportedCurrencies: ["TZS", "USD", "EUR"],
      paymentMethods: ["card", "mobile_money", "bank_transfer"],
      shippingCost: 5000
    },
    businessHours: adminSettings?.businessHours || {
      monday: { open: "09:00", close: "18:00", closed: false },
      tuesday: { open: "09:00", close: "18:00", closed: false },
      wednesday: { open: "09:00", close: "18:00", closed: false },
      thursday: { open: "09:00", close: "18:00", closed: false },
      friday: { open: "09:00", close: "18:00", closed: false },
      saturday: { open: "09:00", close: "16:00", closed: false },
      sunday: { open: "10:00", close: "14:00", closed: false }
    }
  })

  const [isUpdating, setIsUpdating] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false)

  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)

  // Update local settings when admin settings are loaded from database
  useEffect(() => {
    if (isLoaded && adminSettings) {
      setSettings(prev => ({
        ...prev,
        // Company Branding
        companyName: companyName,
        companyColor: companyColor,
        companyLogo: companyLogo,
        mainHeadline: mainHeadline,
        heroBackgroundImage: heroBackgroundImage,
        
        // Contact Information
        websiteUrl: adminSettings.websiteUrl || prev.websiteUrl,
        contactEmail: adminSettings.contactEmail || prev.contactEmail,
        contactPhone: adminSettings.contactPhone || prev.contactPhone,
        address: adminSettings.address || prev.address,
        
        // Localization
        currency: adminSettings.currency || prev.currency,
        timezone: adminSettings.timezone || prev.timezone,
        language: adminSettings.language || prev.language,
        
        // Theme Settings
        theme: adminSettings.theme || prev.theme,
        primaryColor: adminSettings.primaryColor || prev.primaryColor,
        secondaryColor: adminSettings.secondaryColor || prev.secondaryColor,
        accentColor: adminSettings.accentColor || prev.accentColor,
        
        // Navigation Settings
        navTranslucent: adminSettings.navTranslucent ?? prev.navTranslucent,
        navOpacity: adminSettings.navOpacity || prev.navOpacity,
        navTheme: adminSettings.navTheme || prev.navTheme,
        
        // Footer Settings
        footerTheme: adminSettings.footerTheme || prev.footerTheme,
        footerColumns: adminSettings.footerColumns || prev.footerColumns,
        
        // Product Display Settings
        productsPerRowMobile: adminSettings.productsPerRowMobile || prev.productsPerRowMobile,
        productsPerRowTablet: adminSettings.productsPerRowTablet || prev.productsPerRowTablet,
        productsPerRowDesktop: adminSettings.productsPerRowDesktop || prev.productsPerRowDesktop,
        productCardSpacing: adminSettings.productCardSpacing || prev.productCardSpacing,
        productCardRadius: adminSettings.productCardRadius || prev.productCardRadius,
        
        // Cart Settings
        cartCompactMode: adminSettings.cartCompactMode ?? prev.cartCompactMode,
        cartItemSpacing: adminSettings.cartItemSpacing || prev.cartItemSpacing,
        showClearCartButton: adminSettings.showClearCartButton ?? prev.showClearCartButton,
        showSaveForLater: adminSettings.showSaveForLater ?? prev.showSaveForLater,
        
        // Mobile Settings
        mobileNavHeight: adminSettings.mobileNavHeight || prev.mobileNavHeight,
        mobileFontSize: adminSettings.mobileFontSize || prev.mobileFontSize,
        mobileCategoryIconsSmall: adminSettings.mobileCategoryIconsSmall ?? prev.mobileCategoryIconsSmall,
        mobileFooterColumns: adminSettings.mobileFooterColumns || prev.mobileFooterColumns,
        // Service Images
        serviceRetailImage: adminSettings.serviceRetailImage || prev.serviceRetailImage,
        servicePrototypingImage: adminSettings.servicePrototypingImage || prev.servicePrototypingImage,
        servicePcbImage: adminSettings.servicePcbImage || prev.servicePcbImage,
        serviceAiImage: adminSettings.serviceAiImage || prev.serviceAiImage,
        serviceStemImage: adminSettings.serviceStemImage || prev.serviceStemImage,
        
        // JSON Settings
        notifications: adminSettings.notifications || prev.notifications,
        apiKeys: adminSettings.apiKeys || prev.apiKeys,
        security: adminSettings.security || prev.security,
        performance: adminSettings.performance || prev.performance,
        seo: adminSettings.seo || prev.seo,
        socialLinks: adminSettings.socialLinks || prev.socialLinks,
        paymentSettings: adminSettings.paymentSettings || prev.paymentSettings,
        businessHours: adminSettings.businessHours || prev.businessHours
      }))
    }
  }, [isLoaded, adminSettings, companyName, companyColor, companyLogo, mainHeadline, heroBackgroundImage])

  const handleUpdateCompanyName = async () => {
    if (!settings.companyName.trim()) {
      toast({
        title: "Error",
        description: "Company name cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    
    try {
      const success = await updateCompanyName(settings.companyName.trim())
      if (success) {
        toast({
          title: "Success",
          description: "Company name updated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update company name",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating company name",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateCompanyColor = async () => {
    if (!settings.companyColor.trim()) {
      toast({
        title: "Error",
        description: "Company color cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    
    try {
      const success = await updateCompanyColor(settings.companyColor.trim())
      if (success) {
        toast({
          title: "Success",
          description: "Company color updated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update company color",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating company color",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateCompanyTagline = async () => {
    setIsUpdating(true)
    
    try {
      const success = await updateMainHeadline(settings.mainHeadline.trim())
      if (success) {
        toast({
          title: "Success",
          description: "Company tagline updated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update company tagline",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating company tagline",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleResetCompanyName = async () => {
    await resetCompanyName()
    setSettings(prev => ({ ...prev, companyName: "honiccompanystore" }))
    toast({
      title: "Reset",
      description: "Company name reset to default",
    })
  }

  const handleResetCompanyColor = async () => {
    await resetCompanyColor()
    setSettings(prev => ({ ...prev, companyColor: "#3B82F6" }))
    toast({
      title: "Reset",
      description: "Company color reset to default",
    })
  }

  const handleResetCompanyTagline = async () => {
    await resetMainHeadline()
    setSettings(prev => ({ ...prev, mainHeadline: "Welcome to honiccompanystore" }))
    toast({
      title: "Reset",
      description: "Company tagline reset to default",
    })
  }

  const handleUpdateCompanyLogo = async () => {
    setIsUpdating(true)
    
    try {
      const success = await updateCompanyLogo(settings.companyLogo)
      if (success) {
        toast({
          title: "Success",
          description: "Company logo updated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update company logo",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating company logo",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload a valid image file (PNG, JPG, GIF, SVG, or ICO)",
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
      // Convert file to base64 data URL
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const success = await updateCompanyLogo(dataUrl)
        if (success) {
          setSettings(prev => ({ ...prev, companyLogo: dataUrl }))
          toast({
            title: "Success",
            description: "Company logo updated successfully",
          })
        } else {
          toast({
            title: "Error",
            description: "Failed to update company logo",
            variant: "destructive",
          })
        }
        setIsUploadingLogo(false)
      }
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read the uploaded file",
          variant: "destructive",
        })
        setIsUploadingLogo(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while uploading the logo",
        variant: "destructive",
      })
      setIsUploadingLogo(false)
    }
  }

  const handleResetCompanyLogo = async () => {
    await resetCompanyLogo()
    setSettings(prev => ({ ...prev, companyLogo: "/android-chrome-512x512.png" }))
    toast({
      title: "Reset",
      description: "Company logo reset to default",
    })
  }

  const handleHeroImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload a valid image file (PNG, JPG, GIF, or WebP)",
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

    setIsUploadingHeroImage(true)

    try {
      // Upload to dedicated hero images API
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/hero-upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Update the hero background image with the uploaded URL
        const success = await updateHeroBackgroundImage(result.url)
        if (success) {
          setSettings(prev => ({ ...prev, heroBackgroundImage: result.url }))
          toast({
            title: "Success",
            description: "Hero background image uploaded and updated successfully",
          })
        } else {
          toast({
            title: "Error",
            description: "Failed to update hero background image setting",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to upload hero image",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while uploading the hero image",
        variant: "destructive",
      })
    } finally {
      setIsUploadingHeroImage(false)
    }
  }

  const handleUpdateMainHeadline = async () => {
    if (!settings.mainHeadline.trim()) {
      toast({
        title: "Error",
        description: "Main headline cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    
    try {
      const success = await updateMainHeadline(settings.mainHeadline.trim())
      if (success) {
        toast({
          title: "Success",
          description: "Main headline updated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update main headline",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating main headline",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleResetMainHeadline = async () => {
    await resetMainHeadline()
    setSettings(prev => ({ ...prev, mainHeadline: "The leading B2B ecommerce platform for global trade" }))
    toast({
      title: "Reset",
      description: "Main headline reset to default",
    })
  }

  const handleResetHeroBackgroundImage = async () => {
    await resetHeroBackgroundImage()
    setSettings(prev => ({ ...prev, heroBackgroundImage: "" }))
    toast({
      title: "Reset",
      description: "Hero background image removed",
    })
  }

  const handleSaveSettings = async () => {
    setIsUpdating(true)
    
    try {
      // Create a safe settings object with only the fields that are properly configured
      const safeSettings = {
        companyName: settings.companyName,
        companyColor: settings.companyColor,
        companyTagline: settings.companyTagline,
        companyLogo: settings.companyLogo,
        mainHeadline: settings.mainHeadline,
        heroBackgroundImage: settings.heroBackgroundImage,
        heroTaglineAlignment: settings.heroTaglineAlignment,
        serviceRetailImage: settings.serviceRetailImage,
        servicePrototypingImage: settings.servicePrototypingImage,
        servicePcbImage: settings.servicePcbImage,
        serviceAiImage: settings.serviceAiImage,
        serviceStemImage: settings.serviceStemImage,
        websiteUrl: settings.websiteUrl,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        address: settings.address,
        currency: settings.currency,
        timezone: settings.timezone,
        language: settings.language,
        theme: settings.theme,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        navTranslucent: settings.navTranslucent,
        navOpacity: settings.navOpacity,
        navTheme: settings.navTheme,
        footerTheme: settings.footerTheme,
        footerColumns: settings.footerColumns,
        productsPerRowMobile: settings.productsPerRowMobile,
        productsPerRowTablet: settings.productsPerRowTablet,
        productsPerRowDesktop: settings.productsPerRowDesktop,
        productCardSpacing: settings.productCardSpacing,
        productCardRadius: settings.productCardRadius,
        cartCompactMode: settings.cartCompactMode,
        cartItemSpacing: settings.cartItemSpacing,
        showClearCartButton: settings.showClearCartButton,
        showSaveForLater: settings.showSaveForLater,
        mobileNavHeight: settings.mobileNavHeight,
        mobileFontSize: settings.mobileFontSize,
        mobileCategoryIconsSmall: settings.mobileCategoryIconsSmall,
        mobileFooterColumns: settings.mobileFooterColumns,
        notifications: settings.notifications,
        apiKeys: settings.apiKeys,
        security: settings.security,
        performance: settings.performance,
        seo: settings.seo,
        socialLinks: settings.socialLinks,
        paymentSettings: settings.paymentSettings,
        businessHours: settings.businessHours
      }
      
      // Save all settings to database using the new admin settings API
      const success = await updateSettings(safeSettings)
      
      if (success) {
      toast({
        title: "Success",
          description: "All settings saved successfully to database",
        })
      } else {
        toast({
          title: "Warning",
          description: "Some settings may not have saved. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving settings",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const copyToClipboard = async (text: string, keyName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(keyName)
      toast({
        title: "Copied",
        description: `${keyName} copied to clipboard`,
      })
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" suppressHydrationWarning></div>
          <p className="mt-2 text-sm text-gray-600" suppressHydrationWarning>Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <Button
          onClick={handleSaveSettings}
          disabled={isUpdating}
          className="flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>Save All Settings</span>
        </Button>
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Company Information</span>
            </CardTitle>
            <CardDescription>
              Manage your company details and branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={settings.companyName}
                onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-color">Company Color</Label>
              <div className="flex space-x-2">
                <Input
                  id="company-color"
                  value={settings.companyColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, companyColor: e.target.value }))}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
                <div 
                  className="w-12 h-10 rounded border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: settings.companyColor }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a hex color code (e.g., #3B82F6 for blue)
              </p>
            </div>


            <div className="space-y-2">
              <Label htmlFor="company-logo">Company Logo</Label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Image
                    src={settings.companyLogo}
                    alt="Company Logo"
                    width={64}
                    height={64}
                    className="w-16 h-16 object-contain border border-gray-200 rounded-md bg-white"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    id="company-logo"
                    accept=".png,.jpg,.jpeg,.gif,.svg,.ico"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={isUploadingLogo}
                  />
                  <Label
                    htmlFor="company-logo"
                    className={cn(
                      "cursor-pointer inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors",
                      isUploadingLogo && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Upload className="h-4 w-4" />
                    <span>{isUploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PNG, JPG, GIF, SVG, and ICO files (max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="favicon">Website Favicon</Label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {settings.seo.favicon && (
                    <Image
                      src={settings.seo.favicon}
                      alt="Favicon Preview"
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain border border-gray-200 rounded-sm bg-white"
                      unoptimized
                    />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    id="favicon"
                    value={settings.seo.favicon}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      seo: { ...prev.seo, favicon: e.target.value } 
                    }))}
                    placeholder="/favicon.ico or full URL"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter favicon path (e.g., /favicon.ico) or full URL. For custom favicon, upload to /public folder.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="main-headline">Main Headline</Label>
              <Textarea
                id="main-headline"
                value={settings.mainHeadline}
                onChange={(e) => setSettings(prev => ({ ...prev, mainHeadline: e.target.value }))}
                placeholder="The leading B2B ecommerce platform for global trade"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Main headline displayed on the landing page hero section
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-background-image">Hero Background Image</Label>
              <div className="flex items-center space-x-4">
                <div 
                  className="relative w-30 h-20 border border-gray-200 rounded-md overflow-hidden cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => {
                    if (settings.heroBackgroundImage) {
                      setIsImagePreviewOpen(true)
                    }
                  }}
                >
                  {settings.heroBackgroundImage ? (
                    <Image
                      src={settings.heroBackgroundImage}
                      alt="Hero Background Preview"
                      width={120}
                      height={80}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                      }}
                      onLoad={() => {
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon className="h-6 w-6 mb-1" />
                      <span className="text-xs">Hero Background Preview</span>
                    </div>
                  )}
                  {settings.heroBackgroundImage && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 hover:opacity-100 transition-opacity duration-200 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                        Click to preview
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    id="hero-background-image"
                    accept=".png,.jpg,.jpeg,.gif,.webp"
                    onChange={handleHeroImageUpload}
                    className="hidden"
                    disabled={isUploadingHeroImage}
                  />
                  <Label
                    htmlFor="hero-background-image"
                    className={cn(
                      "cursor-pointer inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors",
                      isUploadingHeroImage && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Upload className="h-4 w-4" />
                    <span>{isUploadingHeroImage ? "Uploading..." : "Upload Hero Image"}</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: 1920x600px or larger. Supports PNG, JPG, GIF, and WebP files (max 10MB)
                  </p>
                  {settings.heroBackgroundImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSettings(prev => ({ ...prev, heroBackgroundImage: "" }))}
                      className="mt-2"
                    >
                      Remove Image
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Hero Tagline Alignment */}
            <div className="space-y-2">
              <Label htmlFor="hero-tagline-alignment">Hero Tagline Alignment</Label>
              <Select 
                value={settings.heroTaglineAlignment} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, heroTaglineAlignment: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how the hero section content (headline, search bar, etc.) should be aligned
              </p>
            </div>

            {/* Service Images - Multiple Images Support */}
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold">Service Images</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload multiple images or videos for each service card. Images will automatically rotate on the landing page.
                </p>
              </div>
              
              {/* Image Rotation Time Setting */}
              <div className="space-y-2">
                <Label htmlFor="rotation-time">Image Rotation Time (seconds)</Label>
                <Input
                  id="rotation-time"
                  type="number"
                  min="3"
                  max="30"
                  value={settings.serviceImageRotationTime}
                  onChange={(e) => setSettings(prev => ({ ...prev, serviceImageRotationTime: parseInt(e.target.value) || 5 }))}
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">
                  How long each image displays before rotating to the next (3-30 seconds)
                </p>
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 gap-8">
                <MultiImageUpload
                  label="Retail & Online Sales"
                  currentImages={settings.serviceRetailImages}
                  onImagesChange={async (images) => {
                    setSettings(prev => ({ ...prev, serviceRetailImages: images }))
                    try {
                      await updateSettings({ serviceRetailImages: images })
                      toast({
                        title: "Images saved",
                        description: "Retail & Online Sales images updated.",
                      })
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save images.",
                        variant: "destructive"
                      })
                    }
                  }}
                  serviceId="retail-sales"
                />

                <Separator />

                <MultiImageUpload
                  label="Project Prototyping"
                  currentImages={settings.servicePrototypingImages}
                  onImagesChange={async (images) => {
                    setSettings(prev => ({ ...prev, servicePrototypingImages: images }))
                    try {
                      await updateSettings({ servicePrototypingImages: images })
                      toast({
                        title: "Images saved",
                        description: "Project Prototyping images updated.",
                      })
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save images.",
                        variant: "destructive"
                      })
                    }
                  }}
                  serviceId="project-prototyping"
                />

                <Separator />

                <MultiImageUpload
                  label="PCB Printing"
                  currentImages={settings.servicePcbImages}
                  onImagesChange={async (images) => {
                    setSettings(prev => ({ ...prev, servicePcbImages: images }))
                    try {
                      await updateSettings({ servicePcbImages: images })
                      toast({
                        title: "Images saved",
                        description: "PCB Printing images updated.",
                      })
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save images.",
                        variant: "destructive"
                      })
                    }
                  }}
                  serviceId="pcb-printing"
                />

                <Separator />

                <MultiImageUpload
                  label="AI Consultancy"
                  currentImages={settings.serviceAiImages}
                  onImagesChange={async (images) => {
                    setSettings(prev => ({ ...prev, serviceAiImages: images }))
                    try {
                      await updateSettings({ serviceAiImages: images })
                      toast({
                        title: "Images saved",
                        description: "AI Consultancy images updated.",
                      })
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save images.",
                        variant: "destructive"
                      })
                    }
                  }}
                  serviceId="ai-consultancy"
                />

                <Separator />

                <MultiImageUpload
                  label="STEM Training Kits"
                  currentImages={settings.serviceStemImages}
                  onImagesChange={async (images) => {
                    setSettings(prev => ({ ...prev, serviceStemImages: images }))
                    try {
                      await updateSettings({ serviceStemImages: images })
                      toast({
                        title: "Images saved",
                        description: "STEM Training Kits images updated.",
                      })
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save images.",
                        variant: "destructive"
                      })
                    }
                  }}
                  serviceId="stem-training-kits"
                />

                <Separator />

                <MultiImageUpload
                  label="Home Devices"
                  currentImages={settings.serviceHomeImages}
                  onImagesChange={async (images) => {
                    setSettings(prev => ({ ...prev, serviceHomeImages: images }))
                    try {
                      await updateSettings({ serviceHomeImages: images })
                      toast({
                        title: "Images saved",
                        description: "Home Devices images updated.",
                      })
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save images.",
                        variant: "destructive"
                      })
                    }
                  }}
                  serviceId="home-devices"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                value={settings.websiteUrl}
                onChange={(e) => setSettings(prev => ({ ...prev, websiteUrl: e.target.value }))}
                placeholder="https://your-website.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="contact@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">Contact Phone</Label>
              <Input
                id="contact-phone"
                value={settings.contactPhone}
                onChange={(e) => setSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="+255 123 456 789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={settings.address}
                onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter company address"
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleUpdateCompanyName}
                disabled={isUpdating}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Name</span>
              </Button>
              <Button
                onClick={handleUpdateCompanyColor}
                disabled={isUpdating}
                className="flex items-center space-x-2"
              >
                <Palette className="h-4 w-4" />
                <span>Save Color</span>
              </Button>
              <Button
                onClick={handleUpdateCompanyTagline}
                disabled={isUpdating}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Tagline</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleResetCompanyName}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Name</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleResetCompanyColor}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Color</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleResetCompanyTagline}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Tagline</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleResetCompanyLogo}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Logo</span>
              </Button>
              <Button
                onClick={async () => {
                  const success = await updateHeroTaglineAlignment(settings.heroTaglineAlignment)
                  if (success) {
                    toast({
                      title: "Success",
                      description: "Hero tagline alignment updated successfully",
                    })
                  } else {
                    toast({
                      title: "Error",
                      description: "Failed to update hero tagline alignment",
                      variant: "destructive",
                    })
                  }
                }}
                disabled={isUpdating}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Alignment</span>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await resetHeroTaglineAlignment()
                  setSettings(prev => ({ ...prev, heroTaglineAlignment: 'left' }))
                  toast({
                    title: "Success",
                    description: "Hero tagline alignment reset to left",
                  })
                }}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Alignment</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Regional Settings</span>
            </CardTitle>
            <CardDescription>
              Configure regional preferences and localization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={settings.currency} onValueChange={(value) => setSettings(prev => ({ ...prev, currency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TZS">Tanzanian Shilling (TZS)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                  <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={settings.timezone} onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Dar_es_Salaam">Africa/Dar es Salaam</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={settings.language} onValueChange={(value) => setSettings(prev => ({ ...prev, language: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Swahili</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select value={settings.theme} onValueChange={(value) => setSettings(prev => ({ ...prev, theme: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>API Configuration</span>
            </CardTitle>
            <CardDescription>
              Manage API keys and external service integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show API Keys</Label>
              <Switch
                checked={showApiKeys}
                onCheckedChange={setShowApiKeys}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Google Maps API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    type={showApiKeys ? "text" : "password"}
                    value={settings.apiKeys.googleMaps}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      apiKeys: { ...prev.apiKeys, googleMaps: e.target.value }
                    }))}
                    placeholder="Enter Google Maps API key"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(settings.apiKeys.googleMaps, "Google Maps API Key")}
                  >
                    {copiedKey === "Google Maps API Key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>DPO Payment API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    type={showApiKeys ? "text" : "password"}
                    value={settings.apiKeys.dpoPayment}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      apiKeys: { ...prev.apiKeys, dpoPayment: e.target.value }
                    }))}
                    placeholder="Enter DPO API key"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(settings.apiKeys.dpoPayment, "DPO API Key")}
                  >
                    {copiedKey === "DPO API Key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stripe API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    type={showApiKeys ? "text" : "password"}
                    value={settings.apiKeys.stripe}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      apiKeys: { ...prev.apiKeys, stripe: e.target.value }
                    }))}
                    placeholder="Enter Stripe API key"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(settings.apiKeys.stripe, "Stripe API Key")}
                  >
                    {copiedKey === "Stripe API Key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </CardTitle>
            <CardDescription>
              Configure notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch
                checked={settings.notifications.email}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, email: checked }
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
              </div>
              <Switch
                checked={settings.notifications.sms}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, sms: checked }
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive push notifications</p>
              </div>
              <Switch
                checked={settings.notifications.push}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, push: checked }
                }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Security</span>
            </CardTitle>
            <CardDescription>
              Manage security settings and authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Require 2FA for admin access</p>
              </div>
              <Switch
                checked={settings.security.twoFactorAuth}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, twoFactorAuth: checked }
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, sessionTimeout: parseInt(e.target.value) || 30 }
                }))}
                min="5"
                max="480"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-policy">Password Policy</Label>
              <Select 
                value={settings.security.passwordPolicy} 
                onValueChange={(value) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, passwordPolicy: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (6+ characters)</SelectItem>
                  <SelectItem value="strong">Strong (8+ chars, mixed case, numbers)</SelectItem>
                  <SelectItem value="very-strong">Very Strong (12+ chars, special chars)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Performance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Performance</span>
            </CardTitle>
            <CardDescription>
              Optimize application performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Caching</Label>
                <p className="text-sm text-muted-foreground">Cache frequently accessed data</p>
              </div>
              <Switch
                checked={settings.performance.cacheEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  performance: { ...prev.performance, cacheEnabled: checked }
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Image Optimization</Label>
                <p className="text-sm text-muted-foreground">Automatically optimize images</p>
              </div>
              <Switch
                checked={settings.performance.imageOptimization}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  performance: { ...prev.performance, imageOptimization: checked }
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>CDN Enabled</Label>
                <p className="text-sm text-muted-foreground">Use CDN for static assets</p>
              </div>
              <Switch
                checked={settings.performance.cdnEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  performance: { ...prev.performance, cdnEnabled: checked }
                }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Display Settings */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Palette className="h-5 w-5" />
              <span>Product Display Settings</span>
            </CardTitle>
            <CardDescription>
              Configure how products are displayed across different screen sizes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="products-mobile">Products per Row (Mobile)</Label>
                <Input
                  id="products-mobile"
                  type="number"
                  value={settings.productsPerRowMobile}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    productsPerRowMobile: parseInt(e.target.value) || 3
                  }))}
                  min="1"
                  max="6"
                />
    </div>

              <div className="space-y-2">
                <Label htmlFor="products-tablet">Products per Row (Tablet)</Label>
                <Input
                  id="products-tablet"
                  type="number"
                  value={settings.productsPerRowTablet}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    productsPerRowTablet: parseInt(e.target.value) || 4
                  }))}
                  min="1"
                  max="8"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="products-desktop">Products per Row (Desktop)</Label>
                <Input
                  id="products-desktop"
                  type="number"
                  value={settings.productsPerRowDesktop}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    productsPerRowDesktop: parseInt(e.target.value) || 5
                  }))}
                  min="1"
                  max="12"
                />
              </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="card-spacing">Card Spacing (pixels)</Label>
                <Input
                  id="card-spacing"
                  type="number"
                  value={settings.productCardSpacing}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    productCardSpacing: parseInt(e.target.value) || 4
                  }))}
                  min="0"
                  max="20"
                />
          </div>

              <div className="space-y-2">
                <Label htmlFor="card-radius">Card Border Radius</Label>
                <Input
                  id="card-radius"
                  type="number"
                  step="0.1"
                  value={settings.productCardRadius}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    productCardRadius: parseFloat(e.target.value) || 0.5
                  }))}
                  min="0"
                  max="2"
                />
              </div>
            </div>
        </CardContent>
      </Card>
      </div>

      {/* Cart Settings */}
      <div className="mt-6">
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Cart Settings</span>
            </CardTitle>
          <CardDescription>
              Configure shopping cart behavior and appearance
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="cart-compact">Compact Cart Mode</Label>
                <p className="text-sm text-muted-foreground">Reduce spacing between cart items</p>
              </div>
              <Switch
                id="cart-compact"
                checked={settings.cartCompactMode}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  cartCompactMode: checked
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cart-spacing">Cart Item Spacing (pixels)</Label>
              <Input
                id="cart-spacing"
                type="number"
                value={settings.cartItemSpacing}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  cartItemSpacing: parseInt(e.target.value) || 0
                }))}
                min="0"
                max="20"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="clear-cart">Show Clear Cart Button</Label>
                <p className="text-sm text-muted-foreground">Display clear cart button in cart page</p>
              </div>
              <Switch
                id="clear-cart"
                checked={settings.showClearCartButton}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  showClearCartButton: checked
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="save-later">Show Save for Later</Label>
                <p className="text-sm text-muted-foreground">Allow users to save items for later</p>
              </div>
              <Switch
                id="save-later"
                checked={settings.showSaveForLater}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  showSaveForLater: checked
                }))}
              />
            </div>
        </CardContent>
      </Card>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        imageUrl={settings.heroBackgroundImage}
        imageAlt="Hero Background Preview"
        title="Hero Background Image Preview"
      />
    </div>
  )
} 