"use client"

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react"

type BackgroundColor = "white" | "gray" | "dark"

interface ThemeClasses {
  mainBg: string
  mainText: string
  cardBg: string
  cardBorder: string
  checkboxCheckedBg: string
  checkboxCheckedText: string
  sliderTrack: string
  textNeutralSecondary: string
  borderNeutralSecondary: string
  buttonGhostHoverBg: string
}

interface HeaderFooterClasses {
  headerBg: string
  headerBorder: string
  footerBg: string
  footerBorder: string
  dialogSheetBg: string
  dialogSheetBorder: string
  inputBg: string
  inputBorder: string
  inputPlaceholder: string
  buttonGhostHoverBg: string
  buttonGhostText: string
  dropdownItemHoverBg: string
  dropdownSeparator: string
  textNeutralPrimary: string
  textNeutralSecondaryFixed: string
}

interface ThemeContextType {
  backgroundColor: BackgroundColor
  setBackgroundColor: (color: BackgroundColor) => void
  themeClasses: ThemeClasses
  darkHeaderFooterClasses: HeaderFooterClasses
  isLoaded: boolean
}

// Theme-aware classes for header and footer
const getHeaderFooterClasses = (backgroundColor: BackgroundColor): HeaderFooterClasses => {
  switch (backgroundColor) {
    case "white":
      return {
        headerBg: "bg-stone-200/60 backdrop-blur-sm",
        headerBorder: "border-stone-300",
        footerBg: "bg-white",
        footerBorder: "border-neutral-200",
        dialogSheetBg: "bg-white",
        dialogSheetBorder: "border-neutral-200",
        inputBg: "bg-neutral-50",
        inputBorder: "border-neutral-300",
        inputPlaceholder: "placeholder:text-neutral-500",
        buttonGhostHoverBg: "hover:bg-neutral-100",
        buttonGhostText: "text-neutral-900",
        dropdownItemHoverBg: "hover:bg-neutral-100",
        dropdownSeparator: "bg-neutral-200",
        textNeutralPrimary: "text-neutral-900",
        textNeutralSecondaryFixed: "text-neutral-600",
      }
    case "gray":
      return {
        headerBg: "bg-slate-700/60 backdrop-blur-sm",
        headerBorder: "border-slate-600",
        footerBg: "bg-gray-800",
        footerBorder: "border-gray-700",
        dialogSheetBg: "bg-gray-900",
        dialogSheetBorder: "border-gray-700",
        inputBg: "bg-gray-700",
        inputBorder: "border-gray-600",
        inputPlaceholder: "placeholder:text-gray-400",
        buttonGhostHoverBg: "hover:bg-gray-700",
        buttonGhostText: "text-white",
        dropdownItemHoverBg: "hover:bg-gray-700",
        dropdownSeparator: "bg-gray-600",
        textNeutralPrimary: "text-white",
        textNeutralSecondaryFixed: "text-gray-400",
      }
    case "dark":
      return {
        headerBg: "bg-black/50 backdrop-blur-sm",
        headerBorder: "border-gray-800",
        footerBg: "bg-neutral-900",
        footerBorder: "border-neutral-800",
        dialogSheetBg: "bg-neutral-900",
        dialogSheetBorder: "border-neutral-800",
        inputBg: "bg-neutral-800",
        inputBorder: "border-neutral-700",
        inputPlaceholder: "placeholder:text-neutral-400",
        buttonGhostHoverBg: "hover:bg-neutral-800",
        buttonGhostText: "text-white",
        dropdownItemHoverBg: "hover:bg-neutral-800",
        dropdownSeparator: "bg-neutral-700",
        textNeutralPrimary: "text-white",
        textNeutralSecondaryFixed: "text-neutral-400",
      }
    default:
      return {
        headerBg: "bg-stone-200/60 backdrop-blur-sm",
        headerBorder: "border-stone-300",
        footerBg: "bg-white",
        footerBorder: "border-neutral-200",
        dialogSheetBg: "bg-white",
        dialogSheetBorder: "border-neutral-200",
        inputBg: "bg-neutral-50",
        inputBorder: "border-neutral-300",
        inputPlaceholder: "placeholder:text-neutral-500",
        buttonGhostHoverBg: "hover:bg-neutral-100",
        buttonGhostText: "text-neutral-900",
        dropdownItemHoverBg: "hover:bg-neutral-100",
        dropdownSeparator: "bg-neutral-200",
        textNeutralPrimary: "text-neutral-900",
        textNeutralSecondaryFixed: "text-neutral-600",
      }
  }
}

// Get theme classes based on background color
const getThemeClasses = (backgroundColor: BackgroundColor): ThemeClasses => {
  switch (backgroundColor) {
    case "white":
      return {
        mainBg: "bg-white min-h-screen",
        mainText: "text-neutral-950",
        cardBg: "bg-white",
        cardBorder: "border-neutral-200",
        checkboxCheckedBg: "data-[state=checked]:bg-yellow-500",
        checkboxCheckedText: "data-[state=checked]:text-white",
        sliderTrack: "[&>span:first-child]:bg-yellow-500",
        textNeutralSecondary: "text-neutral-500",
        borderNeutralSecondary: "border-neutral-300",
        buttonGhostHoverBg: "hover:bg-neutral-100",
      }
    case "gray":
      return {
        mainBg: "bg-gray-800 min-h-screen",
        mainText: "text-white",
        cardBg: "bg-gray-700",
        cardBorder: "border-gray-600",
        checkboxCheckedBg: "data-[state=checked]:bg-yellow-500",
        checkboxCheckedText: "data-[state=checked]:text-white",
        sliderTrack: "[&>span:first-child]:bg-yellow-500",
        textNeutralSecondary: "text-gray-400",
        borderNeutralSecondary: "border-gray-600",
        buttonGhostHoverBg: "hover:bg-neutral-800",
      }
    case "dark":
      return {
        mainBg: "bg-neutral-950 min-h-screen",
        mainText: "text-white",
        cardBg: "bg-neutral-800",
        cardBorder: "border-neutral-700",
        checkboxCheckedBg: "data-[state=checked]:bg-yellow-500",
        checkboxCheckedText: "data-[state=checked]:text-white",
        sliderTrack: "[&>span:first-child]:bg-yellow-500",
        textNeutralSecondary: "text-neutral-400",
        borderNeutralSecondary: "border-neutral-700",
        buttonGhostHoverBg: "hover:bg-neutral-800",
      }
    default:
      return {
        mainBg: "bg-white min-h-screen",
        mainText: "text-neutral-950",
        cardBg: "bg-white",
        cardBorder: "border-neutral-200",
        checkboxCheckedBg: "data-[state=checked]:bg-yellow-500",
        checkboxCheckedText: "data-[state=checked]:text-white",
        sliderTrack: "[&>span:first-child]:bg-yellow-500",
        textNeutralSecondary: "text-neutral-500",
        borderNeutralSecondary: "border-neutral-300",
        buttonGhostHoverBg: "hover:bg-neutral-100",
      }
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function WebThemeProvider({ children }: { children: ReactNode }) {
  const [backgroundColor, setBackgroundColorState] = useState<BackgroundColor>("white")
  const [isLoaded, setIsLoaded] = useState(false)

  // Helper function to update HTML element class - defined before use
  const updateHtmlClass = (color: BackgroundColor) => {
    if (typeof window === 'undefined') return
    
    const htmlElement = document.documentElement
    if (color === 'dark') {
      htmlElement.className = 'dark'
      htmlElement.style.colorScheme = 'dark'
    } else if (color === 'gray') {
      htmlElement.className = 'gray'
      htmlElement.style.colorScheme = 'dark'
    } else {
      htmlElement.className = 'light'
      htmlElement.style.colorScheme = 'light'
    }
  }

  // Load background color from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem('backgroundColor') as BackgroundColor
      if (savedColor && ["white", "gray", "dark"].includes(savedColor)) {
        setBackgroundColorState(savedColor)
        updateHtmlClass(savedColor)
      } else {
        updateHtmlClass("white")
      }
      setIsLoaded(true)
    }
  }, [])

  // Listen for storage events to sync theme across tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'backgroundColor' && e.newValue) {
        const newColor = e.newValue as BackgroundColor
        if (["white", "gray", "dark"].includes(newColor)) {
          setBackgroundColorState(newColor)
          updateHtmlClass(newColor)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Listen for custom theme change events
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleThemeChange = (e: CustomEvent<BackgroundColor>) => {
      setBackgroundColorState(e.detail)
      updateHtmlClass(e.detail)
    }

    window.addEventListener('theme-change' as any, handleThemeChange)
    return () => window.removeEventListener('theme-change' as any, handleThemeChange)
  }, [])

  // Update HTML element class when backgroundColor changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isLoaded) {
      updateHtmlClass(backgroundColor)
    }
  }, [backgroundColor, isLoaded])

  const setBackgroundColor = (newColor: BackgroundColor) => {
    setBackgroundColorState(newColor)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('backgroundColor', newColor)
      updateHtmlClass(newColor)
      
      // Dispatch custom event to notify all components
      window.dispatchEvent(new CustomEvent('theme-change', { detail: newColor }))
    }
  }

  const themeClasses = useMemo(() => getThemeClasses(backgroundColor), [backgroundColor])
  const darkHeaderFooterClasses = useMemo(() => getHeaderFooterClasses(backgroundColor), [backgroundColor])

  const value: ThemeContextType = {
    backgroundColor,
    setBackgroundColor,
    themeClasses: isLoaded ? themeClasses : getThemeClasses("white"),
    darkHeaderFooterClasses: isLoaded ? darkHeaderFooterClasses : getHeaderFooterClasses("white"),
    isLoaded,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  
  if (context === undefined) {
    // Fallback for components that use the hook before the provider is mounted
    // This ensures backward compatibility
    throw new Error('useTheme must be used within a WebThemeProvider')
  }
  
  return context
}

