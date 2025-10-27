/**
 * Stock validation utilities for product availability checks
 */

export interface StockCheckResult {
  isAvailable: boolean
  message?: string
}

/**
 * Check if a product is available for purchase
 */
export function checkProductStock(
  product: any,
  selectedVariant?: any,
  requestedQuantity: number = 1
): StockCheckResult {
  // Handle both snake_case and camelCase field names
  const inStock = product.in_stock !== undefined ? product.in_stock : product.inStock
  const stockQuantity = product.stock_quantity !== undefined ? product.stock_quantity : product.stockQuantity

  // Check if product is in stock
  if (!inStock) {
    return {
      isAvailable: false,
      message: 'Product is out of stock'
    }
  }

  // Check stock quantity
  if (stockQuantity < requestedQuantity) {
    return {
      isAvailable: false,
      message: `Only ${stockQuantity} items available`
    }
  }

  // Check variant stock if variant is selected
  const variantStockQuantity = selectedVariant?.stock_quantity !== undefined ? selectedVariant.stock_quantity : selectedVariant?.stockQuantity
  if (selectedVariant && variantStockQuantity !== undefined) {
    if (variantStockQuantity < requestedQuantity) {
      return {
        isAvailable: false,
        message: `Only ${variantStockQuantity} items available for this variant`
      }
    }
  }

  return {
    isAvailable: true
  }
}

/**
 * Validate auto-selected stock for variants
 */
export function validateAutoSelectedStock(
  product: any,
  selectedVariant?: any
): StockCheckResult {
  return checkProductStock(product, selectedVariant, 1)
}