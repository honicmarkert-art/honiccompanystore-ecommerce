'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

function AuthCodeErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <XCircle className="w-6 h-6 text-red-500" />
            Authentication Error
          </CardTitle>
          <CardDescription className="text-center">
            There was a problem completing the authentication process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Details</AlertTitle>
              <AlertDescription>
                <strong>Error:</strong> {error}
                {errorDescription && (
                  <>
                    <br />
                    <strong>Description:</strong> {errorDescription}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!error && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Authorization Code Received</AlertTitle>
              <AlertDescription>
                The authentication callback did not receive the required authorization code.
                This usually means:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>The redirect URI in Google Cloud Console doesn't match</li>
                  <li>The redirect URL isn't configured in Supabase</li>
                  <li>The OAuth flow was interrupted</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Troubleshooting Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Check that <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || (process.env.NODE_ENV === 'development' ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}` : 'https://www.honiccompanystore.com'))}/auth/callback</code> is in Google Cloud Console</li>
              <li>Verify redirect URLs are configured in Supabase Dashboard</li>
              <li>Make sure you're testing on the same URL (localhost vs production)</li>
              <li>Wait a few minutes after changing Google Cloud Console settings</li>
            </ol>
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
            <Button asChild>
              <Link href="/">Try Again</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthCodeErrorContent />
    </Suspense>
  )
}


