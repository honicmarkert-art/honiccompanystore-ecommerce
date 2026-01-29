'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { Mail, MessageCircle, HelpCircle, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

export default function SupplierSupportPage() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const { user, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'general'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<{ slug: string } | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [hasValidPremiumPayment, setHasValidPremiumPayment] = useState<boolean>(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchCurrentPlan()
  }, [])

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/user/current-plan', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success && data.plan) {
        setCurrentPlan(data.plan)
        setPendingPlanId(data.pendingPlanId || null)
        setHasValidPremiumPayment(data.hasValidPremiumPayment || false)
        setPaymentStatus(data.paymentStatus || null)
      }
    } catch (error) {
      }
  }

  const isFreePlan = currentPlan?.slug === 'free'
  // Check if premium plan payment is pending - use payment_status directly
  const isPremiumPendingPayment = paymentStatus === 'pending'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isAuthenticated || !user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to send a support request',
        variant: 'destructive'
      })
      return
    }
    
    if (!formData.subject || !formData.message) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/supplier/support/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: formData.subject,
          message: formData.message,
          category: formData.category
        }),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Support Request Sent',
          description: result.message || 'We will get back to you within 24-48 hours',
        })
        setFormData({ subject: '', message: '', category: 'general' })
      } else {
        toast({
          title: 'Error',
          description: 'Failed',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const supportOptions = [
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Get help via email',
      available: true,
      responseTime: '24-48 hours',
      contact: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@honiccompanystore.com'
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Chat with our support team',
      available: false,
      responseTime: 'Instant',
      premium: true
    },
    {
      icon: HelpCircle,
      title: 'Priority Support',
      description: 'Faster response times',
      available: false,
      responseTime: '2-4 hours',
      premium: true
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Support</h1>
        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
          Get help with your account, products, and orders
        </p>
      </div>

      {/* Support Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {supportOptions.map((option, index) => {
          const Icon = option.icon
          return (
            <Card 
              key={index} 
              className={cn(
                "border-2",
                option.available ? themeClasses.cardBorder : "opacity-60",
                themeClasses.cardBg
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-lg",
                    option.available 
                      ? "bg-blue-100 dark:bg-blue-900/20" 
                      : "bg-gray-100 dark:bg-gray-900/20"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      option.available 
                        ? "text-blue-600 dark:text-blue-400" 
                        : "text-gray-400"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={cn("font-semibold", themeClasses.mainText)}>{option.title}</h3>
                      {option.premium && (
                        <Badge className="bg-yellow-500 text-black text-xs font-semibold">Premium</Badge>
                      )}
                      {!option.available && option.premium && (
                        <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                      {option.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3" />
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        {option.responseTime}
                      </span>
                    </div>
                  </div>
                </div>
                {option.available && option.contact && (
                  <a
                    href={`mailto:${option.contact}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {option.contact}
                  </a>
                )}
                {!option.available && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={async () => {
                      if (isPremiumPendingPayment && pendingPlanId) {
                        window.open(`/supplier/payment?planId=${pendingPlanId}`, '_blank', 'noopener,noreferrer')
                        return
                      }
                      
                      try {
                        // Fetch premium plan
                        const plansResponse = await fetch('/api/supplier-plans', {
                          credentials: 'include'
                        })
                        const plansData = await plansResponse.json()
                        
                        if (!plansData.success || !plansData.plans) {
                          throw new Error('Failed to fetch plans')
                        }
                        
                        const premiumPlan = plansData.plans.find((p: any) => p.slug === 'premium')
                        if (!premiumPlan) {
                          throw new Error('Premium plan not found')
                        }
                        
                        // Initiate upgrade to get referenceId
                        const initiateResponse = await fetch('/api/supplier/upgrade/initiate', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                          body: JSON.stringify({
                            planId: premiumPlan.id,
                            amount: premiumPlan.price
                          })
                        })
                        
                        // Check response status before parsing JSON
                        if (!initiateResponse.ok) {
                          if (initiateResponse.status === 401) {
                            throw new Error('Your session has expired. Please refresh the page and try again.')
                          }
                          const errorData = await initiateResponse.json().catch(() => ({ error: 'Failed to initiate upgrade' }))
                          throw new Error(errorData.error || `Server error: ${initiateResponse.status}`)
                        }
                        
                        const initiateData = await initiateResponse.json()
                        
                        if (!initiateData.success || !initiateData.upgrade) {
                          throw new Error(initiateData.error || 'Failed to initiate upgrade')
                        }
                        
                        const { referenceId } = initiateData.upgrade
                        
                        // Redirect to payment page
                        window.location.href = `/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: 'Failed',
                          variant: 'destructive'
                        })
                      }
                    }}
                  >
                    {isPremiumPendingPayment ? 'Complete Payment' : 'Upgrade Plan'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Contact Form */}
      <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>Send Support Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="category" className={cn(themeClasses.mainText)}>Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={cn(
                  "w-full mt-1 px-3 py-2 rounded-md border",
                  themeClasses.cardBorder,
                  themeClasses.cardBg,
                  themeClasses.mainText
                )}
              >
                <option value="general">General Inquiry</option>
                <option value="technical">Technical Issue</option>
                <option value="billing">Billing Question</option>
                <option value="product">Product Related</option>
                <option value="order">Order Issue</option>
              </select>
            </div>
            <div>
              <Label htmlFor="subject" className={cn(themeClasses.mainText)}>Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Enter subject"
                className={cn("mt-1", themeClasses.cardBorder)}
                required
              />
            </div>
            <div>
              <Label htmlFor="message" className={cn(themeClasses.mainText)}>Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe your issue or question"
                className={cn("mt-1 min-h-[150px]", themeClasses.cardBorder)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Request'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                q: 'How do I add products?',
                a: 'Go to Products page and click "Add Product". Fill in the product details and save.'
              },
              {
                q: 'What is the commission rate?',
                a: 'Free Plan: 15% commission. Premium Plan: 10% commission.'
              },
              {
                q: 'How do I upgrade to Premium?',
                a: 'Click "Upgrade Plan" in the navigation bar and complete the payment.'
              },
              {
                q: 'How long does it take to process orders?',
                a: 'Orders are processed within 24-48 hours after confirmation.'
              }
            ].map((faq, index) => (
              <div key={index} className={cn("p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}>
                <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>{faq.q}</h3>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>{faq.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

