'use client'

import { useState } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { Mail, MessageCircle, HelpCircle, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

export default function WingaSupportPage() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const { user, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'general'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
          description: result.error || 'Failed to send support request. Please try again.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send support request. Please try again.',
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
        <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Winga Support</h1>
        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
          Get help with your Winga account, products, and orders
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
                      ? "bg-purple-100 dark:bg-purple-900/20" 
                      : "bg-gray-100 dark:bg-gray-900/20"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      option.available 
                        ? "text-purple-600 dark:text-purple-400" 
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
                    className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {option.contact}
                  </a>
                )}
                {!option.available && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => {
                      window.open('/supplier/upgrade', '_blank', 'noopener,noreferrer')
                    }}
                  >
                    Upgrade for Access
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
                <option value="winga">Winga Account Question</option>
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
              className="w-full bg-purple-500 hover:bg-purple-600 text-white"
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
                q: 'What is a Winga?',
                a: 'A Winga is an informal trader who acts as a broker or connector, helping customers find products they want by posting to Honic online store.'
              },
              {
                q: 'How do I post products as a Winga?',
                a: 'Go to Products page and click "Connect Product". Fill in the product details and save. You can connect products you can help customers find.'
              },
              {
                q: 'What is the commission structure?',
                a: 'Winga does not earn 5% commission. Honic gives you space to post your products, so 5% is earned by Honic. Commission fee 5%.'
              },
              {
                q: 'How do I get paid?',
                a: 'Set up your payout account in Payout Accounts section. Once orders are completed, payments will be processed according to the schedule.'
              },
              {
                q: 'Can I upgrade from Winga plan?',
                a: 'Yes! You can upgrade to Premium plan anytime from the Upgrade Plan page to get more features and lower commission rates.'
              },
              {
                q: 'How do I complete my business information?',
                a: 'Go to "Winga Business Info" from the dashboard to complete your business registration details, including TIN or NIDA number.'
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


