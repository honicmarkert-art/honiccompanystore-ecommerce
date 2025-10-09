/**
 * Utility functions for showing custom alerts instead of browser alerts
 */

import { showSuccessAlert, showErrorAlert, showWarningAlert, showInfoAlert } from '@/components/ui/custom-alert'

// Global alert functions that can be used anywhere
let globalAlertHandler: ((alert: any) => void) | null = null

export const setGlobalAlertHandler = (handler: (alert: any) => void) => {
  globalAlertHandler = handler
}

export const showAlert = (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => {
  if (globalAlertHandler) {
    let alertConfig
    switch (type) {
      case 'success':
        alertConfig = showSuccessAlert(message, title)
        break
      case 'error':
        alertConfig = showErrorAlert(message, title)
        break
      case 'warning':
        alertConfig = showWarningAlert(message, title)
        break
      case 'info':
        alertConfig = showInfoAlert(message, title)
        break
    }
    globalAlertHandler(alertConfig)
  } else {
    // Fallback to browser alert if no handler is set
    console.warn('No alert handler set, falling back to browser alert')
    window.alert(`${title ? title + ': ' : ''}${message}`)
  }
}

// Convenience functions
export const alertSuccess = (message: string, title?: string) => showAlert('success', message, title)
export const alertError = (message: string, title?: string) => showAlert('error', message, title)
export const alertWarning = (message: string, title?: string) => showAlert('warning', message, title)
export const alertInfo = (message: string, title?: string) => showAlert('info', message, title)

// Replace browser alert globally
export const replaceBrowserAlert = () => {
  const originalAlert = window.alert
  
  window.alert = (message: string) => {
    if (globalAlertHandler) {
      // Try to detect if it's an error message
      const isError = message.toLowerCase().includes('error') || 
                     message.toLowerCase().includes('failed') ||
                     message.toLowerCase().includes('invalid') ||
                     message.toLowerCase().includes('required')
      
      const alertType = isError ? 'error' : 'info'
      showAlert(alertType, message, 'Notification')
    } else {
      originalAlert(message)
    }
  }
}





