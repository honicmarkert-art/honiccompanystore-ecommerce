"use client"

import { useState, useEffect } from "react"
import { logger } from '@/lib/logger'

// Default values for all admin settings
const DEFAULT_ADMIN_SETTINGS = {
  // Company Branding
  companyName: "Honic Co.",
  companyColor: "#3B82F6",
  companyTagline: "technology, innovation",
  companyLogo: "/placeholder-logo.png",
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
  websiteUrl: "https://honic-co.com",
  contactEmail: "contact@honic-co.com",
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
  apiKeys: {
    googleMaps: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    dpoPayment: process.env.DPO_PAYMENT_API_KEY || "",
    stripe: process.env.STRIPE_API_KEY || "",
    emailService: process.env.EMAIL_SERVICE_API_KEY || "",
    smsService: process.env.SMS_SERVICE_API_KEY || ""
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
    twitter: "",
    instagram: "",
    linkedin: "",
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
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings({ ...DEFAULT_ADMIN_SETTINGS, ...data })
        } else {
          console.warn('Failed to fetch admin settings, using defaults')
        }
      } catch (error) {
        console.error('Error fetching admin settings:', error)
        console.warn('Using default admin settings')
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
        setSettings(prev => ({ ...prev, [key]: value }))
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to update setting:', key)
        console.error('Error details:', errorData)
        console.error('Status:', response.status)
        
        // Handle missing database columns gracefully
        if (response.status === 400 || response.status === 500) {
          logger.log(`⚠️ ${key} column may not be available in database yet or validation failed.`)
          logger.log(`Error message:`, errorData.error || errorData.details)
          // Still update local state for immediate UI feedback
          setSettings(prev => ({ ...prev, [key]: value }))
          return true
        }
        return false
      }
    } catch (error) {
      console.error('Error updating setting:', error)
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
        console.error('❌ Failed to update settings:', response.status, errorData)
        return false
      }
    } catch (error) {
      console.error('❌ Error updating settings:', error)
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
        console.error('Failed to reset settings')
        return false
      }
    } catch (error) {
      console.error('Error resetting settings:', error)
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
