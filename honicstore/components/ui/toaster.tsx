"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertTriangle, X } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider suppressHydrationWarning>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props} suppressHydrationWarning>
            <div className="grid gap-1">
              {variant === "outOfStock" && (
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-5 w-5 text-white" />
                  {title && <ToastTitle>{title}</ToastTitle>}
                </div>
              )}
              {variant !== "outOfStock" && title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>
                  {variant === "outOfStock" ? (
                    <span>
                      This product is currently unavailable. Please return in{' '}
                      <span className="text-2xl font-bold text-white bg-orange-600 px-2 py-1 rounded">
                        3 days
                      </span>
                      .
                    </span>
                  ) : (
                    description
                  )}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport suppressHydrationWarning />
    </ToastProvider>
  )
}
