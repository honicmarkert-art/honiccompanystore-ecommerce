"use client"

import { createContext, useContext, ReactNode } from "react"
import { useCompanyContext } from "@/components/company-provider"

interface PublicCompanyContextType {
  companyName: string
  companyColor: string
  companyLogo: string
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
  // Contact info
  websiteUrl: string
  contactEmail: string
  contactPhone: string
  address: string
  // Localization
  currency: string
  timezone: string
  language: string
  // Theme
  theme: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  isLoaded: boolean
}

const PublicCompanyContext = createContext<PublicCompanyContextType | undefined>(undefined)

export function PublicCompanyProvider({ children }: { children: ReactNode }) {
  const ctx = useCompanyContext()

  const value: PublicCompanyContextType = {
    companyName: ctx.companyName,
    companyColor: ctx.companyColor,
    companyLogo: ctx.companyLogo,
    mainHeadline: ctx.mainHeadline,
    heroBackgroundImage: ctx.heroBackgroundImage,
    serviceRetailImages: ctx.serviceRetailImages,
    servicePrototypingImages: ctx.servicePrototypingImages,
    servicePcbImages: ctx.servicePcbImages,
    serviceAiImages: ctx.serviceAiImages,
    serviceStemImages: ctx.serviceStemImages,
    serviceHomeImages: ctx.serviceHomeImages,
    serviceImageRotationTime: ctx.serviceImageRotationTime,
    serviceRetailImage: ctx.serviceRetailImage,
    servicePrototypingImage: ctx.servicePrototypingImage,
    servicePcbImage: ctx.servicePcbImage,
    serviceAiImage: ctx.serviceAiImage,
    serviceStemImage: ctx.serviceStemImage,
    websiteUrl: ctx.websiteUrl,
    contactEmail: ctx.contactEmail,
    contactPhone: ctx.contactPhone,
    address: ctx.address,
    currency: ctx.currency,
    timezone: ctx.timezone,
    language: ctx.language,
    theme: ctx.theme,
    primaryColor: ctx.primaryColor,
    secondaryColor: ctx.secondaryColor,
    accentColor: ctx.accentColor,
    isLoaded: ctx.isLoaded,
  }

  return (
    <PublicCompanyContext.Provider value={value}>
      {children}
    </PublicCompanyContext.Provider>
  )
}

export function usePublicCompanyContext() {
  const context = useContext(PublicCompanyContext)
  if (context === undefined) {
    throw new Error("usePublicCompanyContext must be used within a PublicCompanyProvider")
  }
  return context
}
