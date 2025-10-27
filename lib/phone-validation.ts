/**
 * Phone number validation utilities for Tanzania
 */

/**
 * Validates Tanzanian phone numbers
 * Valid formats:
 * - +255 712 345 678 (with spaces)
 * - +255712345678
 * - 0712345678 (local format)
 * - 712345678 (without leading 0)
 */
export function validateTanzaniaPhone(phone: string): { valid: boolean; error?: string; formatted?: string } {
  if (!phone || !phone.trim()) {
    return { valid: false, error: "Phone number is required" }
  }

  // Remove all spaces
  let cleaned = phone.replace(/\s+/g, '')
  
  // Remove any non-numeric characters except +
  let digitsOnly = cleaned.replace(/[^\d+]/g, '')
  
  // Check if starts with +255
  if (digitsOnly.startsWith('+255')) {
    // Remove the + sign
    digitsOnly = digitsOnly.substring(1)
  }
  
  // Check if it's a 9-digit number (without country code)
  if (digitsOnly.length === 9) {
    // Tanzania mobile numbers start with 7, 6, or 5, not 1
    if (digitsOnly.startsWith('1')) {
      return { valid: false, error: "Tanzania phone numbers do not start with 1. Please enter a valid number (e.g., +255 712 345 678)" }
    }
    if (!digitsOnly.match(/^[567]\d{8}$/)) {
      return { valid: false, error: "Invalid Tanzania phone number. Must start with 5, 6, or 7 (e.g., +255 712 345 678)" }
    }
    return { valid: true, formatted: '255' + digitsOnly }
  }
  
  // Check if it starts with 255 (country code without +)
  if (digitsOnly.startsWith('255') && digitsOnly.length === 12) {
    const mobilePart = digitsOnly.substring(3)
    if (mobilePart.startsWith('0')) {
      return { valid: false, error: "Remove leading 0 after country code (e.g., use 255712345678 not 2550712345678)" }
    }
    if (!mobilePart.match(/^[567]\d{8}$/)) {
      return { valid: false, error: "Invalid Tanzania phone number. Must start with 5, 6, or 7 (e.g., +255 712 345 678)" }
    }
    return { valid: true, formatted: digitsOnly }
  }
  
  // Check if it starts with 0 (local format)
  if (digitsOnly.startsWith('0')) {
    const withoutZero = digitsOnly.substring(1)
    if (withoutZero.length === 9 && withoutZero.match(/^[567]\d{8}$/)) {
      return { valid: true, formatted: '255' + withoutZero }
    }
  }
  
  return { valid: false, error: "Invalid phone number format. Please use: +255 712 345 678 or 0712345678" }
}

/**
 * Formats phone number for payment gateway
 * Takes any Tanzania phone format and converts to 255XXXXXXXXX (12 digits)
 */
export function formatPhoneForPayment(phone: string): string {
  const validation = validateTanzaniaPhone(phone)
  if (!validation.valid || !validation.formatted) {
    throw new Error(validation.error || "Invalid phone number")
  }
  return validation.formatted
}

/**
 * Validates email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || !email.trim()) {
    return { valid: false, error: "Email address is required" }
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Please enter a valid email address (e.g., user@example.com)" }
  }

  // Additional validation for common mistakes
  if (email.includes(' ')) {
    return { valid: false, error: "Email address cannot contain spaces" }
  }

  if (email.includes('..')) {
    return { valid: false, error: "Email address cannot contain consecutive dots" }
  }

  // Check for valid top-level domain
  const parts = email.split('.')
  if (parts.length < 2 || parts[parts.length - 1].length < 2) {
    return { valid: false, error: "Email must include a valid domain (e.g., .com, .org, .co.tz)" }
  }

  return { valid: true }
}

