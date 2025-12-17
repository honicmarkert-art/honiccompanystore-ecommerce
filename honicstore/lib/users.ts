import { hashPassword } from './auth'

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  password: string
  isVerified: boolean
  isActive: boolean
  createdAt: Date
  lastLogin?: Date
  loginAttempts: number
  lockedUntil?: Date
  profile?: {
    avatar?: string
    phone?: string
    address?: string
    bio?: string
  }
}

// Initial admin and demo users
const initialUsers: User[] = [
  {
    id: 'admin_001',
    email: 'admin@honic.com',
    name: 'Admin User',
    role: 'admin',
    password: hashPassword('Admin123!'),
    isVerified: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
    loginAttempts: 0,
    profile: {
      avatar: '/placeholder-user.jpg',
      phone: '+1234567890',
      address: 'Admin Address',
      bio: 'System Administrator'
    }
  },
  {
    id: 'user_001',
    email: 'user@honic.com',
    name: 'Regular User',
    role: 'user',
    password: hashPassword('User123!'),
    isVerified: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
    loginAttempts: 0,
    profile: {
      avatar: '/placeholder-user.jpg',
      phone: '+1234567891',
      address: 'User Address',
      bio: 'Regular customer'
    }
  },
  {
    id: 'user_002',
    email: 'michaelmwebesa3@gmail.com',
    name: 'Michael Mwebesa',
    role: 'user',
    password: hashPassword('Angela@2002'),
    isVerified: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
    loginAttempts: 0,
    profile: {
      avatar: '/placeholder-user.jpg',
      phone: '+1234567892',
      address: 'Michael Address',
      bio: 'Customer'
    }
  }
]

// In-memory user storage (in production, use database)
export const users: User[] = [...initialUsers]

// User management functions
export function findUserByEmail(email: string): User | undefined {
  return users.find(user => user.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id: string): User | undefined {
  return users.find(user => user.id === id)
}

export function createUser(userData: Omit<User, 'id' | 'createdAt' | 'loginAttempts'>): User {
  const newUser: User = {
    ...userData,
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    loginAttempts: 0
  }
  
  users.push(newUser)
  return newUser
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const userIndex = users.findIndex(user => user.id === id)
  if (userIndex === -1) return null
  
  users[userIndex] = { ...users[userIndex], ...updates }
  return users[userIndex]
}

export function deleteUser(id: string): boolean {
  const userIndex = users.findIndex(user => user.id === id)
  if (userIndex === -1) return false
  
  users.splice(userIndex, 1)
  return true
}

export function getAllUsers(): User[] {
  return users.map(user => ({
    ...user,
    password: '[HIDDEN]' // Don't expose passwords
  }))
}

export function getActiveUsers(): User[] {
  return users.filter(user => user.isActive && user.isVerified)
}

// Login attempt tracking
export function recordFailedLoginAttempt(email: string): void {
  const user = findUserByEmail(email)
  if (user) {
    user.loginAttempts += 1
    
    // Lock account after 5 failed attempts for 15 minutes
    if (user.loginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }
  }
}

export function resetLoginAttempts(email: string): void {
  const user = findUserByEmail(email)
  if (user) {
    user.loginAttempts = 0
    user.lockedUntil = undefined
    user.lastLogin = new Date()
  }
}

export function isAccountLocked(email: string): boolean {
  const user = findUserByEmail(email)
  if (!user) return false
  
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return true
  }
  
  return false
}

// User validation
export function validateUserData(userData: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!userData.email || !userData.email.includes('@')) {
    errors.push('Valid email is required')
  }
  
  if (!userData.name || userData.name.length < 2) {
    errors.push('Name must be at least 2 characters long')
  }
  
  if (!userData.password || userData.password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (userData.role && !['user', 'admin'].includes(userData.role)) {
    errors.push('Invalid role specified')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
} 

