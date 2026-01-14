"use client"

import dynamic from 'next/dynamic'

// Client Component wrapper for AuthProvider with dynamic import
// This prevents chunk loading issues by code-splitting the auth context
const AuthProvider = dynamic(
  () => import('@/contexts/auth-context').then((mod) => ({ default: mod.AuthProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }
)

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
