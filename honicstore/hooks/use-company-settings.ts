"use client"

import { useState, useEffect } from "react"

// Default values for company settings
const DEFAULT_COMPANY_SETTINGS = {
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
}

export function useCompanySettings() {
  const [settings, setSettings] = useState(DEFAULT_COMPANY_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(true) // Always loaded since we use defaults

  // Update a specific setting (local only, no API)
  const updateSetting = async (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    return true
  }

  // Update multiple settings at once (local only, no API)
  const updateSettings = async (updates: Record<string, any>) => {
    setSettings(prev => ({ ...prev, ...updates }))
    return true
  }

  // Reset all settings to defaults
  const resetSettings = async () => {
    setSettings(DEFAULT_COMPANY_SETTINGS)
    return true
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
    theme: "system",
    productsPerRowMobile: 3,
    productCardSpacing: 4,
    productCardRadius: 0.5,
    cartCompactMode: true,
    cartItemSpacing: 0,
    mobileNavHeight: "h-4",
    mobileFontSize: "text-xs",
    mobileCategoryIconsSmall: true,
    mobileFooterColumns: 3,
    footerTheme: "dark",
    footerColumns: 5,
    navTranslucent: true,
    navOpacity: 0.95,
    navTheme: "auto"
  }
}
