"use client"

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ErrorPage() {
  const router = useRouter()

  useEffect(() => {
    // Log error for debugging
    console.error('Error page accessed - server error occurred')
  }, [])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Server Error
          </CardTitle>
          <CardDescription className="text-gray-600">
            Something went wrong on our end. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-500">
            <p>We're experiencing technical difficulties.</p>
            <p>This is not an authentication issue.</p>
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
          
          <div className="text-center text-xs text-gray-400">
            <p>If the problem persists, please contact support.</p>
            <p>Error Code: SERVER_ERROR</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}




