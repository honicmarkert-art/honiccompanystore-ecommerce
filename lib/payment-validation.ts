// Payment validation utilities (DPO-independent)

// Validate card number using Luhn algorithm
export const validateCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s/g, "")
  if (!/^\d{13,19}$/.test(cleaned)) return false
  
  let sum = 0
  let isEven = false
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i))
    
    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}

// Validate expiry date
export const validateExpiryDate = (expiryDate: string): boolean => {
  const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/
  if (!regex.test(expiryDate)) return false
  
  const [month, year] = expiryDate.split("/")
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear() % 100
  const currentMonth = currentDate.getMonth() + 1
  
  const expYear = parseInt(year)
  const expMonth = parseInt(month)
  
  if (expYear < currentYear) return false
  if (expYear === currentYear && expMonth < currentMonth) return false
  
  return true
}

// Validate CVV
export const validateCVV = (cvv: string): boolean => {
  return /^\d{3,4}$/.test(cvv)
}

// Format card number with spaces
export const formatCardNumber = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, "")
  const groups = cleaned.match(/.{1,4}/g)
  return groups ? groups.join(" ") : cleaned
}

// Detect card type based on card number
export const detectCardType = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, "")
  
  // Visa: starts with 4
  if (/^4/.test(cleaned)) {
    return "Visa"
  }
  
  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(cleaned) || /^2[2-7][2-9][0-9]/.test(cleaned)) {
    return "Mastercard"
  }
  
  // American Express: starts with 34 or 37
  if (/^3[47]/.test(cleaned)) {
    return "American Express"
  }
  
  // Discover: starts with 6011, 622126-622925, 644-649, 65
  if (/^6(?:011|5|4[4-9]|22(?:1(?:2[6-9]|[3-9]\d)|[2-8]\d\d|9(?:[01]\d|2[0-5])))/.test(cleaned)) {
    return "Discover"
  }
  
  // JCB: starts with 2131, 1800, or 35
  if (/^(?:2131|1800|35)/.test(cleaned)) {
    return "JCB"
  }
  
  // Diners Club: starts with 300-305, 36, or 38-39
  if (/^3(?:0[0-5]|[68]|9)/.test(cleaned)) {
    return "Diners Club"
  }
  
  // UnionPay: starts with 62
  if (/^62/.test(cleaned)) {
    return "UnionPay"
  }
  
  return "Unknown"
}

// Payment validation for card payments
export const validatePaymentDetails = (paymentDetails: {
  paymentMethod?: "card" | "mobile"
  cardNumber: string
  cardHolderName: string
  expiryDate: string
  cvv: string
  mobileNumber?: string
  mobileProvider?: string
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Only validate card fields if payment method is card or not specified (for backward compatibility)
  if (!paymentDetails.paymentMethod || paymentDetails.paymentMethod === "card") {
    // Validate card number
    if (!paymentDetails.cardNumber.trim()) {
      errors.push("Card number is required")
    } else if (!validateCardNumber(paymentDetails.cardNumber)) {
      errors.push("Please enter a valid card number")
    }

    // Validate card holder name
    if (!paymentDetails.cardHolderName.trim()) {
      errors.push("Card holder name is required")
    } else if (paymentDetails.cardHolderName.trim().length < 2) {
      errors.push("Card holder name must be at least 2 characters")
    }

    // Validate expiry date
    if (!paymentDetails.expiryDate.trim()) {
      errors.push("Expiry date is required")
    } else if (!validateExpiryDate(paymentDetails.expiryDate)) {
      errors.push("Please enter a valid expiry date (MM/YY)")
    }

    // Validate CVV
    if (!paymentDetails.cvv.trim()) {
      errors.push("CVV is required")
    } else if (!validateCVV(paymentDetails.cvv)) {
      errors.push("Please enter a valid CVV (3-4 digits)")
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}









