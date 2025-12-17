"use client"

import React, { createContext, useContext, useCallback } from 'react'
import { useCustomAlert, AlertContainer, showSuccessAlert, showErrorAlert, showWarningAlert, showInfoAlert } from '@/components/ui/custom-alert'

interface AlertContextType {
  showSuccess: (message: string, title?: string) => string
  showError: (message: string, title?: string) => string
  showWarning: (message: string, title?: string) => string
  showInfo: (message: string, title?: string) => string
  clearAll: () => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export const useAlert = () => {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}

interface AlertProviderProps {
  children: React.ReactNode
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const { alerts, showAlert, clearAll } = useCustomAlert()

  const showSuccess = useCallback((message: string, title?: string) => {
    return showAlert(showSuccessAlert(message, title))
  }, [showAlert])

  const showError = useCallback((message: string, title?: string) => {
    return showAlert(showErrorAlert(message, title))
  }, [showAlert])

  const showWarning = useCallback((message: string, title?: string) => {
    return showAlert(showWarningAlert(message, title))
  }, [showAlert])

  const showInfo = useCallback((message: string, title?: string) => {
    return showAlert(showInfoAlert(message, title))
  }, [showAlert])

  const value = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
  }

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertContainer alerts={alerts} />
    </AlertContext.Provider>
  )
}





