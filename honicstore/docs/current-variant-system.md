# Current Simplified Variant System

## Overview
The variant system has been simplified from a complex attribute-based system to a simple name-based system. This document explains how it works across all pages.

## Database Schema

### `product_variants` Table
The simplified variant system uses these core fields:

```sql
- id (integer) - Unique variant ID
- product_id (integer) - Foreign key to products table
- variant_name (text) - Simple variant name (e.g., "Red", "Large", "128GB")
- price (decimal) - Variant-specific price
- stock_quantity (integer) - Stock quantity for this variant
- in_stock (boolean) - Calculated from stock_quantity > 0
- image (text) - Variant-specific image URL
- sku (text) - Variant SKU
- model (text) - Variant model number
```

**Note:** Old complex fields like `attributes`, `primary_values`, `dependencies`, `multi_values` are still in the database for backward compatibility but are no longer actively used.

## How It Works Across Pages

### 1. Product List Page (`app/products/page.tsx`)

**What's Displayed:**
- Products show minimum price from all variants
- No variant selection on list page
- Out-of-stock products are filtered out client-side

**API Response:**
```typescript
{
  variants: product.product_variants?.map((variant: any) => ({
    id: variant.id,
    price: variant.price,
    variant_name: variant.variant_name || null, // Simplified field
    stock_quantity: variant.stock_quantity,
    in_stock: variant.stock_quantity > 0,
    // ... other fields for backward compatibility
  }))
}
```

**Key Points:**
- Variants are fetched but not displayed on list page
- Only minimum price is shown
- Stock status is calculated from variant stock quantities

---

### 2. Product Detail Page (`app/products/[id]/page.tsx`)

**What's Displayed:**
- Variant name (if available)
- Variant price
- Variant stock quantity
- Variant image (if available)

**Variant Normalization:**
```typescript
const normalizedVariants = base.variants.map((variant: any) => ({
  ...variant,
  variant_name: variant.variant_name || null, // Primary field
  stock_quantity: variant.stock_quantity || variant.stockQuantity || 0,
  stockQuantity: variant.stockQuantity || variant.stock_quantity || 0,
  in_stock: variant.in_stock !== undefined ? variant.in_stock : true
}))
```

**Variant Selection:**
- Users select variants by `variant_name` (e.g., "Red", "Large")
- Price updates based on selected variant
- Stock quantity shown per variant
- Image updates if variant has specific image

**Key Points:**
- `variant_name` is the primary identifier
- Old `attributes` and `primary_values` are preserved for compatibility but not used
- `variantConfig` defaults to `{ type: 'simple' }` if not provided

---

### 3. Cart Page (`app/cart/page.tsx`)

**What's Displayed:**
- Product name
- Variant name (if available) - shown as: `Product Name | Variant Name`
- Variant price
- Quantity

**Display Code:**
```typescript
{product?.name || `Product ${item.productId}`}
{variant.variant_name && (
  <span className="font-normal text-blue-600 dark:text-blue-400">
    {" | "}{variant.variant_name}
  </span>
)}
```

**Cart Item Structure:**
```typescript
{
  productId: number,
  variants: [{
    variantId: number | null,
    variant_name: string, // Used for display
    price: number,
    quantity: number
  }]
}
```

**Key Points:**
- Variant name is displayed alongside product name
- Price is variant-specific
- Quantity is tracked per variant

---

### 4. Checkout Page (`app/checkout/page.tsx`)

**Order Item Structure:**
```typescript
{
  productId: number,
  productName: string,
  variantId: number | null,
  variantName: variant.variant_name || 'Default', // Simplified variant name
  variantAttributes: null, // No longer used
  quantity: number,
  unitPrice: number, // Variant price
  totalPrice: number // unitPrice * quantity
}
```

**Display Code:**
```typescript
{variant.variant_name && (
  <span className="text-blue-600 dark:text-blue-400">
    {" | "}{variant.variant_name}
  </span>
)}
```

**Key Points:**
- `variantName` uses `variant_name` from database
- `variantAttributes` is set to `null` (not used)
- Price is variant-specific
- Order is created with variant ID and variant name

---

## API Endpoints

### GET `/api/products`
**Response includes:**
```typescript
variants: product.product_variants?.map((variant: any) => ({
  id: variant.id,
  price: variant.price,
  variant_name: variant.variant_name || null, // Simplified field
  stock_quantity: variant.stock_quantity,
  in_stock: variant.stock_quantity > 0,
  // Backward compatibility fields (still included but not used)
  attributes: {...},
  primaryValues: [...],
  primary_values: [...]
}))
```

### GET `/api/products/[id]`
**Response includes:**
- Same variant structure as above
- Full variant details for product detail page

### POST `/api/products` (Create Product)
**Variant Creation:**
```typescript
const variants = productData.variants.map((variant: any) => ({
  product_id: product.id,
  variant_name: variant.variant_name || null, // Simplified: just variant name
  price: variant.price || productData.price || 0,
  image: variant.image || null,
  sku: variant.sku || null,
  stock_quantity: typeof variant.stock_quantity === 'number' 
    ? variant.stock_quantity 
    : (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : null)
}))
```

### PUT `/api/products/[id]` (Update Product)
**Variant Update:**
```typescript
const variantsToInsert = updates.variants.map((variant: any) => ({
  product_id: Number(productId),
  variant_name: variant.variant_name || null, // Simplified: just variant name
  price: variant.price || updates.price || 0,
  image: preservedImage || null,
  sku: variant.sku || null,
  stock_quantity: variantStockQuantity,
  in_stock: variantStockQuantity > 0
}))
```

**Stock Calculation:**
- Product `stock_quantity` is calculated from sum of all variant `stock_quantity`
- Product `in_stock` is `true` if total stock > 0

---

## Key Differences from Old System

### Old System (Complex):
- Used `attributes` object with nested structures
- Used `primary_values` arrays
- Used `dependencies` for variant relationships
- Used `multi_values` for complex combinations
- Required complex matching logic

### New System (Simplified):
- Uses `variant_name` (simple string)
- Uses `price` (direct value)
- Uses `stock_quantity` (direct value)
- No dependencies or complex relationships
- Simple selection by name

---

## Backward Compatibility

The system maintains backward compatibility:
- Old fields (`attributes`, `primary_values`, etc.) are still in database
- Old fields are still returned in API responses
- Old fields are preserved when updating products
- But new code primarily uses `variant_name`, `price`, `stock_quantity`

---

## Example Variant Data

### Database:
```sql
INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, sku)
VALUES 
  (1, 'Red', 15000, 10, 'PROD-RED'),
  (1, 'Blue', 15000, 5, 'PROD-BLUE'),
  (1, 'Large', 18000, 8, 'PROD-LARGE');
```

### API Response:
```json
{
  "variants": [
    {
      "id": 1,
      "variant_name": "Red",
      "price": 15000,
      "stock_quantity": 10,
      "in_stock": true,
      "sku": "PROD-RED"
    },
    {
      "id": 2,
      "variant_name": "Blue",
      "price": 15000,
      "stock_quantity": 5,
      "in_stock": true,
      "sku": "PROD-BLUE"
    }
  ]
}
```

### Cart/Checkout:
```json
{
  "productId": 1,
  "variants": [{
    "variantId": 1,
    "variant_name": "Red",
    "price": 15000,
    "quantity": 2
  }]
}
```

---

## Summary

**Current System:**
- ✅ Simple `variant_name` field (e.g., "Red", "Large")
- ✅ Direct `price` and `stock_quantity` fields
- ✅ No complex attribute matching
- ✅ Easy to understand and maintain
- ✅ Backward compatible with old data

**Used Across:**
- ✅ Product List: Shows minimum price
- ✅ Product Detail: Shows variant selection by name
- ✅ Cart: Shows variant name alongside product name
- ✅ Checkout: Uses variant name in order items



