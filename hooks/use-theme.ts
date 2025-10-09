"use client"

import { useState, useEffect } from "react"

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

// Theme-aware classes for header and footer
const getHeaderFooterClasses = (backgroundColor: BackgroundColor) => {
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

export function useTheme() {
  const [backgroundColor, setBackgroundColor] = useState<BackgroundColor>("white")
  const [isLoaded, setIsLoaded] = useState(false)

  // Load background color from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem('backgroundColor') as BackgroundColor
      if (savedColor && ["white", "gray", "dark"].includes(savedColor)) {
        setBackgroundColor(savedColor)
      }
      setIsLoaded(true)
    }
  }, [])

  // Save background color changes to localStorage
  const updateBackgroundColor = (newColor: BackgroundColor) => {
    setBackgroundColor(newColor)
    if (typeof window !== 'undefined') {
      localStorage.setItem('backgroundColor', newColor)
      
      // Update HTML element class and color-scheme
      const htmlElement = document.documentElement
      if (newColor === 'dark') {
        htmlElement.className = 'dark'
        htmlElement.style.colorScheme = 'dark'
      } else if (newColor === 'gray') {
        htmlElement.className = 'gray'
        htmlElement.style.colorScheme = 'dark'
      } else {
        htmlElement.className = 'light'
        htmlElement.style.colorScheme = 'light'
      }
    }
  }

  // Initialize HTML element class and color-scheme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const htmlElement = document.documentElement
      if (backgroundColor === 'dark') {
        htmlElement.className = 'dark'
        htmlElement.style.colorScheme = 'dark'
      } else if (backgroundColor === 'gray') {
        htmlElement.className = 'gray'
        htmlElement.style.colorScheme = 'dark'
      } else {
        htmlElement.className = 'light'
        htmlElement.style.colorScheme = 'light'
      }
    }
  }, [backgroundColor])

  // Get theme classes based on background color
  const getThemeClasses = (): ThemeClasses => {
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
          buttonGhostHoverBg: "hover:bg-neutral-800",
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
          buttonGhostHoverBg: "hover:bg-neutral-800",
        }
    }
  }

  const themeClasses = getThemeClasses()
  const headerFooterClasses = getHeaderFooterClasses(backgroundColor)

  return { 
    backgroundColor, 
    setBackgroundColor: updateBackgroundColor, 
    themeClasses: isLoaded ? themeClasses : {
      mainBg: "bg-white min-h-screen",
      mainText: "text-neutral-950",
      cardBg: "bg-white",
      cardBorder: "border-neutral-200",
      checkboxCheckedBg: "data-[state=checked]:bg-yellow-500",
      checkboxCheckedText: "data-[state=checked]:text-white",
      sliderTrack: "[&>span:first-child]:bg-yellow-500",
      textNeutralSecondary: "text-neutral-500",
      borderNeutralSecondary: "border-neutral-300",
      buttonGhostHoverBg: "hover:bg-neutral-800",
    }, 
    darkHeaderFooterClasses: isLoaded ? headerFooterClasses : getHeaderFooterClasses("white")
  }
}
