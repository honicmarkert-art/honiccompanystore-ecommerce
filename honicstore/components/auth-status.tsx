"use client"

import { useGlobalAuth } from '@/hooks/use-global-auth'
import { Badge } from '@/components/ui/badge'
import { Shield, User, Loader2 } from 'lucide-react'

interface AuthStatusProps {
  showDetails?: boolean
  className?: string
}

export function AuthStatus({ showDetails = false, className = '' }: AuthStatusProps) {
  const { 
    isAuthenticated, 
    loading, 
    isAdmin, 
    getUserDisplayName, 
    getUserRole,
    user 
  } = useGlobalAuth()

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <User className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Not signed in</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {isAdmin ? (
        <Shield className="w-4 h-4 text-purple-500" />
      ) : (
        <User className="w-4 h-4 text-blue-500" />
      )}
      
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {getUserDisplayName()}
        </span>
        
        {showDetails && (
          <div className="flex items-center space-x-2">
            <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
              {getUserRole()}
            </Badge>
            {user?.email && (
              <span className="text-xs text-gray-500">
                {user.email}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Quick status indicator
export function AuthIndicator() {
  const { isAuthenticated, loading, isAdmin } = useGlobalAuth()

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
  }

  if (!isAuthenticated) {
    return <User className="w-4 h-4 text-gray-400" />
  }

  return isAdmin ? (
    <Shield className="w-4 h-4 text-purple-500" />
  ) : (
    <User className="w-4 h-4 text-blue-500" />
  )
} 