"use client"

import { useState, useEffect } from "react"
import { logger } from '@/lib/logger'

// Default values for all admin settings
const DEFAULT_ADMIN_SETTINGS = {
  // Company Branding
  companyName: "Honic",
  companyColor: "#3B82F6",
  companyTagline: "technology, innovation",
  companyLogo: "/android-chrome-512x512.png",
  mainHeadline: "The leading B2B ecommerce platform for global trade",
  heroBackgroundImage: "",
  heroTaglineAlignment: "left",
  
  // Service Images (Multiple images support)
  serviceRetailImages: [],
  servicePrototypingImages: [],
  servicePcbImages: [],
  serviceAiImages: [],
  serviceStemImages: [],
  serviceHomeImages: [],
  serviceImageRotationTime: 5,
  // Legacy single image support
  serviceRetailImage: "",
  servicePrototypingImage: "",
  servicePcbImage: "",
  serviceAiImage: "",
  serviceStemImage: "",
  
  // Contact Information
  websiteUrl: process.env.NEXT_PUBLIC_WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://honic-co.com",
  contactEmail: process.env.CONTACT_EMAIL || "contact@honic-co.com",
  contactPhone: "+255 123 456 789",
  address: "Dar es Salaam, Tanzania",
  
  // Localization
  currency: "TZS",
  timezone: "Africa/Dar_es_Salaam",
  language: "en",
  
  // Theme Settings
  theme: "system",
  primaryColor: "#3B82F6",
  secondaryColor: "#6B7280",
  accentColor: "#F59E0B",
  
  // Navigation Settings
  navTranslucent: true,
  navOpacity: 0.95,
  navTheme: "auto",
  
  // Footer Settings
  footerTheme: "dark",
  footerColumns: 5,
  
  // Product Display Settings
  productsPerRowMobile: 3,
  productsPerRowTablet: 4,
  productsPerRowDesktop: 5,
  productCardSpacing: 4,
  productCardRadius: 0.5,
  
  // Cart Settings
  cartCompactMode: true,
  cartItemSpacing: 0,
  showClearCartButton: false,
  showSaveForLater: true,
  
  // Mobile Settings
  mobileNavHeight: "h-4",
  mobileFontSize: "text-xs",
  mobileCategoryIconsSmall: true,
  mobileFooterColumns: 3,
  
  // Notification Settings
  notifications: {
    email: true,
    sms: false,
    push: true,
    orderUpdates: true,
    promotional: false,
    securityAlerts: true
  },
  
  // API Keys and External Services (stored in environment variables)
  // SECURITY: Only public keys are exposed. Server-side keys are never exposed to client.
  apiKeys: {
    googleMaps: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    // Server-side API keys (DPO, Stripe, Email, SMS) are NOT exposed to client
    // These should only be accessed via server-side API routes with proper authentication
    dpoPayment: "", // Server-side only - never expose to client
    stripe: "", // Server-side only - never expose to client
    emailService: "", // Server-side only - never expose to client
    smsService: "" // Server-side only - never expose to client
  },
  
  // Security Settings
  security: {
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordPolicy: "strong",
    loginAttempts: 5,
    lockoutDuration: 15
  },
  
  // Performance Settings
  performance: {
    cacheEnabled: true,
    imageOptimization: true,
    cdnEnabled: false,
    lazyLoading: true,
    preloadCritical: true
  },
  
  // SEO Settings
  seo: {
    metaTitle: "Honic Co. - Technology & Innovation",
    metaDescription: "Your trusted source for technology and innovation",
    metaKeywords: "technology, innovation, electronics, arduino",
    ogImage: "/og-image.png",
    favicon: "/favicon.ico"
  },
  
  // Social Media Links
  socialLinks: {
    facebook: "",
    instagram: "",
    youtube: ""
  },
  
  // Payment Settings
  paymentSettings: {
    defaultCurrency: "TZS",
    supportedCurrencies: ["TZS", "USD", "EUR"],
    paymentMethods: ["card", "mobile_money", "bank_transfer"],
    shippingCost: 5000
  },
  
  // Business Hours
  businessHours: {
    monday: { open: "09:00", close: "18:00", closed: false },
    tuesday: { open: "09:00", close: "18:00", closed: false },
    wednesday: { open: "09:00", close: "18:00", closed: false },
    thursday: { open: "09:00", close: "18:00", closed: false },
    friday: { open: "09:00", close: "18:00", closed: false },
    saturday: { open: "09:00", close: "16:00", closed: false },
    sunday: { open: "10:00", close: "14:00", closed: false }
  }
}

export function useAdminSettings() {
  const [settings, setSettings] = useState(DEFAULT_ADMIN_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load admin settings from database on mount
  useEffect(() => {
    const fetchAdminSettings = async () => {
      try {
        const response = await fetch(`/api/admin/settings?cb=${Date.now()}`)
        if (response.ok) {
          const data = await response.json()
          setSettings({ ...DEFAULT_ADMIN_SETTINGS, ...data })
        } else if (response.status === 403) {
          // User is not an admin - silently use defaults (this is expected for non-admin users)
          // Don't log warnings for 403 as it's normal behavior
        } else if (response.status === 401) {
          // User is not authenticated - silently use defaults
        } else {
          // Other errors (500, etc.) - log warning
          }
      } catch (error) {
        // Network errors - only log in development
        if (process.env.NODE_ENV === 'development') {
          }
      } finally {
        setIsLoaded(true)
      }
    }

    fetchAdminSettings()
  }, [])

  // Update a specific setting
  const updateSetting = async (key: string, value: any) => {
    try {

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [key]: value
        }),
      })

      if (response.ok) {
        const responseData = await response.json()
        
        // Use the returned value from API if available (for verification)
        const apiReturnedValue = responseData.heroBackgroundImage || responseData[key]
        if (apiReturnedValue && apiReturnedValue !== value) {
        }
        
        // Cache-bust for image-like settings
        const isImageKey = key === 'heroBackgroundImage' || key.endsWith('Image') || key.endsWith('Images')
        const nextValue = ((): any => {
          if (typeof value === 'string' && isImageKey) {
            const sep = value.includes('?') ? '&' : '?'
            const cacheBustedValue = `${value}${sep}v=${Date.now()}`
            return cacheBustedValue
          }
          return value
        })()
        
        setSettings(prev => ({ ...prev, [key]: nextValue }))
        try { 
          localStorage.setItem('settings_cache_bust', String(Date.now()))
        } catch {}
        
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        
        // Handle missing database columns gracefully
        if (response.status === 400 || response.status === 500) {
          logger.log(`⚠️ ${key} column may not be available in database yet or validation failed.`)
          logger.log(`Error message:`, errorData.error || errorData.details)
          // Still update local state for immediate UI feedback with cache-bust
          const isImageKey = key === 'heroBackgroundImage' || key.endsWith('Image') || key.endsWith('Images')
          const nextValue = ((): any => {
            if (typeof value === 'string' && isImageKey) {
              const sep = value.includes('?') ? '&' : '?'
              const cacheBustedValue = `${value}${sep}v=${Date.now()}`
              return cacheBustedValue
            }
            return value
          })()
          setSettings(prev => ({ ...prev, [key]: nextValue }))
          try { 
            localStorage.setItem('settings_cache_bust', String(Date.now()))
          } catch {}
          return true
        }
        return false
      }
    } catch (error) {
      return false
    }
  }

  // Update multiple settings at once
  const updateSettings = async (updates: Record<string, any>) => {
    try {
      // Clean the data before sending
      const cleanedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => {
          // Remove undefined and null values
          if (value === undefined || value === null) {
            logger.log(`⚠️ Removing ${key} with value:`, value)
            return false
          }
          return true
        })
      )
      
      logger.log('📤 Sending settings update:', cleanedUpdates)
      
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanedUpdates),
      })
      
      if (response.ok) {
        setSettings(prev => ({ ...prev, ...updates }))
        logger.log('✅ Settings updated successfully')
        return true
      } else {
        const errorData = await response.json()
        return false
      }
    } catch (error) {
      return false
    }
  }

  // Reset all settings to defaults
  const resetSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(DEFAULT_ADMIN_SETTINGS),
      })
      
      if (response.ok) {
        setSettings(DEFAULT_ADMIN_SETTINGS)
        return true
      } else {
        return false
      }
    } catch (error) {
      return false
    }
  }

  return {
    settings,
    isLoaded,
    updateSetting,
    updateSettings,
    resetSettings,
    // Convenience getters for commonly used settings
    companyName: settings.companyName,
    companyColor: settings.companyColor,
    companyTagline: settings.companyTagline,
    companyLogo: settings.companyLogo,
    mainHeadline: settings.mainHeadline,
    heroBackgroundImage: settings.heroBackgroundImage,
    heroTaglineAlignment: settings.heroTaglineAlignment,
    serviceRetailImages: settings.serviceRetailImages || [],
    servicePrototypingImages: settings.servicePrototypingImages || [],
    servicePcbImages: settings.servicePcbImages || [],
    serviceAiImages: settings.serviceAiImages || [],
    serviceStemImages: settings.serviceStemImages || [],
    serviceHomeImages: settings.serviceHomeImages || [],
    serviceImageRotationTime: settings.serviceImageRotationTime || 5,
    // Legacy single image support
    serviceRetailImage: settings.serviceRetailImage,
    servicePrototypingImage: settings.servicePrototypingImage,
    servicePcbImage: settings.servicePcbImage,
    serviceAiImage: settings.serviceAiImage,
    serviceStemImage: settings.serviceStemImage,
    theme: settings.theme,
    productsPerRowMobile: settings.productsPerRowMobile,
    productCardSpacing: settings.productCardSpacing,
    productCardRadius: settings.productCardRadius,
    cartCompactMode: settings.cartCompactMode,
    cartItemSpacing: settings.cartItemSpacing,
    mobileNavHeight: settings.mobileNavHeight,
    mobileFontSize: settings.mobileFontSize,
    mobileCategoryIconsSmall: settings.mobileCategoryIconsSmall,
    mobileFooterColumns: settings.mobileFooterColumns,
    footerTheme: settings.footerTheme,
    footerColumns: settings.footerColumns,
    navTranslucent: settings.navTranslucent,
    navOpacity: settings.navOpacity,
    navTheme: settings.navTheme
  }
}
