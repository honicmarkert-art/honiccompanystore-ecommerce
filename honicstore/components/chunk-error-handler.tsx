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
      
      // Check if it's a chunk load error
      if (error && error.message && error.message.includes('Loading chunk')) {
        const chunkMatch = error.message.match(/chunk[^/]+\.js/)
        if (chunkMatch) {
          const chunkName = chunkMatch[0]
          console.warn('Chunk load error detected, retrying...', chunkName)
          
          // Retry loading the chunk by reloading the page
          // This is the most reliable way to recover from chunk load errors
          setTimeout(() => {
            window.location.reload()
          }, 2000) // Wait 2 seconds before reloading
        }
      }
    }

    // Handle unhandled promise rejections (chunk load errors often come as promise rejections)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      
      if (reason && typeof reason === 'object' && 'message' in reason) {
        const message = String(reason.message)
        
        // Check if it's a chunk load error
        if (message.includes('Loading chunk') || message.includes('ChunkLoadError')) {
          console.warn('Chunk load error detected in promise rejection, retrying...')
          
          // Prevent default error handling
          event.preventDefault()
          
          // Retry by reloading the page
          setTimeout(() => {
            window.location.reload()
          }, 2000)
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




