"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  RefreshCw,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  FileText,
  Truck,
  CreditCard,
  Calendar,
  Phone,
  Mail,
  MessageCircle,
  Download,
  ExternalLink,
  Info,
  XCircle,
  Shield
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'

interface ReturnItem {
  id: string
  orderNumber: string
  productName: string
  reason: string
  status: string
  requestDate: string
  expectedRefund: number
  returnMethod: string
  trackingNumber?: string
}

export default function ReturnsRefundsPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReason, setSelectedReason] = useState('')

  const returnReasons = [
    { id: 'defective', name: 'Defective/Damaged Item', description: 'Item arrived damaged or not working properly' },
    { id: 'wrong-item', name: 'Wrong Item Received', description: 'Received different item than ordered' },
    { id: 'not-as-described', name: 'Not as Described', description: 'Item doesn\'t match the description' },
    { id: 'changed-mind', name: 'Changed Mind', description: 'No longer want the item' },
    { id: 'wrong-size', name: 'Wrong Size', description: 'Item doesn\'t fit properly' },
    { id: 'duplicate', name: 'Duplicate Order', description: 'Accidentally ordered twice' }
  ]

  const returnSteps = [
    {
      step: 1,
      title: 'Initiate Return',
      description: 'Log into your account and select the item you want to return',
      icon: <FileText className="w-6 h-6" />,
      completed: true
    },
    {
      step: 2,
      title: 'Choose Reason',
      description: 'Select the reason for return and provide additional details',
      icon: <Info className="w-6 h-6" />,
      completed: true
    },
    {
      step: 3,
      title: 'Print Return Label',
      description: 'Download and print the return shipping label',
      icon: <Download className="w-6 h-6" />,
      completed: false
    },
    {
      step: 4,
      title: 'Package Item',
      description: 'Pack the item securely with original packaging',
      icon: <Package className="w-6 h-6" />,
      completed: false
    },
    {
      step: 5,
      title: 'Ship Return',
      description: 'Drop off the package at designated location',
      icon: <Truck className="w-6 h-6" />,
      completed: false
    },
    {
      step: 6,
      title: 'Receive Refund',
      description: 'Get refund processed within 3-5 business days',
      icon: <CreditCard className="w-6 h-6" />,
      completed: false
    }
  ]

  // Mock return data
  const mockReturns: ReturnItem[] = [
    {
      id: '1',
      orderNumber: 'HC-2025-001234',
      productName: 'Arduino Uno R3 Development Board',
      reason: 'Defective/Damaged Item',
      status: 'processing',
      requestDate: '2025-01-15',
      expectedRefund: 45000,
      returnMethod: 'Pickup',
      trackingNumber: 'RT123456789'
    },
    {
      id: '2',
      orderNumber: 'HC-2025-001235',
      productName: 'ESP32 WiFi Module',
      reason: 'Changed Mind',
      status: 'approved',
      requestDate: '2025-01-12',
      expectedRefund: 25000,
      returnMethod: 'Shipping',
      trackingNumber: 'RT123456790'
    },
    {
      id: '3',
      orderNumber: 'HC-2025-001236',
      productName: 'Raspberry Pi 4 Model B',
      reason: 'Wrong Item Received',
      status: 'completed',
      requestDate: '2025-01-08',
      expectedRefund: 85000,
      returnMethod: 'Pickup'
    }
  ]

  const filteredReturns = mockReturns.filter(returnItem => 
    returnItem.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    returnItem.productName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'approved':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-orange-500" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'processing':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-TZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(amount)
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
          <h1 className="text-4xl font-bold mb-4">Returns & Refunds</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Easy returns and fast refunds. Learn about our return policy and track your returns.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Package className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search by order number or product name..."
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
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Start a Return</h3>
              <p className="text-sm text-muted-foreground mb-4">Initiate a return for your order</p>
              {isAuthenticated ? (
                <Link href="/account/orders">
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Go to My Orders
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="w-full" disabled>
                  Sign in required
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Track Return</h3>
              <p className="text-sm text-muted-foreground mb-4">Check status of your return</p>
              <Button variant="outline" size="sm" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Track Return
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Return Label</h3>
              <p className="text-sm text-muted-foreground mb-4">Download return shipping label</p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Return Policy */}
          <div className="lg:col-span-1">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Return Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">30-Day Return Window</p>
                      <p className="text-sm text-muted-foreground">Return items within 30 days of delivery</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Original Condition</p>
                      <p className="text-sm text-muted-foreground">Items must be in original packaging with tags</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Free Returns</p>
                      <p className="text-sm text-muted-foreground">Free returns for defective or wrong items</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Fast Refunds</p>
                      <p className="text-sm text-muted-foreground">Refunds processed within 3-5 business days</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Return Reasons */}
            <Card>
              <CardHeader>
                <CardTitle>Common Return Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {returnReasons.map((reason) => (
                    <div key={reason.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <p className="font-medium text-sm">{reason.name}</p>
                      <p className="text-xs text-muted-foreground">{reason.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Return Process Steps */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>How to Return an Item</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {returnSteps.map((step, index) => (
                    <div key={step.step} className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step.completed 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {step.completed ? <CheckCircle className="w-5 h-5" /> : step.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Returns */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Recent Returns</h2>
                {isAuthenticated && (
                  <Link href="/account/orders">
                    <Button variant="outline" className="flex items-center gap-2">
                      View All Orders
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </div>

              {filteredReturns.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No returns found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm ? 'Try searching with a different term' : 'You don\'t have any returns yet'}
                    </p>
                    {!isAuthenticated && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Sign in to view your returns</p>
                        <Button onClick={() => router.push('/auth/login')}>
                          Sign In
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredReturns.map((returnItem) => (
                    <Card key={returnItem.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Return #{returnItem.id}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Order: {returnItem.orderNumber} • Requested: {formatDate(returnItem.requestDate)}
                            </p>
                          </div>
                          <Badge className={getStatusColor(returnItem.status)}>
                            {getStatusIcon(returnItem.status)}
                            <span className="ml-2 capitalize">{returnItem.status}</span>
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-2">Product Details</h4>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p><strong>Product:</strong> {returnItem.productName}</p>
                              <p><strong>Reason:</strong> {returnItem.reason}</p>
                              <p><strong>Return Method:</strong> {returnItem.returnMethod}</p>
                              {returnItem.trackingNumber && (
                                <p><strong>Tracking:</strong> {returnItem.trackingNumber}</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Refund Information</h4>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p><strong>Expected Refund:</strong> {formatCurrency(returnItem.expectedRefund)}</p>
                              <p><strong>Status:</strong> {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}</p>
                              <p><strong>Processing Time:</strong> 3-5 business days</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
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
              <h2 className="text-3xl font-bold mb-4">Need help with returns?</h2>
              <p className="text-xl mb-8 opacity-90">
                Our support team is here to help you with any return questions
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
