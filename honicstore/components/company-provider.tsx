"use client"

import { createContext, useContext, ReactNode, useEffect } from "react"
import { useAdminSettings } from "@/hooks/use-admin-settings"

interface CompanyContextType {
  companyName: string
  companyColor: string
  companyLogo: string
  mainHeadline: string
  heroBackgroundImage: string
  heroTaglineAlignment: string
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
  updateCompanyName: (name: string) => Promise<boolean>
  updateCompanyColor: (color: string) => Promise<boolean>
  updateCompanyLogo: (logo: string) => Promise<boolean>
  updateMainHeadline: (headline: string) => Promise<boolean>
  updateHeroBackgroundImage: (image: string) => Promise<boolean>
  updateHeroTaglineAlignment: (alignment: string) => Promise<boolean>
  resetCompanyName: () => Promise<void>
  resetCompanyColor: () => Promise<void>
  resetCompanyLogo: () => Promise<void>
  resetMainHeadline: () => Promise<void>
  resetHeroBackgroundImage: () => Promise<void>
  resetHeroTaglineAlignment: () => Promise<void>
  isLoaded: boolean
  // Additional admin settings
  settings: any
  updateSetting: (key: string, value: any) => Promise<boolean>
  updateSettings: (updates: Record<string, any>) => Promise<boolean>
  resetSettings: () => Promise<boolean>
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const adminSettings = useAdminSettings()
  
  // Debug logging for hero background image and service images (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    }
  }, [adminSettings.isLoaded])

  // Create wrapper functions for backward compatibility
  const updateCompanyName = async (name: string) => {
    return await adminSettings.updateSetting('companyName', name)
  }

  const updateCompanyColor = async (color: string) => {
    return await adminSettings.updateSetting('companyColor', color)
  }


  const updateCompanyLogo = async (logo: string) => {
    return await adminSettings.updateSetting('companyLogo', logo)
  }

  const updateMainHeadline = async (headline: string) => {
    return await adminSettings.updateSetting('mainHeadline', headline)
  }

  const updateHeroBackgroundImage = async (image: string) => {
    return await adminSettings.updateSetting('heroBackgroundImage', image)
  }

  const updateHeroTaglineAlignment = async (alignment: string) => {
    return await adminSettings.updateSetting('heroTaglineAlignment', alignment)
  }

  const resetCompanyName = async () => {
    await adminSettings.updateSetting('companyName', 'Honic Co.')
  }

  const resetCompanyColor = async () => {
    await adminSettings.updateSetting('companyColor', '#3B82F6')
  }


  const resetCompanyLogo = async () => {
    await adminSettings.updateSetting('companyLogo', '/android-chrome-512x512.png')
  }

  const resetMainHeadline = async () => {
    await adminSettings.updateSetting('mainHeadline', 'The leading B2B ecommerce platform for global trade')
  }

  const resetHeroBackgroundImage = async () => {
    await adminSettings.updateSetting('heroBackgroundImage', '')
  }

  const resetHeroTaglineAlignment = async () => {
    await adminSettings.updateSetting('heroTaglineAlignment', 'left')
  }

  const companyContextValue = {
    companyName: adminSettings.companyName,
    companyColor: adminSettings.companyColor,
    companyLogo: adminSettings.companyLogo,
    mainHeadline: adminSettings.mainHeadline,
    heroBackgroundImage: adminSettings.heroBackgroundImage,
    heroTaglineAlignment: adminSettings.heroTaglineAlignment,
    serviceRetailImages: adminSettings?.serviceRetailImages || [],
    servicePrototypingImages: adminSettings?.servicePrototypingImages || [],
    servicePcbImages: adminSettings?.servicePcbImages || [],
    serviceAiImages: adminSettings?.serviceAiImages || [],
    serviceStemImages: adminSettings?.serviceStemImages || [],
    serviceHomeImages: adminSettings?.serviceHomeImages || [],
    serviceImageRotationTime: adminSettings?.serviceImageRotationTime || 5,
    // Legacy single image support
    serviceRetailImage: adminSettings?.serviceRetailImage || "",
    servicePrototypingImage: adminSettings?.servicePrototypingImage || "",
    servicePcbImage: adminSettings?.servicePcbImage || "",
    serviceAiImage: adminSettings?.serviceAiImage || "",
    serviceStemImage: adminSettings?.serviceStemImage || "",
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
    isLoaded: adminSettings.isLoaded,
    settings: adminSettings.settings,
    updateSetting: adminSettings.updateSetting,
    updateSettings: adminSettings.updateSettings,
    resetSettings: adminSettings.resetSettings
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