"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'

interface OrderStatus {
  id: string
  status: string
  description: string
  timestamp: string
  location?: string
  completed: boolean
}

interface Order {
  id: string
  orderNumber: string
  status: string
  statusDescription: string
  orderDate: string
  estimatedDelivery: string
  totalAmount: number
  items: number
  trackingNumber?: string
  statusHistory: OrderStatus[]
  shippingAddress: {
    name: string
    address: string
    city: string
    phone: string
  }
}

export default function OrderTrackingPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Mock order data - in real app, this would come from API
  const mockOrders: Order[] = [
    {
      id: '1',
      orderNumber: 'HC-2025-001234',
      status: 'shipped',
      statusDescription: 'Your order has been shipped and is on its way',
      orderDate: '2025-01-15',
      estimatedDelivery: '2025-01-20',
      totalAmount: 125000,
      items: 3,
      trackingNumber: 'TZ123456789',
      statusHistory: [
        {
          id: '1',
          status: 'Order Placed',
          description: 'Your order has been successfully placed',
          timestamp: '2025-01-15T10:30:00Z',
          completed: true
        },
        {
          id: '2',
          status: 'Processing',
          description: 'Your order is being prepared for shipment',
          timestamp: '2025-01-15T14:20:00Z',
          completed: true
        },
        {
          id: '3',
          status: 'Shipped',
          description: 'Your order has been shipped and is on its way',
          timestamp: '2025-01-16T09:15:00Z',
          location: 'Dar es Salaam Warehouse',
          completed: true
        },
        {
          id: '4',
          status: 'In Transit',
          description: 'Your order is currently in transit',
          timestamp: '2025-01-17T11:45:00Z',
          location: 'Arusha Distribution Center',
          completed: false
        },
        {
          id: '5',
          status: 'Out for Delivery',
          description: 'Your order is out for delivery',
          timestamp: '2025-01-20T08:00:00Z',
          completed: false
        }
      ],
      shippingAddress: {
        name: 'John Mwalimu',
        address: '123 Mwenge Street, Kinondoni',
        city: 'Dar es Salaam',
        phone: '+255 123 456 789'
      }
    },
    {
      id: '2',
      orderNumber: 'HC-2025-001235',
      status: 'delivered',
      statusDescription: 'Your order has been successfully delivered',
      orderDate: '2025-01-10',
      estimatedDelivery: '2025-01-15',
      totalAmount: 75000,
      items: 2,
      trackingNumber: 'TZ123456790',
      statusHistory: [
        {
          id: '1',
          status: 'Order Placed',
          description: 'Your order has been successfully placed',
          timestamp: '2025-01-10T15:20:00Z',
          completed: true
        },
        {
          id: '2',
          status: 'Processing',
          description: 'Your order is being prepared for shipment',
          timestamp: '2025-01-10T16:45:00Z',
          completed: true
        },
        {
          id: '3',
          status: 'Shipped',
          description: 'Your order has been shipped and is on its way',
          timestamp: '2025-01-11T10:30:00Z',
          location: 'Dar es Salaam Warehouse',
          completed: true
        },
        {
          id: '4',
          status: 'Delivered',
          description: 'Your order has been successfully delivered',
          timestamp: '2025-01-15T14:20:00Z',
          location: '123 Mwenge Street, Kinondoni',
          completed: true
        }
      ],
      shippingAddress: {
        name: 'Sarah Kimaro',
        address: '456 Upanga Road, Ilala',
        city: 'Dar es Salaam',
        phone: '+255 987 654 321'
      }
    }
  ]

  const filteredOrders = mockOrders.filter(order => 
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'shipped':
      case 'in_transit':
        return <Truck className="w-5 h-5 text-blue-500" />
      case 'processing':
        return <Package className="w-5 h-5 text-orange-500" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'shipped':
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'processing':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const handleTrackOrder = () => {
    setIsSearching(true)
    // Simulate API call
    setTimeout(() => {
      setIsSearching(false)
      // In real app, would search for order and display results
    }, 1000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-TZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
          <h1 className="text-4xl font-bold mb-4">Order Tracking</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Track your orders and stay updated on delivery status
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search by order number or tracking number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleTrackOrder()
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
                <Eye className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">View All Orders</h3>
              <p className="text-sm text-muted-foreground mb-4">See your complete order history</p>
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
              <h3 className="font-semibold mb-2">Refresh Status</h3>
              <p className="text-sm text-muted-foreground mb-4">Get the latest order updates</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={handleTrackOrder}
                disabled={isSearching}
              >
                {isSearching ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Download Invoice</h3>
              <p className="text-sm text-muted-foreground mb-4">Get your order receipts</p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Orders</h2>
            {isAuthenticated && (
              <Link href="/account/orders">
                <Button variant="outline" className="flex items-center gap-2">
                  View All Orders
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>

          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Try searching with a different order number' : 'You don\'t have any orders yet'}
                </p>
                {!isAuthenticated && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Sign in to view your orders</p>
                    <Button onClick={() => router.push('/auth/login')}>
                      Sign In
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Order #{order.orderNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Placed on {formatDate(order.orderDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusIcon(order.status)}
                        <span className="ml-2 capitalize">{order.status.replace('_', ' ')}</span>
                      </Badge>
                      {isAuthenticated && (
                        <Link href={`/account/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Order Summary */}
                    <div>
                      <h4 className="font-semibold mb-2">Order Summary</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Items: {order.items}</p>
                        <p>Total: {formatCurrency(order.totalAmount)}</p>
                        <p>Est. Delivery: {formatDate(order.estimatedDelivery)}</p>
                        {order.trackingNumber && (
                          <p>Tracking: {order.trackingNumber}</p>
                        )}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div>
                      <h4 className="font-semibold mb-2">Shipping Address</h4>
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium">{order.shippingAddress.name}</p>
                        <p>{order.shippingAddress.address}</p>
                        <p>{order.shippingAddress.city}</p>
                        <p>{order.shippingAddress.phone}</p>
                      </div>
                    </div>

                    {/* Status Timeline */}
                    <div>
                      <h4 className="font-semibold mb-2">Status Timeline</h4>
                      <div className="space-y-2">
                        {order.statusHistory.slice(-3).map((status, index) => (
                          <div key={status.id} className="flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full ${
                              status.completed ? 'bg-green-500' : 'bg-gray-300'
                            }`} />
                            <span className={status.completed ? 'text-foreground' : 'text-muted-foreground'}>
                              {status.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Status Description */}
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {order.statusDescription}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Contact Support CTA */}
        <div className="mt-16">
          <Card className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Need help with your order?</h2>
              <p className="text-xl mb-8 opacity-90">
                Our support team is here to help you track your orders
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
