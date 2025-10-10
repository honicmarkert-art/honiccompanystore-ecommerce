import { z } from 'zod'

// Common validation schemas
export const emailSchema = z.string().email('Invalid email format')
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format')
export const urlSchema = z.string().url('Invalid URL format')
export const slugSchema = z.string().regex(/^[a-z0-9\-]+$/, 'Invalid slug format')

// Sanitization functions
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .trim()
}

export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
}

export function sanitizeNumber(input: string | number): number {
  const num = typeof input === 'string' ? parseFloat(input) : input
  return isNaN(num) ? 0 : Math.max(0, num) // Ensure non-negative
}

// API validation schemas
export const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  price: z.number().min(0, 'Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  image: urlSchema.optional(),
  stock_quantity: z.number().int().min(0, 'Stock must be non-negative').optional(),
  sku: z.string().max(100, 'SKU too long').optional(),
  brand: z.string().max(100, 'Brand name too long').optional(),
  inStock: z.boolean().optional(),
  freeDelivery: z.boolean().optional(),
  sameDayDelivery: z.boolean().optional()
})

export const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive('Invalid product ID'),
    quantity: z.number().int().positive('Quantity must be positive'),
    price: z.number().min(0, 'Price must be non-negative')
  })).min(1, 'At least one item required'),
  deliveryOption: z.enum(['pickup', 'shipping']),
  customerInfo: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    email: emailSchema,
    phone: phoneSchema.optional(),
    address: z.string().max(500, 'Address too long').optional()
  }),
  paymentMethod: z.enum(['clickpesa', 'cash_on_delivery']).optional()
})

export const userSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  full_name: z.string().min(1, 'Full name is required').max(255, 'Name too long').optional(),
  phone: phoneSchema.optional()
})

export const adminSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255, 'Name too long'),
  companyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  companyTagline: z.string().max(255, 'Tagline too long').optional(),
  companyLogo: urlSchema.optional(),
  mainHeadline: z.string().max(500, 'Headline too long').optional(),
  heroBackgroundImage: urlSchema.optional(),
  heroTaglineAlignment: z.enum(['left', 'center', 'right']).optional(),
  websiteUrl: urlSchema.optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: phoneSchema.optional(),
  address: z.string().max(500, 'Address too long').optional(),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
  timezone: z.string().optional(),
  language: z.string().length(2, 'Language must be 2 characters').optional()
})

// Advertisement validation
export const advertisementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  media_url: urlSchema,
  media_type: z.enum(['image', 'video']),
  link_url: urlSchema.optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0, 'Display order must be non-negative').optional()
})

// Service image validation
export const serviceImageSchema = z.object({
  serviceType: z.enum(['retail', 'prototyping', 'pcb', 'ai', 'stem', 'home']),
  images: z.array(urlSchema).max(10, 'Maximum 10 images per service'),
  rotationTime: z.number().int().min(3, 'Rotation time must be at least 3 seconds').max(30, 'Rotation time must be at most 30 seconds')
})

// Rate limiting validation
export const rateLimitSchema = z.object({
  windowMs: z.number().int().positive('Window must be positive'),
  maxRequests: z.number().int().positive('Max requests must be positive')
})

// Security validation
export const securitySettingsSchema = z.object({
  twoFactorAuth: z.boolean().optional(),
  sessionTimeout: z.number().int().min(5, 'Session timeout must be at least 5 minutes').max(480, 'Session timeout must be at most 8 hours').optional(),
  passwordPolicy: z.enum(['weak', 'medium', 'strong']).optional(),
  loginAttempts: z.number().int().min(3, 'Login attempts must be at least 3').max(10, 'Login attempts must be at most 10').optional(),
  lockoutDuration: z.number().int().min(5, 'Lockout duration must be at least 5 minutes').max(60, 'Lockout duration must be at most 60 minutes').optional()
})

// Validation helper functions
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      }
    }
    return { success: false, errors: ['Validation failed'] }
  }
}

export function sanitizeAndValidate<T>(schema: z.ZodSchema<T>, data: any): { success: boolean; data?: T; errors?: string[] } {
  // Sanitize string fields
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data }
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitizeString(sanitized[key])
      }
    }
    return validateInput(schema, sanitized)
  }
  
  return validateInput(schema, data)
}

// SQL injection prevention
export function escapeSqlString(input: string): string {
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end
}

// XSS prevention
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// File upload validation
export function validateFileUpload(file: File, options: {
  maxSize?: number
  allowedTypes?: string[]
  allowedExtensions?: string[]
}): { valid: boolean; error?: string } {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options
  
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` }
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not allowed` }
  }
  
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      return { valid: false, error: `File extension .${extension} not allowed` }
    }
  }
  
  return { valid: true }
}





