"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

type Currency = 'USD' | 'TZS'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => void
  formatPrice: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('TZS') // Default to TZS

  // Load currency preference from localStorage on mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem('preferred-currency') as Currency
    if (savedCurrency && (savedCurrency === 'USD' || savedCurrency === 'TZS')) {
      setCurrency(savedCurrency)
    }
  }, [])

  // Save currency preference to localStorage when changed
  const handleSetCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency)
    localStorage.setItem('preferred-currency', newCurrency)
  }

  const formatPrice = (amount: number | string | undefined) => {
    // Convert to number and handle invalid values
    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || 0))
    
    if (isNaN(numAmount) || numAmount === null || numAmount === undefined) {
      return currency === "USD" ? "$0.00" : "TSh 0"
    }
    
    // NEW APPROACH: All prices are stored in TZS, convert to USD for display if needed
    if (currency === 'USD') {
      // Convert TZS to USD for display
      const TZS_TO_USD_RATE = 1 / 2500 // 1 TZS = 0.0004 USD
      const usdAmount = numAmount * TZS_TO_USD_RATE
      return `$${usdAmount.toFixed(2)}`
    } else {
      // Display TZS as-is (no conversion needed)
      if (isNaN(numAmount) || numAmount === null || numAmount === undefined || typeof numAmount !== 'number') {
        return "TSh 0"
      }
      return `TSh ${numAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
  }

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      setCurrency: handleSetCurrency, 
      formatPrice 
    }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
















