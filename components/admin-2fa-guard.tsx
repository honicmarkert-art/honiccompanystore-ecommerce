"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Shield, Key, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Admin2FAGuardProps {
  children: React.ReactNode
}

export function Admin2FAGuard({ children }: Admin2FAGuardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [attempts, setAttempts] = useState(0)

  // Check if 2FA is already verified (stored in sessionStorage)
  useEffect(() => {
    const is2FAVerified = sessionStorage.getItem('admin-2fa-verified')
    if (is2FAVerified === 'true') {
      // 2FA already verified in this session
      return
    }
  }, [])

  const handle2FAVerification = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: "Verification Required",
        description: "Please enter the verification code.",
        variant: "destructive"
      })
      return
    }

    setIsVerifying(true)

    try {
      // Simulate 2FA verification (in real app, this would call your API)
      // For demo purposes, accept any 6-digit code or "admin123"
      const isValidCode = verificationCode === 'admin123' || /^\d{6}$/.test(verificationCode)
      
      if (isValidCode) {
        // Mark 2FA as verified for this session
        sessionStorage.setItem('admin-2fa-verified', 'true')
        sessionStorage.setItem('admin-2fa-time', Date.now().toString())
        
        toast({
          title: "Verification Successful",
          description: "Admin access granted.",
        })

        // Reload to show admin content
        window.location.reload()
      } else {
        setAttempts(prev => prev + 1)
        
        if (attempts >= 2) {
          toast({
            title: "Too Many Attempts",
            description: "Please contact system administrator.",
            variant: "destructive"
          })
          router.push('/')
          return
        }

        toast({
          title: "Invalid Code",
          description: `Invalid verification code. ${2 - attempts} attempts remaining.`,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Please try again or contact support.",
        variant: "destructive"
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Check if 2FA is verified
  const is2FAVerified = sessionStorage.getItem('admin-2fa-verified') === 'true'
  const verificationTime = sessionStorage.getItem('admin-2fa-time')
  
  // Reset 2FA verification after 1 hour
  if (verificationTime && Date.now() - parseInt(verificationTime) > 60 * 60 * 1000) {
    sessionStorage.removeItem('admin-2fa-verified')
    sessionStorage.removeItem('admin-2fa-time')
  }

  if (is2FAVerified) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-600">
            <Shield className="w-5 h-5" />
            <span>Admin Verification</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Key className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600 mt-1">
                Enter your admin verification code to continue
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                type="text"
                placeholder="Enter admin code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handle2FAVerification()}
                className="mt-1"
              />
            </div>

            <Button 
              onClick={handle2FAVerification}
              disabled={isVerifying}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Demo: Use "admin123" or any 6-digit code
            </p>
            {attempts > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {3 - attempts} attempts remaining
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Verification expires after 1 hour</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
