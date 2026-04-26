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

const CLICKPESA_REQUEST_TIMEOUT_MS = Math.max(
  3000,
  parseInt(process.env.CLICKPESA_REQUEST_TIMEOUT_MS || '12000', 10) || 12000
)
const CLICKPESA_TOKEN_CACHE_TTL_MS = Math.max(
  60000,
  parseInt(process.env.CLICKPESA_TOKEN_CACHE_TTL_MS || '300000', 10) || 300000
)

type CredentialType = 'regular' | 'supplier'
type TokenCacheEntry = { token: string; expiresAt: number }
const clickPesaTokenCache = new Map<CredentialType, TokenCacheEntry>()
const clickPesaTokenInflight = new Map<CredentialType, Promise<string>>()
const CLICKPESA_VERIFY_CACHE_TTL_MS = Math.max(
  5000,
  parseInt(process.env.CLICKPESA_VERIFY_CACHE_TTL_MS || '20000', 10) || 20000
)
const CLICKPESA_DISTRIBUTED_LOCK_TTL_MS = Math.max(
  2000,
  parseInt(process.env.CLICKPESA_DISTRIBUTED_LOCK_TTL_MS || '15000', 10) || 15000
)
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
type VerifyCacheKey = `${CredentialType}:${string}`
type VerifyCacheEntry = { value: TransactionVerificationResult; expiresAt: number }
const clickPesaVerifyCache = new Map<VerifyCacheKey, VerifyCacheEntry>()
const clickPesaVerifyInflight = new Map<VerifyCacheKey, Promise<TransactionVerificationResult>>()

async function upstashCommand(command: string[]): Promise<any> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash Redis is not configured')
  }

  const response = await fetch(UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  if (!response.ok) {
    throw new Error(`Upstash request failed: ${response.status}`)
  }

  const payload = await response.json()
  if (payload?.error) {
    throw new Error(String(payload.error))
  }

  return payload?.result
}

async function getDistributedJson<T>(key: string): Promise<T | null> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null
  try {
    const raw = await upstashCommand(['GET', key])
    if (!raw || typeof raw !== 'string') return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function setDistributedJson(key: string, value: unknown, ttlMs: number): Promise<void> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return
  try {
    await upstashCommand(['SET', key, JSON.stringify(value), 'PX', String(ttlMs)])
  } catch {
    // keep local fallback behavior
  }
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tryAcquireDistributedLock(
  lockKey: string,
  token: string,
  ttlMs: number
): Promise<boolean> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return false
  try {
    const result = await upstashCommand(['SET', lockKey, token, 'NX', 'PX', String(ttlMs)])
    return result === 'OK'
  } catch {
    return false
  }
}

async function releaseDistributedLock(lockKey: string, token: string): Promise<void> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return
  try {
    const current = await upstashCommand(['GET', lockKey])
    if (current === token) {
      await upstashCommand(['DEL', lockKey])
    }
  } catch {
    // ignore lock release errors
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
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
  const credentialType: CredentialType = useSupplierCredentials ? 'supplier' : 'regular'
  const now = Date.now()
  const distributedTokenKey = `clickpesa:token:${credentialType}`
  const distributedTokenLockKey = `clickpesa:lock:token:${credentialType}`
  const distributedToken = await getDistributedJson<TokenCacheEntry>(distributedTokenKey)
  if (distributedToken && distributedToken.expiresAt > now && distributedToken.token) {
    return distributedToken.token
  }

  const cached = clickPesaTokenCache.get(credentialType)
  if (cached && cached.expiresAt > now) {
    return cached.token
  }

  const inflight = clickPesaTokenInflight.get(credentialType)
  if (inflight) {
    return inflight
  }

  let distributedLockToken: string | null = null
  const candidateLockToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const hasDistributedLock = await tryAcquireDistributedLock(
    distributedTokenLockKey,
    candidateLockToken,
    CLICKPESA_DISTRIBUTED_LOCK_TTL_MS
  )
  if (hasDistributedLock) {
    distributedLockToken = candidateLockToken
  } else if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    // Another instance likely generating token; briefly wait for shared cache fill.
    for (let i = 0; i < 8; i++) {
      await waitMs(250)
      const waited = await getDistributedJson<TokenCacheEntry>(distributedTokenKey)
      if (waited && waited.expiresAt > Date.now() && waited.token) {
        return waited.token
      }
    }
  }

  const tokenPromise = (async () => {
  try {
    // Select credentials based on useSupplierCredentials flag
    const apiKey = useSupplierCredentials ? CLICKPESA_API_SUPPLIER_KEY : CLICKPESA_API_KEY
    const clientId = useSupplierCredentials ? CLICKPESA_CLIENT_SUPPLIER_ID : CLICKPESA_CLIENT_ID
    
    if (!apiKey || !clientId) {
      throw new Error(`Missing ClickPesa credentials for ${credentialType} checkout. Please configure ${useSupplierCredentials ? 'CLICKPESA_API_SUPPLIER_KEY and CLICKPESA_CLIENT_SUPPLIER_ID' : 'CLICKPESA_API_KEY and CLICKPESA_CLIENT_ID'}`)
    }

    const response = await fetchWithTimeout(`${CLICKPESA_CONFIG.baseUrl}/third-parties/generate-token`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "client-id": clientId,
        "Content-Type": "application/json"
      },
    }, CLICKPESA_REQUEST_TIMEOUT_MS)

    if (!response.ok) {
      const responseText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }

      // Log detailed error for debugging (without exposing credentials)
      logger.error("ClickPesa token generation failed:", {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        baseUrl: CLICKPESA_CONFIG.baseUrl,
        endpoint: `${CLICKPESA_CONFIG.baseUrl}/third-parties/generate-token`
      })

      throw new Error(
        errorData.message || 
        `ClickPesa token generation error: ${response.status} ${response.statusText}`
      )
    }

    const responseText = await response.text()

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

    clickPesaTokenCache.set(credentialType, {
      token: data.token,
      expiresAt: Date.now() + CLICKPESA_TOKEN_CACHE_TTL_MS,
    })
    await setDistributedJson(distributedTokenKey, {
      token: data.token,
      expiresAt: Date.now() + CLICKPESA_TOKEN_CACHE_TTL_MS,
    }, CLICKPESA_TOKEN_CACHE_TTL_MS)
    return data.token
  } catch (error) {
    // Log detailed error server-side but throw generic error for client
    logger.error("Failed to generate access token:", error instanceof Error ? error.message : String(error))
    throw new Error("Failed")
  }
  })().finally(async () => {
    if (distributedLockToken) {
      await releaseDistributedLock(distributedTokenLockKey, distributedLockToken)
    }
    clickPesaTokenInflight.delete(credentialType)
  })

  clickPesaTokenInflight.set(credentialType, tokenPromise)
  return tokenPromise
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
    
    const response = await fetchWithTimeout(`${CLICKPESA_CONFIG.baseUrl}/third-parties/checkout-link/generate-checkout-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(requestPayload),
    }, CLICKPESA_REQUEST_TIMEOUT_MS)


    if (!response.ok) {
      const responseText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }
      
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
    const providedSignature = signature
      .replace(/^sha256=/i, '')
      .replace(/^bearer\s+/i, '')
      .trim()
      .toLowerCase()
    const isHex = /^[a-f0-9]+$/i.test(providedSignature)
    if (!isHex) return false

    const expected = Buffer.from(expectedSignature, 'hex')
    const provided = Buffer.from(providedSignature, 'hex')
    if (expected.length !== provided.length) return false

    return crypto.timingSafeEqual(expected, provided)
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
  const credentialType: CredentialType = useSupplierCredentials ? 'supplier' : 'regular'
  const cacheKey: VerifyCacheKey = `${credentialType}:${orderReference}`
  const now = Date.now()
  const distributedVerifyKey = `clickpesa:verify:${cacheKey}`
  const distributedVerifyLockKey = `clickpesa:lock:verify:${cacheKey}`
  const distributedCached = await getDistributedJson<VerifyCacheEntry>(distributedVerifyKey)
  if (distributedCached && distributedCached.expiresAt > now) {
    return distributedCached.value
  }

  const cached = clickPesaVerifyCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const inflight = clickPesaVerifyInflight.get(cacheKey)
  if (inflight) {
    return inflight
  }

  let distributedLockToken: string | null = null
  const candidateLockToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const hasDistributedLock = await tryAcquireDistributedLock(
    distributedVerifyLockKey,
    candidateLockToken,
    CLICKPESA_DISTRIBUTED_LOCK_TTL_MS
  )
  if (hasDistributedLock) {
    distributedLockToken = candidateLockToken
  } else if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    // Another instance likely verifying now; briefly wait for shared cache fill.
    for (let i = 0; i < 8; i++) {
      await waitMs(250)
      const waited = await getDistributedJson<VerifyCacheEntry>(distributedVerifyKey)
      if (waited && waited.expiresAt > Date.now()) {
        return waited.value
      }
    }
  }

  const verifyPromise = (async () => {
  try {
    // Step 1: Generate access token with appropriate credentials
    const accessToken = await generateAccessToken(useSupplierCredentials)
    
    // Step 2: Query payment status from ClickPesa API
    const response = await fetchWithTimeout(
      `${CLICKPESA_CONFIG.baseUrl}/third-parties/payments/${orderReference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      },
      CLICKPESA_REQUEST_TIMEOUT_MS
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
  })()

  clickPesaVerifyInflight.set(cacheKey, verifyPromise)
  try {
    const result = await verifyPromise
    clickPesaVerifyCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + CLICKPESA_VERIFY_CACHE_TTL_MS,
    })
    await setDistributedJson(distributedVerifyKey, {
      value: result,
      expiresAt: Date.now() + CLICKPESA_VERIFY_CACHE_TTL_MS,
    }, CLICKPESA_VERIFY_CACHE_TTL_MS)
    return result
  } finally {
    if (distributedLockToken) {
      await releaseDistributedLock(distributedVerifyLockKey, distributedLockToken)
    }
    clickPesaVerifyInflight.delete(cacheKey)
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
