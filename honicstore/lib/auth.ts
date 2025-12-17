import { createHash, randomBytes } from 'crypto'

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

// Password hashing
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(password + salt).digest('hex')
  return salt + ':' + hash
}

export function comparePassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':')
  const passwordHash = createHash('sha256').update(password + salt).digest('hex')
  return hash === passwordHash
}

// JWT Token generation (simplified for demo)
export function generateToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = createHash('sha256').update(header + '.' + payloadStr + JWT_SECRET).digest('base64')
  return header + '.' + payloadStr + '.' + signature
}

// JWT Token verification
export function verifyToken(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [header, payload, signature] = parts
    const expectedSignature = createHash('sha256').update(header + '.' + payload + JWT_SECRET).digest('base64')
    
    if (signature !== expectedSignature) return null
    
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString())
    return decodedPayload
  } catch (error) {
    return null
  }
}

// Extract token from request
export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

// Validation helpers
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
} 
 
 
 
 

