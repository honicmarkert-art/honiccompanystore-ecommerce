import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, AlertTriangle, Home, LogIn } from 'lucide-react'
import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-96">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-900">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="flex items-center justify-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Insufficient Permissions</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-gray-600">
              You don't have the required permissions to access this resource.
            </p>
            <p className="text-sm text-gray-500">
              Administrator privileges are required for this action.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/home">
              <Button className="w-full" variant="outline">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
            
            <Link href="/auth/login">
              <Button className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                Switch Account
              </Button>
            </Link>
          </div>

          <div className="text-xs text-gray-500 pt-4 border-t">
            <p>If you believe this is an error, please contact your administrator.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}