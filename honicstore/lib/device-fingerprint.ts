"use client"

/**
 * Device Fingerprinting for Security
 * Prevents auto-login on new devices without explicit authentication
 */

const DEVICE_ID_KEY = 'device-fingerprint-id'
const DEVICE_VERIFIED_KEY = 'device-verified'
/** Set when the user signed in without "Keep me signed in" */
const SESSION_ONLY_KEY = 'honic-session-only'
/** Browser-session cookie: shared by every tab, deleted when the browser closes (unlike sessionStorage, which is per tab) */
const BROWSER_SESSION_COOKIE = 'honic_browser_session'
const hasBrowserSessionCookie = () => typeof document !== 'undefined' && document.cookie.split('; ').includes(`${BROWSER_SESSION_COOKIE}=1`)
const setBrowserSessionCookie = (on: boolean) => {
  if (typeof document === 'undefined') return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = on
    ? `${BROWSER_SESSION_COOKIE}=1; path=/; SameSite=Lax${secure}`
    : `${BROWSER_SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax${secure}`
}

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
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0,
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
    // "Keep me signed in" off: valid while this browser session lasts (all tabs), gone when the browser closes
    if (localStorage.getItem(SESSION_ONLY_KEY) === '1') return hasBrowserSessionCookie()
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
export function markDeviceVerified(remember: boolean = true): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (remember) {
      localStorage.setItem(DEVICE_VERIFIED_KEY, 'true')
      localStorage.setItem(DEVICE_ID_KEY, getDeviceId())
      localStorage.removeItem(SESSION_ONLY_KEY)
      setBrowserSessionCookie(false)
    } else {
      // Signed in for this browser session only
      localStorage.removeItem(DEVICE_VERIFIED_KEY)
      localStorage.setItem(SESSION_ONLY_KEY, '1')
      setBrowserSessionCookie(true)
    }
  } catch (error) {
    // Ignore storage errors
  }
}

/**
 * True when the last sign-in was "don't keep me signed in" and that browser session has ended
 * (the server cookies may still exist, so the caller should sign out on the server too).
 */
export function sessionOnlyExpired(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SESSION_ONLY_KEY) === '1' && !hasBrowserSessionCookie()
  } catch {
    return false
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
    localStorage.removeItem(SESSION_ONLY_KEY)
    setBrowserSessionCookie(false)
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
