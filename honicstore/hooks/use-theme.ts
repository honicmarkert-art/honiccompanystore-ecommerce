"use client"

import { useState, useEffect, useMemo } from "react"
import { useTheme as useThemeContext } from "@/contexts/theme-context"

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

// Re-export the useTheme hook from the context
// This maintains backward compatibility with existing components
export function useTheme() {
  return useThemeContext()
}
