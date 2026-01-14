/**
 * Client-side state manager for preserving component state across navigations
 * Uses sessionStorage to persist state that survives page navigations
 */

const STATE_PREFIX = 'client_state_'
const MAX_STATE_AGE = 30 * 60 * 1000 // 30 minutes

interface StateEntry<T> {
  data: T
  timestamp: number
  pathname: string
}

/**
 * Save component state to sessionStorage
 */
export function saveClientState<T>(key: string, data: T, pathname?: string): void {
  if (typeof window === 'undefined') return

  try {
    const entry: StateEntry<T> = {
      data,
      timestamp: Date.now(),
      pathname: pathname || window.location.pathname
    }
    sessionStorage.setItem(`${STATE_PREFIX}${key}`, JSON.stringify(entry))
  } catch (e) {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Load component state from sessionStorage
 */
export function loadClientState<T>(key: string, pathname?: string): T | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = sessionStorage.getItem(`${STATE_PREFIX}${key}`)
    if (!stored) return null

    const entry: StateEntry<T> = JSON.parse(stored)
    const now = Date.now()

    // Check if state is expired
    if (now - entry.timestamp > MAX_STATE_AGE) {
      sessionStorage.removeItem(`${STATE_PREFIX}${key}`)
      return null
    }

    // Optionally verify pathname matches
    if (pathname && entry.pathname !== pathname) {
      return null
    }

    return entry.data
  } catch (e) {
    // Ignore storage errors
    return null
  }
}

/**
 * Clear client state for a specific key
 */
export function clearClientState(key: string): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(`${STATE_PREFIX}${key}`)
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Clear all client states
 */
export function clearAllClientStates(): void {
  if (typeof window === 'undefined') return

  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach(key => {
      if (key.startsWith(STATE_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Get all client state keys
 */
export function getClientStateKeys(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const keys = Object.keys(sessionStorage)
    return keys
      .filter(key => key.startsWith(STATE_PREFIX))
      .map(key => key.replace(STATE_PREFIX, ''))
  } catch (e) {
    return []
  }
}
