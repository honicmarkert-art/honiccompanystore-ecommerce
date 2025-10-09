"use client"

import { useState, useEffect } from "react"

const DEFAULT_COMPANY_NAME = "Honic Co."
const DEFAULT_COMPANY_COLOR = "#3B82F6" // Blue-500
const DEFAULT_COMPANY_TAGLINE = "technology, innovation"
const DEFAULT_COMPANY_LOGO = "/placeholder-logo.png"

export function useCompany() {
  const [companyName, setCompanyName] = useState<string>(DEFAULT_COMPANY_NAME)
  const [companyColor, setCompanyColor] = useState<string>(DEFAULT_COMPANY_COLOR)
  const [companyTagline, setCompanyTagline] = useState<string>(DEFAULT_COMPANY_TAGLINE)
  const [companyLogo, setCompanyLogo] = useState<string>(DEFAULT_COMPANY_LOGO)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load company data from database on mount, fallback to localStorage
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const response = await fetch('/api/company/settings')
        if (response.ok) {
          const data = await response.json()
          setCompanyName(data.companyName || DEFAULT_COMPANY_NAME)
          setCompanyColor(data.companyColor || DEFAULT_COMPANY_COLOR)
          setCompanyTagline(data.companyTagline || DEFAULT_COMPANY_TAGLINE)
          setCompanyLogo(data.companyLogo || DEFAULT_COMPANY_LOGO)
        } else {
          // Fallback to localStorage if API fails
          loadFromLocalStorage()
        }
      } catch (error) {
        console.error('Error fetching company settings:', error)
        // Fallback to localStorage if API fails
        loadFromLocalStorage()
      } finally {
        setIsLoaded(true)
      }
    }

    const loadFromLocalStorage = () => {
    if (typeof window !== 'undefined') {
        const storedName = localStorage.getItem('company-name')
        const storedColor = localStorage.getItem('company-color')
        const storedTagline = localStorage.getItem('company-tagline')
        const storedLogo = localStorage.getItem('company-logo')
        
        if (storedName) setCompanyName(storedName)
        if (storedColor) setCompanyColor(storedColor)
        if (storedTagline) setCompanyTagline(storedTagline)
        if (storedLogo) setCompanyLogo(storedLogo)
      }
    }

    fetchCompanySettings()
  }, [])

  // Update company name
  const updateCompanyName = async (newName: string) => {
    if (newName && newName.trim()) {
      const trimmedName = newName.trim()
      try {
        const response = await fetch('/api/company/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: trimmedName,
            companyColor,
            companyTagline,
            companyLogo
          }),
        })
        
        if (response.ok) {
          setCompanyName(trimmedName)
          return true
        } else {
          // Fallback to localStorage if database fails
          setCompanyName(trimmedName)
          if (typeof window !== 'undefined') {
            localStorage.setItem('company-name', trimmedName)
          }
          return true
        }
      } catch (error) {
        console.error('Error updating company name:', error)
        // Fallback to localStorage if database fails
      setCompanyName(trimmedName)
      if (typeof window !== 'undefined') {
          localStorage.setItem('company-name', trimmedName)
        }
        return true
      }
    }
    return false
  }

  // Update company color
  const updateCompanyColor = async (newColor: string) => {
    if (newColor && newColor.trim()) {
      const trimmedColor = newColor.trim()
      try {
        const response = await fetch('/api/company/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName,
            companyColor: trimmedColor,
            companyTagline,
            companyLogo
          }),
        })
        
        if (response.ok) {
          setCompanyColor(trimmedColor)
          return true
        } else {
          // Fallback to localStorage if database fails
          setCompanyColor(trimmedColor)
          if (typeof window !== 'undefined') {
            localStorage.setItem('company-color', trimmedColor)
          }
          return true
        }
      } catch (error) {
        console.error('Error updating company color:', error)
        // Fallback to localStorage if database fails
        setCompanyColor(trimmedColor)
        if (typeof window !== 'undefined') {
          localStorage.setItem('company-color', trimmedColor)
      }
      return true
      }
    }
    return false
  }

  // Reset to default
  const resetCompanyName = async () => {
    try {
      const response = await fetch('/api/company/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: DEFAULT_COMPANY_NAME,
          companyColor,
          companyTagline,
          companyLogo
        }),
      })
      
      if (response.ok) {
        setCompanyName(DEFAULT_COMPANY_NAME)
      } else {
        // Fallback to localStorage if database fails
        setCompanyName(DEFAULT_COMPANY_NAME)
        if (typeof window !== 'undefined') {
          localStorage.setItem('company-name', DEFAULT_COMPANY_NAME)
        }
      }
    } catch (error) {
      console.error('Error resetting company name:', error)
      // Fallback to localStorage if database fails
    setCompanyName(DEFAULT_COMPANY_NAME)
    if (typeof window !== 'undefined') {
        localStorage.setItem('company-name', DEFAULT_COMPANY_NAME)
      }
    }
  }

  const resetCompanyColor = async () => {
    try {
      const response = await fetch('/api/company/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companyColor: DEFAULT_COMPANY_COLOR,
          companyTagline,
          companyLogo
        }),
      })
      
      if (response.ok) {
        setCompanyColor(DEFAULT_COMPANY_COLOR)
      } else {
        // Fallback to localStorage if database fails
        setCompanyColor(DEFAULT_COMPANY_COLOR)
        if (typeof window !== 'undefined') {
          localStorage.setItem('company-color', DEFAULT_COMPANY_COLOR)
        }
      }
    } catch (error) {
      console.error('Error resetting company color:', error)
      // Fallback to localStorage if database fails
      setCompanyColor(DEFAULT_COMPANY_COLOR)
      if (typeof window !== 'undefined') {
        localStorage.setItem('company-color', DEFAULT_COMPANY_COLOR)
      }
    }
  }


  // Update company logo
  const updateCompanyLogo = async (newLogo: string) => {
    if (newLogo && newLogo.trim()) {
      const trimmedLogo = newLogo.trim()
      try {
        const response = await fetch('/api/company/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName,
            companyColor,
            companyTagline,
            companyLogo: trimmedLogo
          }),
        })
        
        if (response.ok) {
          setCompanyLogo(trimmedLogo)
          return true
        } else {
          // Fallback to localStorage if database fails
          setCompanyLogo(trimmedLogo)
          if (typeof window !== 'undefined') {
            localStorage.setItem('company-logo', trimmedLogo)
          }
          return true
        }
      } catch (error) {
        console.error('Error updating company logo:', error)
        // Fallback to localStorage if database fails
        setCompanyLogo(trimmedLogo)
        if (typeof window !== 'undefined') {
          localStorage.setItem('company-logo', trimmedLogo)
        }
        return true
      }
    }
    return false
  }

  const resetCompanyLogo = async () => {
    try {
      const response = await fetch('/api/company/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companyColor,
          companyTagline,
          companyLogo: DEFAULT_COMPANY_LOGO
        }),
      })
      
      if (response.ok) {
        setCompanyLogo(DEFAULT_COMPANY_LOGO)
      } else {
        // Fallback to localStorage if database fails
        setCompanyLogo(DEFAULT_COMPANY_LOGO)
        if (typeof window !== 'undefined') {
          localStorage.setItem('company-logo', DEFAULT_COMPANY_LOGO)
        }
      }
    } catch (error) {
      console.error('Error resetting company logo:', error)
      // Fallback to localStorage if database fails
      setCompanyLogo(DEFAULT_COMPANY_LOGO)
      if (typeof window !== 'undefined') {
        localStorage.setItem('company-logo', DEFAULT_COMPANY_LOGO)
      }
    }
  }

  return {
    companyName,
    companyColor,
    companyTagline,
    companyLogo,
    updateCompanyName,
    updateCompanyColor,
    updateCompanyLogo,
    resetCompanyName,
    resetCompanyColor,
    resetCompanyLogo,
    isLoaded
  }
} 