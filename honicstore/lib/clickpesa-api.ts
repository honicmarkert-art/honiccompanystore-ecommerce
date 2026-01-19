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
  description?: string
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
  baseUrl: process.env.CLICKPESA_API_URL || process.env.NEXT_PUBLIC_CLICKPESA_API_URL || "https://api.clickpesa.com",
  accessToken: process.env.CLICKPESA_CLIENT_ID || "", // Use Client ID as access token
  isLive: process.env.NODE_ENV === "production"
}

// ClickPesa API Keys - Regular checkout
export const CLICKPESA_API_KEY = process.env.CLICKPESA_API_KEY || ""
export const CLICKPESA_CLIENT_ID = process.env.CLICKPESA_CLIENT_ID || ""

// ClickPesa API Keys - Supplier upgrades
export const CLICKPESA_API_SUPPLIER_KEY = process.env.CLICKPESA_API_SUPPLIER_KEY || ""
export const CLICKPESA_CLIENT_SUPPLIER_ID = process.env.CLICKPESA_CLIENT_SUPPLIER_ID || ""

// Shared keys (used by both)
export const CLICKPESA_CHECKSUM_KEY = process.env.CLICKPESA_CHECKSUM_KEY || ""

// Normalize order reference ID for ClickPesa (consistent across all endpoints)
// Removes hyphens and other non-alphanumeric characters, preserves case
// This ensures consistent matching between checkout link creation and webhook handling
export const normalizeOrderReference = (referenceId: string): string => {
  if (!referenceId) return referenceId
  // Remove hyphens and other non-alphanumeric characters, preserve case
  return referenceId.replace(/[^A-Za-z0-9]/g, '')
}

// Generate unique order reference for ClickPesa
export const generateOrderReference = (orderId: string): string => {
  // Return normalized order ID for ClickPesa (webhooks will use this)
  // ClickPesa will display a shorter version to customers
  return normalizeOrderReference(orderId)
}

// Generate display reference for customers (10 characters)
export const generateDisplayReference = (orderId: string): string => {
  // Generate shorter reference for customer display
  const cleanOrderId = normalizeOrderReference(orderId)
  return cleanOrderId.substring(0, 10)
}

// Format amount for ClickPesa (ensure it's a string with proper decimal places)
export const formatAmountForClickPesa = (amount: number): string => {
  return amount.toFixed(2)
}

// Format phone number for ClickPesa (remove + and ensure country code)
export const formatPhoneForClickPesa = (phone: string): string => {
  if (!phone) return phone
  
  // Use the new validation utility
  const { formatPhoneForPayment } = require('./phone-validation')
  try {
    return formatPhoneForPayment(phone)
  } catch (error) {
    // Fallback to old method if validation fails
    logger.error('Phone validation failed, using fallback:', error)
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
}

// Generate ClickPesa access token
// useSupplierCredentials: true = use supplier credentials, false = use regular checkout credentials
export const generateAccessToken = async (useSupplierCredentials: boolean = false): Promise<string> => {
  try {
    // Select credentials based on useSupplierCredentials flag
    const apiKey = useSupplierCredentials ? CLICKPESA_API_SUPPLIER_KEY : CLICKPESA_API_KEY
    const clientId = useSupplierCredentials ? CLICKPESA_CLIENT_SUPPLIER_ID : CLICKPESA_CLIENT_ID
    const credentialType = useSupplierCredentials ? 'supplier' : 'regular'
    
    logger.log(`ClickPesa: Generating access token (${credentialType})...`, {
      baseUrl: CLICKPESA_CONFIG.baseUrl,
      hasApiKey: Boolean(apiKey),
      hasClientId: Boolean(clientId),
      credentialType: credentialType
    })

    if (!apiKey || !clientId) {
      throw new Error(`Missing ClickPesa credentials for ${credentialType} checkout. Please configure ${useSupplierCredentials ? 'CLICKPESA_API_SUPPLIER_KEY and CLICKPESA_CLIENT_SUPPLIER_ID' : 'CLICKPESA_API_KEY and CLICKPESA_CLIENT_ID'}`)
    }

    const response = await fetch(`${CLICKPESA_CONFIG.baseUrl}/third-parties/generate-token`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "client-id": clientId,
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
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }

      // Log detailed error for debugging
      logger.error("ClickPesa token generation failed:", {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        clientIdPrefix: clientId.substring(0, 8) + '...',
        baseUrl: CLICKPESA_CONFIG.baseUrl,
        endpoint: `${CLICKPESA_CONFIG.baseUrl}/third-parties/generate-token`
      })

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
      logger.error("ClickPesa: Failed to parse token response:", {
        responseText: responseText.substring(0, 500),
        parseError: parseError instanceof Error ? parseError.message : String(parseError)
      })
      throw new Error("Invalid JSON response from ClickPesa token generation API")
    }
    
    if (!data.success || !data.token) {
      logger.error("ClickPesa: Invalid token response structure:", {
        success: data.success,
        hasToken: !!data.token,
        responseData: data
      })
      throw new Error("Invalid response from ClickPesa token generation API")
    }

    logger.log("ClickPesa: Access token generated successfully")
    return data.token
  } catch (error) {
    // Log detailed error server-side but throw generic error for client
    logger.error("Failed to generate access token:", error instanceof Error ? error.message : String(error))
    throw new Error("Failed")
  }
}

// Canonicalize payload recursively - sort all object keys alphabetically at every nesting level
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(canonicalize)
  }
  
  // Recursively sort object keys alphabetically
  return Object.keys(obj)
    .sort()
    .reduce((acc: Record<string, any>, key: string) => {
      acc[key] = canonicalize(obj[key])
      return acc
    }, {})
}

// Generate checksum using official ClickPesa algorithm (Updated 2024)
// New method: Recursive canonicalization + JSON serialization + HMAC-SHA256
export const generateChecksum = (payload: CheckoutLinkRequest): string => {
  try {
    if (typeof window !== 'undefined') {
      throw new Error("Checksum generation should only happen server-side")
    }
    
    // Step 1: Create payload object (exclude checksum and checksumMethod fields)
    const checksumPayload: Record<string, any> = {}
    
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
    if (payload.description) checksumPayload.description = payload.description
    
    // Step 2: Recursively canonicalize payload (sort keys alphabetically at all nesting levels)
    const canonicalPayload = canonicalize(checksumPayload)
    
    // Step 3: Serialize to compact JSON (no extra whitespace)
    const payloadString = JSON.stringify(canonicalPayload)
    
    // Step 4: Generate HMAC-SHA256 hash (optimized: removed verbose logging)
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', CLICKPESA_CHECKSUM_KEY)
    hmac.update(payloadString)
    const checksum = hmac.digest('hex')
    
    return checksum
  } catch (error) {
    logger.error("Checksum generation error:", error instanceof Error ? error.message : String(error))
    throw new Error(`Failed to generate checksum: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Create ClickPesa checkout link
// useSupplierCredentials: true = use supplier credentials, false = use regular checkout credentials
export const createCheckoutLink = async (
  request: CheckoutLinkRequest,
  useSupplierCredentials: boolean = false
): Promise<CheckoutLinkResponse> => {
  try {
    // Step 1: Generate access token with appropriate credentials
    const credentialType = useSupplierCredentials ? 'supplier' : 'regular'
    const accessToken = await generateAccessToken(useSupplierCredentials)

    // Step 2: Generate checksum if not provided
    if (!request.checksum) {
      request.checksum = generateChecksum(request)
    }

    // Step 3: Create checkout link
    const requestPayload = {
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
    }
    
    const authHeader = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
    
    const response = await fetch(`${CLICKPESA_CONFIG.baseUrl}/third-parties/checkout-link/generate-checkout-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(requestPayload),
    })


    if (!response.ok) {
      const responseText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }
      
        errorData: errorData
      })
      // Log detailed error server-side but throw generic error for client
      logger.error("ClickPesa checkout link creation failed:", {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        endpoint: `${CLICKPESA_CONFIG.baseUrl}/third-parties/checkout-link/generate-checkout-url`,
        requestPayload: {
          totalPrice: request.totalPrice,
          orderReference: request.orderReference,
          orderCurrency: request.orderCurrency,
          hasChecksum: !!request.checksum
        }
      })
      throw new Error("Failed")
    }

    const data = await response.json()
    
    if (!data.checkoutLink) {
      logger.error("Invalid response from ClickPesa API - missing checkout link")
      throw new Error("Failed")
    }

    return {
      checkoutLink: data.checkoutLink,
      clientId: data.clientId
    }
  } catch (error) {
    // Log detailed error server-side but throw generic error for client
    logger.error("Failed to create checkout link:", error instanceof Error ? error.message : String(error))
    throw new Error("Failed")
  }
}

// Validate ClickPesa webhook signature
// Updated to match ClickPesa's new checksum method: recursive canonicalization + JSON.stringify
export const validateWebhook = (payload: any, signature: string, secretKey: string): boolean => {
  try {
    if (!secretKey) {
      return false
    }

    // ClickPesa webhook signature validation using new method
    // 1. Exclude checksum and checksumMethod fields from payload
    const payloadForValidation = { ...payload }
    delete payloadForValidation.checksum
    delete payloadForValidation.checksumMethod
    
    // 2. Recursively canonicalize payload (sort keys alphabetically at all levels)
    const canonicalPayload = canonicalize(payloadForValidation)
    
    // 3. Serialize to compact JSON
    const payloadString = JSON.stringify(canonicalPayload)
    
    // 4. Generate HMAC-SHA256 hash
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payloadString)
      .digest('hex')
    
    // 5. Compare signatures using timing-safe comparison
    const providedSignature = signature.replace('sha256=', '').trim() // Remove prefix if present
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )
  } catch (error) {
    logger.error("Webhook signature validation error:", error instanceof Error ? error.message : String(error))
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
      }

    return webhookData
  } catch (error) {
    throw new Error(`Invalid webhook payload: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to check if ClickPesa is properly configured
// Checks both regular and supplier credentials
export const isClickPesaConfigured = (): boolean => {
  const hasRegularCredentials = Boolean(CLICKPESA_CLIENT_ID && CLICKPESA_API_KEY)
  const hasSupplierCredentials = Boolean(CLICKPESA_CLIENT_SUPPLIER_ID && CLICKPESA_API_SUPPLIER_KEY)
  const hasSharedKeys = Boolean(CLICKPESA_CHECKSUM_KEY)
  
  // At least one set of credentials should be configured
  return (hasRegularCredentials || hasSupplierCredentials) && hasSharedKeys
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
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Verify transaction status via ClickPesa API
// This is a critical security step - always verify transactions with ClickPesa before marking as confirmed
export interface TransactionVerificationResult {
  verified: boolean
  status: string
  transactionId?: string
  amount?: number
  currency?: string
  message?: string
  error?: string
}

export const verifyTransactionWithClickPesa = async (
  orderReference: string,
  useSupplierCredentials: boolean = false
): Promise<TransactionVerificationResult> => {
  try {
    const credentialType = useSupplierCredentials ? 'supplier' : 'regular'
    logger.log(`🔍 Verifying transaction with ClickPesa API (${credentialType}):`, {
      orderReference,
      baseUrl: CLICKPESA_CONFIG.baseUrl,
      credentialType: credentialType
    })

    // Step 1: Generate access token with appropriate credentials
    const accessToken = await generateAccessToken(useSupplierCredentials)
    
    // Step 2: Query payment status from ClickPesa API
    const response = await fetch(
      `${CLICKPESA_CONFIG.baseUrl}/third-parties/payments/${orderReference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('❌ ClickPesa API verification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        orderReference
      })
      
      return {
        verified: false,
        status: 'UNKNOWN',
        error: `ClickPesa API error: ${response.status} ${response.statusText}`
      }
    }

    const transactionData = await response.json()
    
    logger.log('✅ ClickPesa API verification response:', {
      orderReference,
      status: transactionData.status,
      transactionId: transactionData.id,
      amount: transactionData.collectedAmount,
      currency: transactionData.collectedCurrency
    })

    // Step 3: Verify transaction status
    const status = transactionData.status?.toUpperCase() || 'UNKNOWN'
    const isSuccess = status === 'SUCCESS' || status === 'SETTLED'
    const isFailed = status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED' || status === 'DECLINED'
    
    return {
      verified: true,
      status: status,
      transactionId: transactionData.id,
      amount: transactionData.collectedAmount,
      currency: transactionData.collectedCurrency,
      message: transactionData.message
    }
  } catch (error) {
    logger.error('❌ Error verifying transaction with ClickPesa API:', {
      orderReference,
      error: error instanceof Error ? error.message : String(error)
    })
    
    return {
      verified: false,
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error during verification'
    }
  }
}

// Get configuration status for debugging
export const getConfigStatus = () => {
  return {
    baseUrl: CLICKPESA_CONFIG.baseUrl,
    isLive: CLICKPESA_CONFIG.isLive,
    environment: process.env.NODE_ENV,
    // Regular checkout credentials
    regular: {
      hasClientId: Boolean(CLICKPESA_CLIENT_ID),
      hasApiKey: Boolean(CLICKPESA_API_KEY),
    clientId: CLICKPESA_CLIENT_ID ? `${CLICKPESA_CLIENT_ID.substring(0, 8)}...` : "Not configured",
      apiKey: CLICKPESA_API_KEY ? `${CLICKPESA_API_KEY.substring(0, 8)}...` : "Not configured"
    },
    // Supplier upgrade credentials
    supplier: {
      hasClientId: Boolean(CLICKPESA_CLIENT_SUPPLIER_ID),
      hasApiKey: Boolean(CLICKPESA_API_SUPPLIER_KEY),
      clientId: CLICKPESA_CLIENT_SUPPLIER_ID ? `${CLICKPESA_CLIENT_SUPPLIER_ID.substring(0, 8)}...` : "Not configured",
      apiKey: CLICKPESA_API_SUPPLIER_KEY ? `${CLICKPESA_API_SUPPLIER_KEY.substring(0, 8)}...` : "Not configured"
    },
    // Shared credentials
    shared: {
      hasChecksumKey: Boolean(CLICKPESA_CHECKSUM_KEY),
    checksumKey: CLICKPESA_CHECKSUM_KEY ? `${CLICKPESA_CHECKSUM_KEY.substring(0, 8)}...` : "Not configured"
    }
  }
}
