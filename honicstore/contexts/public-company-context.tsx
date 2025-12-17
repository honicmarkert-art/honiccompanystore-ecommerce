"use client"

import { createContext, useContext, ReactNode, useEffect, useState } from "react"

interface PublicCompanyContextType {
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
  const [settings, setSettings] = useState<PublicCompanyContextType>({
    companyName: 'Honic Co',
    companyColor: '#3B82F6',
    companyLogo: '/android-chrome-512x512.png',
    mainHeadline: 'Welcome to Our Store',
    heroBackgroundImage: '',
    heroTaglineAlignment: 'center',
    serviceRetailImages: [],
    servicePrototypingImages: [],
    servicePcbImages: [],
    serviceAiImages: [],
    serviceStemImages: [],
    serviceHomeImages: [],
    serviceImageRotationTime: 10,
    // Legacy single image support
    serviceRetailImage: '',
    servicePrototypingImage: '',
    servicePcbImage: '',
    serviceAiImage: '',
    serviceStemImage: '',
    // Contact info
    websiteUrl: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    // Localization
    currency: 'TZS',
    timezone: 'Africa/Dar_es_Salaam',
    language: 'en',
    // Theme
    theme: 'light',
    primaryColor: '#3B82F6',
    secondaryColor: '#64748B',
    accentColor: '#F59E0B',
    isLoaded: false
  })

  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const response = await fetch(`/api/company/settings?cb=${Date.now()}`)
        if (response.ok) {
          const data = await response.json()
          setSettings({ ...data, isLoaded: true })
        } else {
          // Use defaults if API fails
          setSettings(prev => ({ ...prev, isLoaded: true }))
        }
      } catch (error) {
        // Use defaults if API fails
        setSettings(prev => ({ ...prev, isLoaded: true }))
      }
    }

    fetchPublicSettings()
  }, [])

  return (
    <PublicCompanyContext.Provider value={settings}>
      {children}
    </PublicCompanyContext.Provider>
  )
}

export function usePublicCompanyContext() {
  const context = useContext(PublicCompanyContext)
  if (context === undefined) {
    throw new Error('usePublicCompanyContext must be used within a PublicCompanyProvider')
  }
  return context
}
