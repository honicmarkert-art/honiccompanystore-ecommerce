"use client"

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, ShoppingBag, Phone } from "lucide-react"

interface QuantityLimitModalProps {
  isOpen: boolean
  onClose: () => void
  productName?: string
}

export function QuantityLimitModal({ isOpen, onClose, productName }: QuantityLimitModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Quantity Limit Notice
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <ShoppingBag className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Minimum Quantity Required
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                The limit is set to <strong>5 qty</strong> for any purchase below 500 TZS. 
                {productName && ` This applies to ${productName}.`}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                If you need a lower quantity, we recommend you to reach our shop for personalized service.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Need help?</strong> Contact our shop for custom orders and bulk pricing.
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Understood
            </Button>
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
              Continue Shopping
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
