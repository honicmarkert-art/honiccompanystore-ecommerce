"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Handles chunk load errors by retrying failed chunks
 * This component listens for chunk load errors and automatically retries them
 */
export function ChunkErrorHandler() {
  const router = useRouter()

  useEffect(() => {
    // Handle chunk load errors
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error
      
        // Check if it's a chunk load error (including timeout errors)
        if (error && error.message && (
          error.message.includes('Loading chunk') || 
          error.message.includes('ChunkLoadError') ||
          error.message.includes('timeout') ||
          error.message.includes('Failed to fetch')
        )) {
          const chunkMatch = error.message.match(/chunk[^/]+\.js|layout\.js|app\/layout/)
          if (chunkMatch) {
            const chunkName = chunkMatch[0]
            // Clear webpack cache and retry
            if (typeof window !== 'undefined' && (window as any).__webpack_require__) {
              try {
                // Clear the failed chunk from webpack cache
                const chunkId = chunkName.replace('.js', '')
                if ((window as any).__webpack_require__.cache) {
                  delete (window as any).__webpack_require__.cache[chunkId]
                }
              } catch (e) {
                }
            }
            
            // Retry loading the chunk by reloading the page
            // This is the most reliable way to recover from chunk load errors
            setTimeout(() => {
              window.location.reload()
            }, 1000) // Reduced wait time for faster recovery
          }
        }
    }

    // Handle unhandled promise rejections (chunk load errors often come as promise rejections)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      
      if (reason && typeof reason === 'object' && 'message' in reason) {
        const message = String(reason.message)
        
        // Check if it's a chunk load error (including timeout errors)
        if (message.includes('Loading chunk') || 
            message.includes('ChunkLoadError') || 
            message.includes('timeout') ||
            message.includes('Failed to fetch')) {
          // Prevent default error handling
          event.preventDefault()
          
          // Clear webpack cache if possible
          if (typeof window !== 'undefined' && (window as any).__webpack_require__) {
            try {
              if ((window as any).__webpack_require__.cache) {
                // Clear all chunk-related cache entries
                Object.keys((window as any).__webpack_require__.cache).forEach(key => {
                  if (key.includes('chunk') || key.includes('layout')) {
                    delete (window as any).__webpack_require__.cache[key]
                  }
                })
              }
            } catch (e) {
              }
          }
          
          // Retry by reloading the page
          setTimeout(() => {
            window.location.reload()
          }, 1000) // Reduced wait time for faster recovery
        }
      }
    }

    // Add event listeners
    window.addEventListener('error', handleChunkError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [router])

  return null
}






