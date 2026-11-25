"use client"

import { AuthProvider } from '@/contexts/auth-context'

// AuthProvider is imported directly. It used to be loaded with
// `dynamic(..., { ssr: false })`, which wrapped the whole app and made every page
// skip server rendering (shoppers saw a spinner until all JS had loaded).
// The provider only touches window/localStorage inside effects, so it is SSR-safe.
export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
