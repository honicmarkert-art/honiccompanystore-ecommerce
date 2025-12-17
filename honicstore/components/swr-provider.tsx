"use client"

import { SWRConfig } from 'swr'
import { logger } from '@/lib/logger'

interface SWRProviderProps {
  children: React.ReactNode
}

/**
 * SWR Provider for global configuration
 * 
 * Features:
 * - Global error handling
 * - Rate limiting configuration
 * - Cache configuration
 * - Revalidation settings
 */
export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        // Global error handler
        onError: (error, key) => {
          console.error('SWR Global Error:', error, 'for key:', key)
          
          // Handle rate limiting globally
          if (error.message === 'RATE_LIMITED') {
            console.warn('Rate limited globally, will retry automatically')
          }
        },
        
        // Global success handler
        onSuccess: (data, key) => {
          logger.log('SWR Success for key:', key)
        },
        
        // Deduplication interval (5 seconds)
        dedupingInterval: 5000,
        
        // Error retry configuration
        errorRetryCount: 3,
        errorRetryInterval: 2000,
        
        // Focus revalidation (disabled to prevent excessive requests)
        revalidateOnFocus: false,
        
        // Reconnect revalidation (disabled to prevent excessive requests)
        revalidateOnReconnect: false,
        
        // Interval revalidation (disabled to prevent excessive requests)
        refreshInterval: 0,
        
        // Global fetcher with rate limiting
        fetcher: async (url: string) => {
          const response = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (response.status === 429) {
            throw new Error('RATE_LIMITED')
          }

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          return response.json()
        },
        
        // Cache configuration
        provider: () => new Map(),
        
        // Loading timeout
        loadingTimeout: 10000,
        
        // Error timeout
        errorTimeout: 5000,
      }}
    >
      {children}
    </SWRConfig>
  )
}




