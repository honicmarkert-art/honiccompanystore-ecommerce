"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Minus, Plus, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { CartItem } from "@/hooks/use-cart"

interface CartSelectionPreviewProps {
  item: CartItem
  isOpen: boolean
  onClose: () => void
  onQuantityChange: (productId: number, variantId: string, delta: number) => void
  formatPrice: (amount: number) => string
}

export function CartSelectionPreview({
  item,
  isOpen,
  onClose,
  onQuantityChange,
  formatPrice
}: CartSelectionPreviewProps) {
  const { themeClasses } = useTheme()
  const [localQuantities, setLocalQuantities] = useState<{ [key: string]: number }>({})

  // Initialize local quantities from item variants
  useState(() => {
    const quantities: { [key: string]: number } = {}
    item.variants.forEach(variant => {
      quantities[variant.variantId] = variant.quantity
    })
    setLocalQuantities(quantities)
  })

  const handleQuantityChange = (variantId: string, delta: number) => {
    const currentQty = localQuantities[variantId] || 0
    const newQty = Math.max(0, currentQty + delta)
    
    setLocalQuantities(prev => ({
      ...prev,
      [variantId]: newQty
    }))
    
    onQuantityChange(item.productId, variantId, delta)
  }

  const totalItems = Object.values(localQuantities).reduce((sum, qty) => sum + qty, 0)
  const totalPrice = item.variants.reduce((sum, variant) => {
    const qty = localQuantities[variant.variantId] || 0
    return sum + (variant.price * qty)
  }, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-lg max-h-[70vh] overflow-y-auto",
        themeClasses.cardBg,
        themeClasses.cardBorder
      )}>
        <DialogHeader>
          <DialogTitle className={cn("text-lg font-bold", themeClasses.mainText)}>
            Selection Details
          </DialogTitle>
          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
            Review your selected options and pricing breakdown.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Header */}
          <div className={cn(
            "flex gap-3 p-3 rounded-lg border",
            "bg-white dark:bg-gray-800",
            "border-gray-200 dark:border-gray-700"
          )}>
            {item.product?.image && (
              <img
                src={item.product.image}
                alt={item.product.name}
                className={cn(
                  "w-10 h-10 object-cover rounded border flex-shrink-0",
                  "border-gray-300 dark:border-gray-600"
                )}
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold text-sm truncate",
                "text-gray-900 dark:text-gray-100"
              )}>
                {item.product?.name || "Unknown Product"}
              </h3>
              <p className={cn(
                "text-xs truncate",
                "text-gray-600 dark:text-gray-400"
              )}>
                SKU: {item.product?.sku || "SKU A001"}
              </p>
            </div>
          </div>

          {/* Selection Breakdown */}
          <div>
            <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>
              Selection Breakdown:
            </h4>
            <p className={cn("text-xs mb-3", themeClasses.textNeutralSecondary)}>
              Items to be added to cart:
            </p>
            
            <div className="space-y-2">
              {item.variants.map((variant, index) => {
                const qty = localQuantities[variant.variantId] || 0
                const subtotal = variant.price * qty
                
                return (
                  <div key={variant.variantId} className={cn(
                    "p-2 rounded border space-y-2",
                    "bg-white dark:bg-gray-800",
                    "border-gray-300 dark:border-gray-600"
                  )}>
                    {/* First Row: Selection Text */}
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-medium",
                        "text-gray-700 dark:text-gray-300"
                      )}>
                        {index + 1}.
                      </span>
                      <span className={cn(
                        "text-xs font-medium flex-1",
                        "text-gray-900 dark:text-gray-100"
                      )}>
                        {Object.keys(variant.attributes).length > 0 
                          ? Object.entries(variant.attributes).map(([key, value]) => 
                              `${key}: ${value}`
                            ).join(', ')
                          : 'Standard Product'
                        }
                      </span>
                    </div>
                    
                    {/* Second Row: Left side (Price + Quantity) | Right side (Total) */}
                    <div className="flex items-center justify-between">
                      {/* Left side: Product amount and quantity changer */}
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-xs font-semibold",
                          "text-gray-900 dark:text-gray-100"
                        )}>
                          {formatPrice(variant.price)}
                        </span>
                        
                        <div className={cn(
                          "flex items-center border-2 rounded",
                          "border-gray-300 dark:border-gray-600",
                          "bg-white dark:bg-gray-800"
                        )}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQuantityChange(variant.variantId, -1)}
                            disabled={qty <= 0}
                            className={cn(
                              "h-6 w-6 rounded-none border-r",
                              "border-gray-300 dark:border-gray-600",
                              "hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className={cn(
                            "px-2 py-0.5 text-xs font-medium min-w-[1.5rem] text-center border-r",
                            "border-gray-300 dark:border-gray-600",
                            "bg-gray-50 dark:bg-gray-700",
                            "text-gray-900 dark:text-gray-100"
                          )}>
                            {qty}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQuantityChange(variant.variantId, 1)}
                            className={cn(
                              "h-6 w-6 rounded-none",
                              "hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Right side: Total cost */}
                      <div className="text-right">
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Totals */}
          <div className={cn(
            "border-t pt-3 p-3 rounded",
            "border-gray-300 dark:border-gray-600",
            "bg-gray-50 dark:bg-gray-800"
          )}>
            <div className="flex justify-between items-center mb-3">
              <span className={cn(
                "text-sm font-semibold",
                "text-gray-900 dark:text-gray-100"
              )}>
                Total Items: {totalItems}
              </span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                Total Price: {formatPrice(totalPrice)}
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                size="sm"
                className={cn(
                  "flex-1 text-xs",
                  themeClasses.borderNeutralSecondary,
                  themeClasses.buttonGhostHoverBg
                )}
              >
                Close
              </Button>
              <Button
                onClick={onClose}
                size="sm"
                className="flex-1 bg-yellow-500 text-neutral-950 hover:bg-yellow-600 text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
