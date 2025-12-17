"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  ArrowLeft, 
  Mail, 
  Bell,
  Home,
  Zap,
  Users,
  Globe
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCompanyContext } from '@/components/company-provider'

interface ComingSoonPageProps {
  title: string
  description: string
  icon?: React.ReactNode
  category?: string
  estimatedLaunch?: string
  features?: string[]
}

export function ComingSoonPage({ 
  title, 
  description, 
  icon, 
  category = "Feature",
  estimatedLaunch = "Q2 2024",
  features = []
}: ComingSoonPageProps) {
  const router = useRouter()
  const { companyName, companyColor } = useCompanyContext()
  const [email, setEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  // Countdown timer (example: 90 days from now)
  useEffect(() => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 90) // 90 days from now

    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate.getTime() - now

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setIsSubscribed(true)
      setEmail('')
      // Here you would typically send the email to your backend
      logger.log('Subscribed:', email)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <Button
                variant="ghost"
                onClick={() => router.push('/')}
                className="flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {category}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: companyColor || '#3B82F6' }}
            >
              {icon || <Zap className="w-10 h-10 text-white" />}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h1>

          {/* Description */}
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            {description}
          </p>

          {/* Status Badge */}
          <div className="flex justify-center mb-12">
            <Badge 
              variant="secondary" 
              className="px-4 py-2 text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
            >
              <Clock className="w-4 h-4 mr-2" />
              Coming Soon
            </Badge>
          </div>

          {/* Countdown Timer */}
          <Card className="max-w-2xl mx-auto mb-12">
            <CardHeader>
              <CardTitle className="text-center">Estimated Launch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {timeLeft.days}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Days</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {timeLeft.hours}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Hours</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {timeLeft.minutes}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Minutes</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {timeLeft.seconds}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Seconds</div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                Expected launch: {estimatedLaunch}
              </p>
            </CardContent>
          </Card>

          {/* Features Preview */}
          {features.length > 0 && (
            <Card className="max-w-2xl mx-auto mb-12">
              <CardHeader>
                <CardTitle className="text-center">What to Expect</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Email Subscription */}
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center">
                <Bell className="w-5 h-5 mr-2" />
                Get Notified
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSubscribed ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    You're on the list!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    We'll notify you when {title} is ready.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    style={{ backgroundColor: companyColor || '#3B82F6' }}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Notify Me
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Part of the {companyName || 'Honic Co.'} ecosystem
            </p>
            <div className="flex justify-center space-x-6 mt-4">
              <Button variant="ghost" onClick={() => router.push('/products')}>
                Browse Products
              </Button>
              <Button variant="ghost" onClick={() => router.push('/contact')}>
                Contact Us
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}




