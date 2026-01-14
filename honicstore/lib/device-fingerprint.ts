"use client"

/**
 * Device Fingerprinting for Security
 * Prevents auto-login on new devices without explicit authentication
 */

const DEVICE_ID_KEY = 'device-fingerprint-id'
const DEVICE_VERIFIED_KEY = 'device-verified'

/**
 * Generate a unique device fingerprint
 * Uses browser characteristics that are stable but unique per device/browser
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Device fingerprint', 2, 2)
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
      window.localStorage ? 'localStorage' : 'no-localStorage',
      window.sessionStorage ? 'sessionStorage' : 'no-sessionStorage',
    ].join('|')

    // Create a simple hash
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36)
  } catch (error) {
    // Fallback to a random ID if fingerprinting fails
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}

/**
 * Get or create device ID
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = generateDeviceFingerprint()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
  } catch (error) {
    // If localStorage is not available, generate a temporary ID
    return generateDeviceFingerprint()
  }
}

/**
 * Check if current device is verified (user has explicitly logged in on this device)
 */
export function isDeviceVerified(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const verified = localStorage.getItem(DEVICE_VERIFIED_KEY)
    const deviceId = getDeviceId()
    const storedDeviceId = localStorage.getItem(DEVICE_ID_KEY)
    
    // Device is verified if:
    // 1. Verified flag is set
    // 2. Device ID matches stored ID
    return verified === 'true' && deviceId === storedDeviceId
  } catch (error) {
    return false
  }
}

/**
 * Mark device as verified (after explicit login)
 */
export function markDeviceVerified(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(DEVICE_VERIFIED_KEY, 'true')
    const deviceId = getDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  } catch (error) {
    // Ignore storage errors
  }
}

/**
 * Clear device verification (on logout)
 */
export function clearDeviceVerification(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(DEVICE_VERIFIED_KEY)
    localStorage.removeItem(DEVICE_ID_KEY)
  } catch (error) {
    // Ignore storage errors
  }
}

/**
 * Check if this is a new device (not verified)
 */
export function isNewDevice(): boolean {
  return !isDeviceVerified()
}
