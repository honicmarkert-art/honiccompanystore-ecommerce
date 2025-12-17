"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, ShoppingCart, AlertTriangle, Info, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ValidationModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message?: string
  type?: 'error' | 'warning' | 'info' | 'success'
  buttonText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
  showCancelButton?: boolean
  showCloseButton?: boolean
}

export function ValidationModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'warning',
  buttonText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancelButton = false,
  showCloseButton = true
}: ValidationModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(), 150) // Allow animation to complete
  }

  const handleConfirm = () => {
    if (onConfirm) onConfirm()
    handleClose()
  }

  const handleCancel = () => {
    if (onCancel) onCancel()
    handleClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-6 h-6 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />
      case 'info':
        return <Info className="w-6 h-6 text-blue-600" />
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      default:
        return <Info className="w-6 h-6 text-blue-600" />
    }
  }

  const getCardStyles = () => {
    switch (type) {
      case 'error':
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
      case 'warning':
        return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
      case 'info':
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
      case 'success':
        return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
      default:
        return "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    }
  }

  const getButtonStyles = () => {
    switch (type) {
      case 'error':
        return "bg-red-600 hover:bg-red-700 text-white"
      case 'warning':
        return "bg-yellow-600 hover:bg-yellow-700 text-white"
      case 'info':
        return "bg-blue-600 hover:bg-blue-700 text-white"
      case 'success':
        return "bg-green-600 hover:bg-green-700 text-white"
      default:
        return "bg-gray-600 hover:bg-gray-700 text-white"
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150",
        isVisible ? "opacity-100" : "opacity-0"
      )}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <Card className={cn(
        "relative w-full max-w-md shadow-2xl transform transition-all duration-150",
        isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4",
        getCardStyles()
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getIcon()}
              <CardTitle className={cn(
                "text-lg font-semibold",
                type === 'error' && "text-red-900 dark:text-red-100",
                type === 'warning' && "text-yellow-900 dark:text-yellow-100",
                type === 'info' && "text-blue-900 dark:text-blue-100",
                type === 'success' && "text-green-900 dark:text-green-100"
              )}>
                {title || (type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : type === 'info' ? 'Information' : 'Success')}
              </CardTitle>
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {message && (<p className={cn(
            "text-sm leading-relaxed",
            type === 'error' && "text-red-800 dark:text-red-200",
            type === 'warning' && "text-yellow-800 dark:text-yellow-200",
            type === 'info' && "text-blue-800 dark:text-blue-200",
            type === 'success' && "text-green-800 dark:text-green-200"
          )}>
            {message}
          </p>)}
          
          <div className="flex justify-end gap-2 mt-6">
            {showCancelButton && (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="min-w-[80px]"
              >
                {cancelText}
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              className={cn("min-w-[80px]", getButtonStyles())}
            >
              {buttonText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Specialized checkout validation modal
export function CheckoutValidationModal({
  isOpen,
  onClose,
  message = "Please select at least one item to proceed to checkout.",
  onGoToCart
}: {
  isOpen: boolean
  onClose: () => void
  message?: string
  onGoToCart?: () => void
}) {
  return (
    <ValidationModal
      isOpen={isOpen}
      onClose={onClose}
      title="Cart Empty"
      message={message}
      type="warning"
      buttonText="Go to Cart"
      showCloseButton={true}
    />
  )
}

// Hook for managing validation modal state
export function useValidationModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [modalProps, setModalProps] = useState<Partial<ValidationModalProps>>({})

  const showModal = (props: Partial<ValidationModalProps>) => {
    setModalProps(props)
    setIsOpen(true)
  }

  const hideModal = () => {
    setIsOpen(false)
    setTimeout(() => setModalProps({}), 150)
  }

  const showCheckoutValidation = (message?: string, onGoToCart?: () => void) => {
    showModal({
      title: "Cart Empty",
      message: message || "Please select at least one item to proceed to checkout.",
      type: "warning",
      buttonText: "Go to Cart"
    })
  }

  const showError = (message: string, title?: string) => {
    showModal({
      title: title || "Error",
      message,
      type: "error"
    })
  }

  const showSuccess = (message: string, title?: string) => {
    showModal({
      title: title || "Success",
      message,
      type: "success"
    })
  }

  const showInfo = (message: string, title?: string) => {
    showModal({
      title: title || "Information",
      message,
      type: "info"
    })
  }

  return {
    isOpen,
    modalProps,
    showModal,
    hideModal,
    showCheckoutValidation,
    showError,
    showSuccess,
    showInfo
  }
}



