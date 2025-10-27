export interface UserSession {
  id: string
  email: string
  role: 'user' | 'admin'
  isAuthenticated: boolean
  profile?: any
}

export const SECURITY_CONFIG = {
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute in milliseconds
  RATE_LIMIT_MAX_REQUESTS: 5
}