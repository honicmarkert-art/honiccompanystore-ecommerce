'use client'

import { useState } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { usePublicCompanyContext } from '@/contexts/public-company-context'
import { cn } from '@/lib/utils'
import { ArrowLeft, Package, TrendingUp, DollarSign, Shield, Users, CheckCircle, Send } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function BecomeSupplierPage() {
  const { themeClasses } = useTheme()
  const { companyName } = usePublicCompanyContext()
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    products: '',
    website: '',
    message: ''
  })

  const benefits = [
    { icon: TrendingUp, title: 'Grow Your Business', description: 'Reach thousands of customers looking for quality products' },
    { icon: DollarSign, title: 'Fair Pricing', description: 'Competitive commission structure that works for you' },
    { icon: Shield, title: 'Trust & Security', description: 'Secure transactions and reliable payment processing' },
    { icon: Users, title: 'Support Team', description: 'Dedicated support to help you succeed' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    toast({
      title: 'Application Received',
      description: 'Thank you! We will contact you within 2-3 business days.',
    })

    // Reset form
    setFormData({
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      products: '',
      website: '',
      message: ''
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className={cn("min-h-screen", themeClasses.mainBg)}>
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-block p-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 mb-6">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h1 className={cn("text-4xl md:text-6xl font-bold mb-4", themeClasses.mainText)}>
            Become a Supplier
          </h1>
          <p className={cn("text-lg md:text-xl max-w-2xl mx-auto", themeClasses.textNeutralSecondary)}>
            Join our marketplace and grow your business with {companyName}. Start selling to thousands of customers today.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
          {/* Benefits Section */}
          <div className="space-y-6">
            <h2 className={cn("text-2xl font-bold mb-6", themeClasses.mainText)}>
              Why Partner With Us?
            </h2>
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <Card key={index} className={cn("border", themeClasses.cardBorder, themeClasses.cardBg)}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20">
                        <Icon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h3 className={cn("text-lg font-semibold mb-1", themeClasses.mainText)}>
                          {benefit.title}
                        </h3>
                        <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Application Form */}
          <Card className={cn("border", themeClasses.cardBorder, themeClasses.cardBg)}>
            <CardContent className="p-6">
              <h2 className={cn("text-2xl font-bold mb-6", themeClasses.mainText)}>
                Get Started
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                    Company Name *
                  </label>
                  <Input
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                    placeholder="Your company name"
                    className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>

                <div>
                  <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                    Contact Name *
                  </label>
                  <Input
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    required
                    placeholder="Your full name"
                    className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                      Email *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="email@example.com"
                      className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                    />
                  </div>

                  <div>
                    <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                      Phone *
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="+255 xxx xxx xxx"
                      className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                    />
                  </div>
                </div>

                <div>
                  <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                    Products You Want to Supply
                  </label>
                  <Input
                    name="products"
                    value={formData.products}
                    onChange={handleChange}
                    placeholder="Describe your products"
                    className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>

                <div>
                  <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                    Website (Optional)
                  </label>
                  <Input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://example.com"
                    className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>

                <div>
                  <label className={cn("text-sm font-medium block mb-2", themeClasses.mainText)}>
                    Additional Message
                  </label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us more about your business..."
                    rows={4}
                    className={cn(themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  />
                </div>

                <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-neutral-950">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Application
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

