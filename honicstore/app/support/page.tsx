"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  HelpCircle,
  Package,
  ArrowRight,
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Truck,
  Shield,
  RefreshCw
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SupportPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()

  const supportPages = [
    {
      title: 'Help Center',
      description: 'Find answers to common questions and browse our comprehensive FAQ section',
      href: '/support/help-center',
      icon: <HelpCircle className="w-8 h-8" />,
      color: 'bg-blue-500',
      features: ['Search FAQs', 'Browse by category', 'Popular questions', 'Contact support']
    },
    {
      title: 'Order Tracking',
      description: 'Track your orders and stay updated on delivery status',
      href: '/support/order-tracking',
      icon: <Package className="w-8 h-8" />,
      color: 'bg-green-500',
      features: ['Track by order number', 'View order history', 'Status updates', 'Delivery timeline']
    },
    {
      title: 'Returns & Refunds',
      description: 'Learn about our return policy and process refunds',
      href: '/support/returns-refunds',
      icon: <RefreshCw className="w-8 h-8" />,
      color: 'bg-orange-500',
      features: ['Return policy', 'Refund process', 'Return shipping', 'Status tracking']
    },
    {
      title: 'Shipping Info',
      description: 'Information about shipping options, costs, and delivery times',
      href: '/support/shipping-info',
      icon: <Truck className="w-8 h-8" />,
      color: 'bg-purple-500',
      features: ['Shipping options', 'Delivery times', 'Shipping costs', 'International shipping']
    },
    {
      title: 'Technical Support',
      description: 'Get help with technical issues and platform problems',
      href: '/support/technical-support',
      icon: <Shield className="w-8 h-8" />,
      color: 'bg-red-500',
      features: ['Website issues', 'Mobile app support', 'Browser compatibility', 'Account problems']
    }
  ]

  return (
    <div className={`min-h-screen ${themeClasses.mainBg} ${themeClasses.mainText}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Support Center</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get the help you need to make the most of our platform
          </p>
        </div>

        {/* Quick Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Call Support</h3>
              <p className="text-sm text-muted-foreground mb-4">Speak directly with our support team</p>
              <Button variant="outline" size="sm">
                +255 12 737 7461
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Email Support</h3>
              <p className="text-sm text-muted-foreground mb-4">Get help via email</p>
              <Button variant="outline" size="sm">
                support@honiccompanystore.com
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Live Chat</h3>
              <p className="text-sm text-muted-foreground mb-4">Chat with us in real-time</p>
              <Button variant="outline" size="sm">
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Support Pages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {supportPages.map((page, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow group">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${page.color} rounded-lg flex items-center justify-center text-white`}>
                    {page.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {page.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {page.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Link href={page.href}>
                  <Button className="w-full group-hover:bg-orange-600 transition-colors">
                    Access {page.title}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Support CTA */}
        <div className="mt-16">
          <Card className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Still need help?</h2>
              <p className="text-xl mb-8 opacity-90">
                Our support team is here to help you 24/7
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" className="bg-white text-orange-500 hover:bg-gray-100">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Support
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
