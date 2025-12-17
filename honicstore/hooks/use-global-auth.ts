"use client"

import { useAuth } from '@/contexts/auth-context'

// Enhanced hook that provides additional utility functions
export function useGlobalAuth() {
  const auth = useAuth()
  
  return {
    ...auth,
    // Utility functions
    canAccessAdmin: () => auth.isAuthenticated && auth.isAdmin,
    canAccessUser: () => auth.isAuthenticated,
    getUserDisplayName: () => auth.user?.name || auth.user?.email || 'User',
    getUserRole: () => auth.user?.role || 'user',
    isProfileComplete: () => {
      if (!auth.user?.profile) return false
      return !!(auth.user.profile.full_name && auth.user.profile.phone)
    },
    // Quick checks
    isLoggedIn: auth.isAuthenticated,
    isAdminUser: auth.isAdmin,
    hasProfile: !!auth.user?.profile,
    // User info shortcuts
    userId: auth.user?.id,
    userEmail: auth.user?.email,
    userName: auth.user?.name,
    userProfile: auth.user?.profile,
  }
}

// Hook for role-based conditional rendering
export function useAuthGuard(requireAdmin = false) {
  const auth = useAuth()
  
  return {
    canAccess: requireAdmin ? auth.isAdmin : auth.isAuthenticated,
    isLoading: auth.loading,
    isAuthenticated: auth.isAuthenticated,
    isAdmin: auth.isAdmin,
    user: auth.user,
  }
} 