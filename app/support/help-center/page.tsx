"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  HelpCircle,
  ShoppingCart,
  Package,
  CreditCard,
  Truck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  MessageCircle,
  BookOpen,
  FileText,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  popular?: boolean
}

export default function HelpCenterPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  const categories = [
    { id: 'all', name: 'All Topics', icon: <BookOpen className="w-5 h-5" />, count: 0 },
    { id: 'orders', name: 'Orders & Shipping', icon: <Package className="w-5 h-5" />, count: 8 },
    { id: 'payments', name: 'Payments & Billing', icon: <CreditCard className="w-5 h-5" />, count: 6 },
    { id: 'account', name: 'Account & Profile', icon: <HelpCircle className="w-5 h-5" />, count: 5 },
    { id: 'returns', name: 'Returns & Refunds', icon: <ArrowRight className="w-5 h-5" />, count: 4 },
    { id: 'technical', name: 'Technical Support', icon: <Shield className="w-5 h-5" />, count: 7 }
  ]

  const faqs: FAQ[] = [
    // Orders & Shipping
    {
      id: 'order-status',
      question: 'How can I track my order?',
      answer: 'You can track your order by logging into your account and going to "My Orders" section. You\'ll see the current status and tracking information for each order. We also send email updates when your order status changes.',
      category: 'orders',
      popular: true
    },
    {
      id: 'shipping-time',
      question: 'How long does shipping take?',
      answer: 'Standard shipping takes 3-5 business days within Dar es Salaam and 5-7 business days to other regions in Tanzania. Express shipping is available for 1-2 business days in major cities.',
      category: 'orders',
      popular: true
    },
    {
      id: 'shipping-cost',
      question: 'What are the shipping costs?',
      answer: 'We offer free shipping on orders over TZS 100,000. Standard shipping costs TZS 5,000 for orders under TZS 100,000. Express shipping costs TZS 10,000. Pickup from our store is always free.',
      category: 'orders'
    },
    {
      id: 'order-modification',
      question: 'Can I modify or cancel my order?',
      answer: 'You can modify or cancel your order within 1 hour of placing it. After that, the order enters processing and cannot be changed. Contact our support team immediately if you need assistance.',
      category: 'orders'
    },
    {
      id: 'delivery-issues',
      question: 'What if I\'m not available for delivery?',
      answer: 'If you\'re not available, our delivery partner will attempt delivery 3 times. After that, the package will be returned to our warehouse. You can reschedule delivery or arrange pickup from our store.',
      category: 'orders'
    },
    {
      id: 'international-shipping',
      question: 'Do you ship internationally?',
      answer: 'Currently, we only ship within Tanzania. We\'re working on expanding our shipping to other East African countries soon.',
      category: 'orders'
    },
    {
      id: 'bulk-orders',
      question: 'Do you offer bulk order discounts?',
      answer: 'Yes! For orders over TZS 500,000, we offer special bulk pricing. Contact our sales team at sales@honiccompanystore.com for custom quotes.',
      category: 'orders'
    },
    {
      id: 'order-history',
      question: 'How long is my order history kept?',
      answer: 'Your order history is kept for 2 years. You can view and download invoices for all orders during this period from your account.',
      category: 'orders'
    },

    // Payments & Billing
    {
      id: 'payment-methods',
      question: 'What payment methods do you accept?',
      answer: 'We accept M-Pesa, TigoPesa, Airtel Money, Visa, Mastercard, and bank transfers. All payments are processed securely through our payment partners.',
      category: 'payments',
      popular: true
    },
    {
      id: 'payment-security',
      question: 'Is my payment information secure?',
      answer: 'Yes, we use industry-standard encryption and security measures to protect your payment information. We never store your full card details on our servers.',
      category: 'payments'
    },
    {
      id: 'payment-failed',
      question: 'What should I do if my payment fails?',
      answer: 'If your payment fails, check your account balance and try again. If the problem persists, contact your bank or mobile money provider. You can also try a different payment method.',
      category: 'payments'
    },
    {
      id: 'invoice-request',
      question: 'How can I get an invoice for my purchase?',
      answer: 'You can download invoices directly from your account under "My Orders". Select the order and click "Download Invoice". For business purchases, we can provide detailed invoices.',
      category: 'payments'
    },
    {
      id: 'refund-timeline',
      question: 'How long do refunds take?',
      answer: 'Refunds are processed within 3-5 business days after we receive the returned item. The money will appear in your original payment method within 5-10 business days.',
      category: 'payments'
    },
    {
      id: 'currency-accepted',
      question: 'What currency do you accept?',
      answer: 'We accept payments in Tanzanian Shillings (TZS). All prices on our website are displayed in TZS.',
      category: 'payments'
    },

    // Account & Profile
    {
      id: 'create-account',
      question: 'How do I create an account?',
      answer: 'Click "Sign Up" in the top right corner, fill in your details, and verify your email address. You can also sign up using your Google or Facebook account.',
      category: 'account',
      popular: true
    },
    {
      id: 'password-reset',
      question: 'I forgot my password. How do I reset it?',
      answer: 'Click "Forgot Password" on the login page, enter your email address, and check your inbox for reset instructions. Follow the link to create a new password.',
      category: 'account'
    },
    {
      id: 'profile-update',
      question: 'How do I update my profile information?',
      answer: 'Log into your account, go to "My Account" > "Settings", and update your personal information, address, and preferences.',
      category: 'account'
    },
    {
      id: 'account-delete',
      question: 'How do I delete my account?',
      answer: 'Contact our support team to request account deletion. We\'ll process your request within 7 business days and ensure all your data is securely removed.',
      category: 'account'
    },
    {
      id: 'email-change',
      question: 'Can I change my email address?',
      answer: 'Yes, you can change your email address in your account settings. You\'ll need to verify the new email address before it becomes active.',
      category: 'account'
    },

    // Returns & Refunds
    {
      id: 'return-policy',
      question: 'What is your return policy?',
      answer: 'We offer a 30-day return policy for most items. Items must be in original condition with tags and packaging. Some items like electronics have a 14-day return window.',
      category: 'returns',
      popular: true
    },
    {
      id: 'return-process',
      question: 'How do I return an item?',
      answer: 'Log into your account, go to "My Orders", select the order, and click "Return Item". Follow the instructions to print the return label and send the item back.',
      category: 'returns'
    },
    {
      id: 'return-shipping',
      question: 'Who pays for return shipping?',
      answer: 'We cover return shipping costs for defective or incorrect items. For other returns, the customer pays return shipping unless the item qualifies for free returns.',
      category: 'returns'
    },
    {
      id: 'refund-amount',
      question: 'How much will I be refunded?',
      answer: 'You\'ll receive a full refund for the item price and original shipping cost (if applicable). Return shipping costs are only refunded for defective items.',
      category: 'returns'
    },

    // Technical Support
    {
      id: 'website-issues',
      question: 'The website is not loading properly. What should I do?',
      answer: 'Try refreshing the page, clearing your browser cache, or using a different browser. If the problem persists, contact our technical support team.',
      category: 'technical',
      popular: true
    },
    {
      id: 'mobile-app',
      question: 'Do you have a mobile app?',
      answer: 'Yes! Our mobile app is available for iOS and Android. Download it from the App Store or Google Play Store for a better shopping experience.',
      category: 'technical'
    },
    {
      id: 'browser-compatibility',
      question: 'Which browsers are supported?',
      answer: 'We support Chrome, Firefox, Safari, and Edge. For the best experience, we recommend using the latest version of your preferred browser.',
      category: 'technical'
    },
    {
      id: 'account-login-issues',
      question: 'I can\'t log into my account. What should I do?',
      answer: 'Check your email and password, try resetting your password, or clear your browser cookies. If you still can\'t log in, contact our support team.',
      category: 'technical'
    },
    {
      id: 'search-not-working',
      question: 'The search function is not working. How do I find products?',
      answer: 'Try using different keywords or browse by category. If search continues to fail, contact our technical team and we\'ll investigate the issue.',
      category: 'technical'
    },
    {
      id: 'checkout-issues',
      question: 'I\'m having trouble checking out. What should I do?',
      answer: 'Ensure your payment information is correct and try a different payment method. Clear your browser cache and try again. Contact support if the issue persists.',
      category: 'technical'
    },
    {
      id: 'email-notifications',
      question: 'I\'m not receiving email notifications. What should I do?',
      answer: 'Check your spam folder and add our email address to your contacts. Ensure your email address is correct in your account settings.',
      category: 'technical'
    }
  ]

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const popularFAQs = faqs.filter(faq => faq.popular)

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQ(expandedFAQ === faqId ? null : faqId)
  }

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
          <h1 className="text-4xl font-bold mb-4">Help Center</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Find answers to common questions and get the support you need
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search for help articles, FAQs, and guides..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  // Search is already triggered by onChange
                }
              }}
              className="pl-12 pr-4 py-3 text-lg"
            />
          </div>
        </div>

        {/* Quick Actions */}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Browse Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-r-2 border-orange-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`${selectedCategory === category.id ? 'text-orange-500' : 'text-muted-foreground'}`}>
                          {category.icon}
                        </div>
                        <span className={`font-medium ${selectedCategory === category.id ? 'text-orange-700 dark:text-orange-300' : ''}`}>
                          {category.name}
                        </span>
                      </div>
                      {category.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {category.count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Content */}
          <div className="lg:col-span-3">
            {/* Popular FAQs */}
            {selectedCategory === 'all' && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-orange-500" />
                  Popular Questions
                </h2>
                <div className="space-y-4">
                  {popularFAQs.map((faq) => (
                    <Card key={faq.id} className="hover:shadow-md transition-shadow">
                      <button
                        onClick={() => toggleFAQ(faq.id)}
                        className="w-full p-6 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{faq.question}</h3>
                          {expandedFAQ === faq.id ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        {expandedFAQ === faq.id && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                          </div>
                        )}
                      </button>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All FAQs */}
            <div>
              <h2 className="text-2xl font-bold mb-6">
                {selectedCategory === 'all' ? 'All Questions' : categories.find(c => c.id === selectedCategory)?.name}
              </h2>
              
              {filteredFAQs.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No results found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try searching with different keywords or browse by category
                    </p>
                    <Button onClick={() => setSearchTerm('')}>
                      Clear Search
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredFAQs.map((faq) => (
                    <Card key={faq.id} className="hover:shadow-md transition-shadow">
                      <button
                        onClick={() => toggleFAQ(faq.id)}
                        className="w-full p-6 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{faq.question}</h3>
                          {expandedFAQ === faq.id ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        {expandedFAQ === faq.id && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                          </div>
                        )}
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
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
