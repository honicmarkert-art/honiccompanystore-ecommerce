"use client"

import React, { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AlertType = 'success' | 'error' | 'warning' | 'info'

export interface CustomAlertProps {
  type: AlertType
  title?: string
  message: string
  duration?: number
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

const alertConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-800 dark:text-green-200',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-800 dark:text-red-200',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  type,
  title,
  message,
  duration = 5000,
  onClose,
  showCloseButton = true,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const config = alertConfig[type]
  const Icon = config.icon

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose?.()
    }, 300) // Wait for animation to complete
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 max-w-md w-full mx-4',
        'transform transition-all duration-300 ease-in-out',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        className
      )}
    >
      <div
        className={cn(
          'rounded-lg border p-4 shadow-lg backdrop-blur-sm',
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="flex items-start space-x-3">
          <div className={cn('flex-shrink-0', config.iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className={cn('text-sm font-semibold mb-1', config.textColor)}>
                {title}
              </h4>
            )}
            <p className={cn('text-sm', config.textColor)}>
              {message}
            </p>
          </div>

          {showCloseButton && (
            <button
              onClick={handleClose}
              className={cn(
                'flex-shrink-0 rounded-md p-1 transition-colors',
                'hover:bg-black/10 dark:hover:bg-white/10',
                config.textColor
              )}
              aria-label="Close alert"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook for managing multiple alerts
export const useCustomAlert = () => {
  const [alerts, setAlerts] = useState<Array<CustomAlertProps & { id: string }>>([])

  const showAlert = (alert: Omit<CustomAlertProps, 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newAlert = {
      ...alert,
      id,
      onClose: () => removeAlert(id),
    }
    
    setAlerts(prev => [...prev, newAlert])
    return id
  }

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }

  const clearAll = () => {
    setAlerts([])
  }

  return {
    alerts,
    showAlert,
    removeAlert,
    clearAll,
  }
}

// Alert Container Component
export const AlertContainer: React.FC<{ alerts: Array<CustomAlertProps & { id: string }> }> = ({
  alerts,
}) => {
  return (
    <>
      {alerts.map((alert) => (
        <CustomAlert key={alert.id} {...alert} />
      ))}
    </>
  )
}

// Convenience functions for common alert types
export const showSuccessAlert = (message: string, title?: string) => ({
  type: 'success' as const,
  message,
  title,
})

export const showErrorAlert = (message: string, title?: string) => ({
  type: 'error' as const,
  message,
  title,
})

export const showWarningAlert = (message: string, title?: string) => ({
  type: 'warning' as const,
  message,
  title,
})

export const showInfoAlert = (message: string, title?: string) => ({
  type: 'info' as const,
  message,
  title,
})

// Example usage:
// const { showAlert } = useCustomAlert()
// showAlert(showErrorAlert("Please select at least one item to proceed to checkout.", "Selection Required"))





