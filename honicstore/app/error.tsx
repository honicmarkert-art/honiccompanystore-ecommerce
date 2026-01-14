'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logError, getUserFriendlyMessage } from '@/lib/error-handler'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Production-ready error logging
    logError(error, {
      action: 'error_boundary',
      metadata: {
        digest: error.digest,
        stack: error.stack,
        name: error.name,
      },
    })
  }, [error])

  const handleRefresh = () => {
    reset()
  }

  const handleGoHome = () => {
    router.push('/home')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Something went wrong!
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            An unexpected error occurred.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>We're experiencing technical difficulties.</p>
            {error.digest && (
              <p className="mt-2 text-xs font-mono text-gray-400 dark:text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          
          <div className="flex flex-col space-y-2">
            <Button 
              onClick={handleRefresh}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            <Button 
              onClick={handleGoHome}
              className="w-full"
              variant="outline"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Home
            </Button>
          </div>
          
          <div className="text-center text-xs text-gray-400 dark:text-gray-500">
            <p>If the problem persists, please contact support.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
















