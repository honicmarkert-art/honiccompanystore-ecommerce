// ClickPesa API Integration
// Documentation: https://clickpesa.com/developers/

import { logger } from '@/lib/logger'

export interface ClickPesaConfig {
  baseUrl: string
  accessToken: string
  isLive: boolean
}

export interface CheckoutLinkRequest {
  totalPrice: string
  orderReference: string
  orderCurrency: 'TZS' | 'USD'
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  returnUrl?: string
  cancelUrl?: string
  webhookUrl?: string
  checksum?: string
}

export interface CheckoutLinkResponse {
  checkoutLink: string
  clientId: string
}

export interface ClickPesaError {
  error: string
  message: string
  statusCode: number
}

export interface TokenResponse {
  success: boolean
  token: string
}

// ClickPesa Configuration
const CLICKPESA_CONFIG: ClickPesaConfig = {
  baseUrl: process.env.NODE_ENV === "production" 
    ? "https://api.clickpesa.com" 
    : "https://api.clickpesa.com", // Use same URL for both (adjust if sandbox available)
  accessToken: process.env.CLICKPESA_CLIENT_ID || "", // Use Client ID as access token
  isLive: process.env.NODE_ENV === "production"
}

// ClickPesa API Key (for reference, but Client ID is used for auth)
export const CLICKPESA_API_KEY = process.env.CLICKPESA_API_KEY || ""
export const CLICKPESA_CLIENT_ID = process.env.CLICKPESA_CLIENT_ID || ""
export const CLICKPESA_CHECKSUM_KEY = process.env.CLICKPESA_CHECKSUM_KEY || ""

// Generate unique order reference for ClickPesa
export const generateOrderReference = (orderId: string): string => {
  // Return full UUID for ClickPesa (webhooks will use this)
  // ClickPesa will display a shorter version to customers
  return orderId
}

// Generate display reference for customers (10 characters)
export const generateDisplayReference = (orderId: string): string => {
  // Generate shorter reference for customer display
  const cleanOrderId = orderId.replace(/[^A-Za-z0-9]/g, '')
  return cleanOrderId.substring(0, 10)
}

// Format amount for ClickPesa (ensure it's a string with proper decimal places)
export const formatAmountForClickPesa = (amount: number): string => {
  return amount.toFixed(2)
}

// Format phone number for ClickPesa (remove + and ensure country code)
export const formatPhoneForClickPesa = (phone: string): string => {
  // Remove any non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Remove + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  
  // If it doesn't start with country code, assume Tanzania (255)
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1)
  } else if (cleaned.length === 9) {
    cleaned = '255' + cleaned
  }
  
  return cleaned
}

// Generate ClickPesa access token
export const generateAccessToken = async (): Promise<string> => {
  try {
    logger.log("ClickPesa: Generating access token...", {
      baseUrl: CLICKPESA_CONFIG.baseUrl,
      hasApiKey: Boolean(CLICKPESA_API_KEY),
      hasClientId: Boolean(CLICKPESA_CLIENT_ID)
    })

    const response = await fetch(`${CLICKPESA_CONFIG.baseUrl}/third-parties/generate-token`, {
      method: "POST",
      headers: {
        "api-key": CLICKPESA_API_KEY,
        "client-id": CLICKPESA_CLIENT_ID,
        "Content-Type": "application/json"
      },
    })

    logger.log("ClickPesa: Token generation response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.error("ClickPesa: Token generation failed:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      })

      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }

      throw new Error(
        errorData.message || 
        `ClickPesa token generation error: ${response.status} ${response.statusText}`
      )
    }

    const responseText = await response.text()
    logger.log("ClickPesa: Token response body:", responseText)

    let data: TokenResponse
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("ClickPesa: Failed to parse token response:", parseError)
      throw new Error("Invalid JSON response from ClickPesa token generation API")
    }
    
    if (!data.success || !data.token) {
      throw new Error("Invalid response from ClickPesa token generation API")
    }

    logger.log("ClickPesa: Access token generated successfully")
    return data.token
  } catch (error) {
    console.error("ClickPesa Token Generation Error:", error)
    
    if (error instanceof Error) {
      throw new Error(`Failed to generate access token: ${error.message}`)
    }
    
    throw new Error("Failed to generate access token. Please try again.")
  }
}

// Generate checksum using official ClickPesa algorithm
export const generateChecksum = (payload: CheckoutLinkRequest): string => {
  try {
    // Official ClickPesa checksum algorithm:
    // 1. Sort payload keys alphabetically
    // 2. Concatenate sorted values into a single string
    // 3. Generate HMAC-SHA256 hash with checksum key
    // 4. Return hex digest
    
    // Create payload object (exclude checksum field itself)
    const checksumPayload: Record<string, string> = {}
    
    // Add all non-empty fields to payload
    if (payload.totalPrice) checksumPayload.totalPrice = payload.totalPrice
    if (payload.orderReference) checksumPayload.orderReference = payload.orderReference
    if (payload.orderCurrency) checksumPayload.orderCurrency = payload.orderCurrency
    if (payload.customerName) checksumPayload.customerName = payload.customerName
    if (payload.customerEmail) checksumPayload.customerEmail = payload.customerEmail
    if (payload.customerPhone) checksumPayload.customerPhone = payload.customerPhone
    if (payload.returnUrl) checksumPayload.returnUrl = payload.returnUrl
    if (payload.cancelUrl) checksumPayload.cancelUrl = payload.cancelUrl
    if (payload.webhookUrl) checksumPayload.webhookUrl = payload.webhookUrl
    
    // Step 1: Sort payload keys alphabetically
    const sortedPayload = Object.keys(checksumPayload)
      .sort()
      .reduce((obj: Record<string, string>, key: string) => {
        obj[key] = checksumPayload[key]
        return obj
      }, {})
    
    // Step 2: Concatenate sorted values
    const payloadString = Object.values(sortedPayload).join("")
    
    logger.log("Checksum payload:", checksumPayload)
    logger.log("Sorted payload:", sortedPayload)
    logger.log("Concatenated string:", payloadString)
    logger.log("Using checksum key:", CLICKPESA_CHECKSUM_KEY)
    
    // Step 3: Generate HMAC-SHA256 hash
    if (typeof window === 'undefined') {
      // Server-side: Use Node.js crypto
      const crypto = require('crypto')
      const hmac = crypto.createHmac('sha256', CLICKPESA_CHECKSUM_KEY)
      hmac.update(payloadString)
      const checksum = hmac.digest('hex')
      
      logger.log("Generated checksum:", checksum)
      return checksum
    } else {
      // Client-side: Should not happen for checksum generation
      throw new Error("Checksum generation should only happen server-side")
    }
  } catch (error) {
    console.error("Checksum generation error:", error)
    throw new Error(`Failed to generate checksum: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Create ClickPesa checkout link
export const createCheckoutLink = async (request: CheckoutLinkRequest): Promise<CheckoutLinkResponse> => {
  try {
    // Step 1: Generate access token
    logger.log("Generating ClickPesa access token...")
    const accessToken = await generateAccessToken()
    logger.log("Access token generated successfully")

    // Step 2: Generate checksum if not provided
    if (!request.checksum) {
      request.checksum = generateChecksum(request)
      logger.log("Checksum generated:", request.checksum)
    }

    // Step 3: Create checkout link
    logger.log("Creating checkout link...")
    const response = await fetch(`${CLICKPESA_CONFIG.baseUrl}/third-parties/checkout-link/generate-checkout-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": accessToken, // Use generated JWT token (already includes Bearer)
      },
      body: JSON.stringify({
        totalPrice: request.totalPrice,
        orderReference: request.orderReference,
        orderCurrency: request.orderCurrency,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        ...(request.returnUrl && { returnUrl: request.returnUrl }),
        ...(request.cancelUrl && { cancelUrl: request.cancelUrl }),
        ...(request.webhookUrl && { webhookUrl: request.webhookUrl }),
        ...(request.checksum && { checksum: request.checksum })
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || 
        `ClickPesa API error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    
    if (!data.checkoutLink) {
      throw new Error("Invalid response from ClickPesa API - missing checkout link")
    }

    return {
      checkoutLink: data.checkoutLink,
      clientId: data.clientId
    }
  } catch (error) {
    console.error("ClickPesa Checkout Link Error:", error)
    
    if (error instanceof Error) {
      throw new Error(`Failed to create checkout link: ${error.message}`)
    }
    
    throw new Error("Failed to create checkout link. Please try again.")
  }
}

// Validate ClickPesa webhook signature
export const validateWebhook = (payload: any, signature: string, secretKey: string): boolean => {
  try {
    if (!secretKey) {
      console.warn('ClickPesa webhook secret key not configured')
      return false
    }

    // ClickPesa webhook signature validation
    // The signature is typically a HMAC-SHA256 hash of the payload
    const crypto = require('crypto')
    
    // Create expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(payload))
      .digest('hex')
    
    // Compare signatures using timing-safe comparison
    const providedSignature = signature.replace('sha256=', '') // Remove prefix if present
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )
  } catch (error) {
    console.error('Webhook signature validation error:', error)
    return false
  }
}

// Parse ClickPesa webhook payload with validation
export const parseWebhookPayload = (payload: any) => {
  try {
    // Validate required fields
    if (!payload.orderReference) {
      throw new Error('Missing orderReference in webhook payload')
    }
    
    if (!payload.status) {
      throw new Error('Missing status in webhook payload')
    }

    // Parse and validate webhook payload
    const webhookData = {
      orderReference: payload.orderReference,
      status: payload.status,
      amount: payload.amount || payload.totalPrice,
      currency: payload.currency || payload.orderCurrency,
      transactionId: payload.transactionId || payload.transaction_id,
      timestamp: payload.timestamp || payload.created_at,
      customerDetails: {
        name: payload.customerName || payload.customer_name,
        email: payload.customerEmail || payload.customer_email,
        phone: payload.customerPhone || payload.customer_phone
      },
      // Additional ClickPesa specific fields
      paymentMethod: payload.paymentMethod || payload.payment_method,
      gatewayResponse: payload.gatewayResponse || payload.gateway_response,
      reference: payload.reference || payload.ref
    }

    // Validate status values
    const validStatuses = ['pending', 'processing', 'completed', 'success', 'failed', 'error', 'cancelled', 'declined']
    if (!validStatuses.includes(webhookData.status.toLowerCase())) {
      console.warn(`Unknown webhook status: ${webhookData.status}`)
    }

    return webhookData
  } catch (error) {
    console.error('Webhook payload parsing error:', error)
    throw new Error(`Invalid webhook payload: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to check if ClickPesa is properly configured
export const isClickPesaConfigured = (): boolean => {
  return Boolean(CLICKPESA_CONFIG.accessToken)
}

// Test checksum generation with example data
export const testChecksumGeneration = () => {
  if (typeof window !== 'undefined') {
    logger.log("Checksum testing should be done server-side")
    return null
  }

  try {
    // Test with ClickPesa documentation example
    const testPayload1: CheckoutLinkRequest = {
      totalPrice: "100",
      orderReference: "TX123",
      orderCurrency: "USD"
    }

    // Test with our typical payload
    const testPayload2: CheckoutLinkRequest = {
      totalPrice: "25000.00",
      orderReference: "ORD-TEST-123",
      orderCurrency: "TZS",
      customerName: "John Doe",
      customerEmail: "john@example.com",
      customerPhone: "255712345678"
    }

    const checksum1 = generateChecksum(testPayload1)
    const checksum2 = generateChecksum(testPayload2)

    return {
      test1: {
        payload: testPayload1,
        checksum: checksum1
      },
      test2: {
        payload: testPayload2,
        checksum: checksum2
      }
    }
  } catch (error) {
    console.error("Checksum test error:", error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Get configuration status for debugging
export const getConfigStatus = () => {
  return {
    hasAccessToken: Boolean(CLICKPESA_CONFIG.accessToken),
    hasClientId: Boolean(CLICKPESA_CLIENT_ID),
    hasApiKey: Boolean(CLICKPESA_API_KEY),
    hasChecksumKey: Boolean(CLICKPESA_CHECKSUM_KEY),
    baseUrl: CLICKPESA_CONFIG.baseUrl,
    isLive: CLICKPESA_CONFIG.isLive,
    environment: process.env.NODE_ENV,
    clientId: CLICKPESA_CLIENT_ID ? `${CLICKPESA_CLIENT_ID.substring(0, 8)}...` : "Not configured",
    apiKey: CLICKPESA_API_KEY ? `${CLICKPESA_API_KEY.substring(0, 8)}...` : "Not configured",
    checksumKey: CLICKPESA_CHECKSUM_KEY ? `${CLICKPESA_CHECKSUM_KEY.substring(0, 8)}...` : "Not configured"
  }
}
