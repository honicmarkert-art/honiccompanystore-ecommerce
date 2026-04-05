"use client"

import { createContext, useContext, ReactNode } from "react"
import { useCompanySettings } from "@/hooks/use-company-settings"

interface CompanyContextType {
  companyName: string
  companyColor: string
  companyLogo: string
  companyTagline: string
  mainHeadline: string
  heroBackgroundImage: string
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
  websiteUrl: string
  contactEmail: string
  contactPhone: string
  address: string
  currency: string
  timezone: string
  language: string
  theme: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  updateCompanyName: (name: string) => Promise<boolean>
  updateCompanyColor: (color: string) => Promise<boolean>
  updateCompanyLogo: (logo: string) => Promise<boolean>
  updateMainHeadline: (headline: string) => Promise<boolean>
  updateHeroBackgroundImage: (image: string) => Promise<boolean>
  resetCompanyName: () => Promise<void>
  resetCompanyColor: () => Promise<void>
  resetCompanyLogo: () => Promise<void>
  resetMainHeadline: () => Promise<void>
  resetHeroBackgroundImage: () => Promise<void>
  isLoaded: boolean
  // Additional admin settings
  settings: any
  updateSetting: (key: string, value: any) => Promise<boolean>
  updateSettings: (updates: Record<string, any>) => Promise<boolean>
  resetSettings: () => Promise<boolean>
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const companySettings = useCompanySettings()
  
  // Create wrapper functions for backward compatibility
  const updateCompanyName = async (name: string) => {
    return await companySettings.updateSetting('companyName', name)
  }

  const updateCompanyColor = async (color: string) => {
    return await companySettings.updateSetting('companyColor', color)
  }

  const updateCompanyLogo = async (logo: string) => {
    return await companySettings.updateSetting('companyLogo', logo)
  }

  const updateMainHeadline = async (headline: string) => {
    return await companySettings.updateSetting('mainHeadline', headline)
  }

  const updateHeroBackgroundImage = async (image: string) => {
    return await companySettings.updateSetting('heroBackgroundImage', image)
  }

  const resetCompanyName = async () => {
    await companySettings.updateSetting('companyName', 'Honic')
  }

  const resetCompanyColor = async () => {
    await companySettings.updateSetting('companyColor', '#3B82F6')
  }

  const resetCompanyLogo = async () => {
    await companySettings.updateSetting('companyLogo', '/android-chrome-512x512.png')
  }

  const resetMainHeadline = async () => {
    await companySettings.updateSetting('mainHeadline', 'The leading B2B ecommerce platform for global trade')
  }

  const resetHeroBackgroundImage = async () => {
    await companySettings.updateSetting('heroBackgroundImage', '')
  }

  const companyContextValue = {
    companyName: companySettings.companyName,
    companyColor: companySettings.companyColor,
    companyLogo: companySettings.companyLogo,
    companyTagline: companySettings.companyTagline || "",
    mainHeadline: companySettings.mainHeadline,
    heroBackgroundImage: companySettings.heroBackgroundImage,
    serviceRetailImages: companySettings?.serviceRetailImages || [],
    servicePrototypingImages: companySettings?.servicePrototypingImages || [],
    servicePcbImages: companySettings?.servicePcbImages || [],
    serviceAiImages: companySettings?.serviceAiImages || [],
    serviceStemImages: companySettings?.serviceStemImages || [],
    serviceHomeImages: companySettings?.serviceHomeImages || [],
    serviceImageRotationTime: companySettings?.serviceImageRotationTime || 5,
    // Legacy single image support
    serviceRetailImage: companySettings?.serviceRetailImage || "",
    servicePrototypingImage: companySettings?.servicePrototypingImage || "",
    servicePcbImage: companySettings?.servicePcbImage || "",
    serviceAiImage: companySettings?.serviceAiImage || "",
    serviceStemImage: companySettings?.serviceStemImage || "",
    websiteUrl: companySettings.websiteUrl,
    contactEmail: companySettings.contactEmail,
    contactPhone: companySettings.contactPhone,
    address: companySettings.address,
    currency: companySettings.currency,
    timezone: companySettings.timezone,
    language: companySettings.language,
    theme: companySettings.theme,
    primaryColor: companySettings.primaryColor,
    secondaryColor: companySettings.secondaryColor,
    accentColor: companySettings.accentColor,
    updateCompanyName,
    updateCompanyColor,
    updateCompanyLogo,
    updateMainHeadline,
    updateHeroBackgroundImage,
    resetCompanyName,
    resetCompanyColor,
    resetCompanyLogo,
    resetMainHeadline,
    resetHeroBackgroundImage,
    isLoaded: companySettings.isLoaded,
    settings: companySettings.settings,
    updateSetting: companySettings.updateSetting,
    updateSettings: companySettings.updateSettings,
    resetSettings: companySettings.resetSettings
  }

  return (
    <CompanyContext.Provider value={companyContextValue}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompanyContext() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error("useCompanyContext must be used within a CompanyProvider")
  }
  return context
} 