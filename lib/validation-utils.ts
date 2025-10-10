// Input validation and sanitization utilities

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface Address {
  fullName: string
  address1: string
  address2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  email: string
  streetName?: string
  tin?: string
}

export interface PaymentMethod {
  paymentMethod: string
  [key: string]: any
}

// Sanitize input to prevent XSS and injection attacks
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return input
}

// Validate email format
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate phone number (international format)
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}

// Validate postal code (flexible format)
export function validatePostalCode(postalCode: string): boolean {
  const postalRegex = /^[A-Za-z0-9\s\-]{3,10}$/
  return postalRegex.test(postalCode)
}

// Validate address object
export function validateAddress(address: Address): ValidationResult {
  const errors: string[] = []

  // Required fields
  if (!address.fullName || address.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters')
  }

  if (!address.address1 || address.address1.trim().length < 5) {
    errors.push('Address line 1 must be at least 5 characters')
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.push('City must be at least 2 characters')
  }

  if (!address.state || address.state.trim().length < 2) {
    errors.push('State must be at least 2 characters')
  }

  if (!address.country || address.country.trim().length < 2) {
    errors.push('Country must be at least 2 characters')
  }

  if (!address.postalCode || !validatePostalCode(address.postalCode)) {
    errors.push('Invalid postal code format')
  }

  if (!address.phone || !validatePhone(address.phone)) {
    errors.push('Invalid phone number format')
  }

  if (!address.email || !validateEmail(address.email)) {
    errors.push('Invalid email format')
  }

  // Length validations
  if (address.fullName && address.fullName.length > 100) {
    errors.push('Full name must be less than 100 characters')
  }

  if (address.address1 && address.address1.length > 200) {
    errors.push('Address line 1 must be less than 200 characters')
  }

  if (address.address2 && address.address2.length > 200) {
    errors.push('Address line 2 must be less than 200 characters')
  }

  if (address.city && address.city.length > 50) {
    errors.push('City must be less than 50 characters')
  }

  if (address.state && address.state.length > 50) {
    errors.push('State must be less than 50 characters')
  }

  if (address.country && address.country.length > 50) {
    errors.push('Country must be less than 50 characters')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Validate payment method
export function validatePaymentMethod(paymentMethod: PaymentMethod): ValidationResult {
  const errors: string[] = []

  if (!paymentMethod.paymentMethod) {
    errors.push('Payment method is required')
  }

  // Validate payment method type
  const validPaymentMethods = ['card', 'mobile', 'clickpesa', 'bank_transfer']
  if (paymentMethod.paymentMethod && !validPaymentMethods.includes(paymentMethod.paymentMethod)) {
    errors.push('Invalid payment method')
  }

  // Additional validation based on payment method
  if (paymentMethod.paymentMethod === 'card') {
    if (!paymentMethod.cardNumber || paymentMethod.cardNumber.length < 13) {
      errors.push('Card number is required and must be at least 13 digits')
    }
    if (!paymentMethod.cardHolderName || paymentMethod.cardHolderName.length < 2) {
      errors.push('Card holder name is required')
    }
    if (!paymentMethod.expiryDate || !/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(paymentMethod.expiryDate)) {
      errors.push('Invalid expiry date format (MM/YY)')
    }
    if (!paymentMethod.cvv || !/^\d{3,4}$/.test(paymentMethod.cvv)) {
      errors.push('Invalid CVV format')
    }
  }

  if (paymentMethod.paymentMethod === 'mobile') {
    if (!paymentMethod.mobileNumber || !validatePhone(paymentMethod.mobileNumber)) {
      errors.push('Valid mobile number is required')
    }
    if (!paymentMethod.mobileProvider) {
      errors.push('Mobile provider is required')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Validate order amount
export function validateOrderAmount(amount: number): ValidationResult {
  const errors: string[] = []

  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number')
  } else {
    if (amount <= 0) {
      errors.push('Amount must be greater than 0')
    }
    if (amount > 1000000) { // 1 million limit
      errors.push('Amount exceeds maximum limit')
    }
    if (amount < 0.01) {
      errors.push('Amount must be at least 0.01')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Validate cart items
export function validateCartItems(cartItems: any[]): ValidationResult {
  const errors: string[] = []

  if (!Array.isArray(cartItems)) {
    errors.push('Cart items must be an array')
    return { isValid: false, errors }
  }

  if (cartItems.length === 0) {
    errors.push('Cart cannot be empty')
  }

  if (cartItems.length > 50) {
    errors.push('Cart cannot contain more than 50 items')
  }

  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i]
    
    if (!item.product_id || typeof item.product_id !== 'number') {
      errors.push(`Item ${i + 1}: Invalid product ID`)
    }
    
    if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
      errors.push(`Item ${i + 1}: Invalid quantity`)
    }
    
    if (item.quantity > 100) {
      errors.push(`Item ${i + 1}: Quantity exceeds maximum limit (100)`)
    }
    
    if (!item.price || typeof item.price !== 'number' || item.price < 0) {
      errors.push(`Item ${i + 1}: Invalid price`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}








