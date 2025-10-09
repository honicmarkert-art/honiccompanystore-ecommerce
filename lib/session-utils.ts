// Client-side session utilities

export function setSessionCookie(userId: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `sb-auth-token=${userId}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
  }
}

export function getSessionCookie(): string | null {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('sb-auth-token='))
    return sessionCookie ? sessionCookie.split('=')[1] : null
  }
  return null
}

export function clearSessionCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }
}

export function hasSessionCookie(): boolean {
  return getSessionCookie() !== null
}
