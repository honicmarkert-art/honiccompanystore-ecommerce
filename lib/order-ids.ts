import { v4 as uuidv4 } from 'uuid'
import { nanoid } from 'nanoid'

/**
 * Generate dual ID system for orders:
 * - Reference ID (UUID): Globally unique, secure, used internally
 * - Pickup ID (Date + Nanoid): Short, readable, unique enough for daily operations
 */

export interface OrderIds {
  referenceId: string // UUID for internal tracking
  pickupId: string    // Date + Nanoid for customer display
}

/**
 * Generate both Reference ID and Pickup ID for an order
 */
export function generateOrderIds(): OrderIds {
  // Generate Reference ID (UUID) - globally unique, secure
  const referenceId = uuidv4()
  
  // Generate Pickup ID - Date + Nanoid (short, readable)
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '') // HHMMSS
  const nanoId = nanoid(8) // 8-character nanoid
  
  const pickupId = `${dateStr}${timeStr}${nanoId}` // Format: YYYYMMDDHHMMSS + 8-char nanoid
  
  return {
    referenceId,
    pickupId
  }
}

/**
 * Format Pickup ID for display (add separators for readability)
 */
export function formatPickupId(pickupId: string): string {
  // Format: YYYYMMDD-HHMMSS-XXXX
  if (pickupId.length >= 22) {
    return `${pickupId.slice(0, 8)}-${pickupId.slice(8, 14)}-${pickupId.slice(14)}`
  }
  return pickupId
}

/**
 * Parse Pickup ID to extract date information
 */
export function parsePickupId(pickupId: string): { date: string; time: string; nanoId: string } {
  const cleanId = pickupId.replace(/-/g, '')
  
  if (cleanId.length >= 22) {
    return {
      date: cleanId.slice(0, 8), // YYYYMMDD
      time: cleanId.slice(8, 14), // HHMMSS
      nanoId: cleanId.slice(14) // 8-char nanoid
    }
  }
  
  return {
    date: '',
    time: '',
    nanoId: cleanId
  }
}

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Validate if a string is a valid Pickup ID
 */
export function isValidPickupId(str: string): boolean {
  const cleanId = str.replace(/-/g, '')
  return cleanId.length === 22 && /^[0-9a-zA-Z]+$/.test(cleanId)
}








