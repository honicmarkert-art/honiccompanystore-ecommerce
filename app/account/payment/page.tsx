"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  CheckCircle,
  AlertCircle,
  Wallet,
  Smartphone,
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
  Home,
  Truck
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { usePaymentStatuses, PaymentStatus } from '@/hooks/use-payment-statuses'

interface PaymentMethod {
  id: string
  type: 'card' | 'mobile' | 'bank'
  name: string
  number: string
  expiry?: string
  isDefault: boolean
  isActive: boolean
  provider?: string
  accountName?: string
}

// Transaction interface is now replaced by PaymentStatus from the hook

interface BillingInfo {
  id: string
  fullName: string
  email: string
  phone: string
  company?: string
  address: string
  city: string
  region: string
  postalCode: string
  country: string
  isDefault: boolean
}

interface DeliveryInfo {
  id: string
  fullName: string
  phone: string
  address: string
  city: string
  region: string
  postalCode: string
  country: string
  instructions?: string
  isDefault: boolean
}

function PaymentPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { paymentStatuses, loading: paymentStatusesLoading, error: paymentStatusesError } = usePaymentStatuses()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [billingInfo, setBillingInfo] = useState<BillingInfo[]>([])
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo[]>([])
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isAddMobileOpen, setIsAddMobileOpen] = useState(false)
  const [isAddBillingOpen, setIsAddBillingOpen] = useState(false)
  const [isAddDeliveryOpen, setIsAddDeliveryOpen] = useState(false)
  const [newCardData, setNewCardData] = useState({
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: ''
  })
  const [newMobileData, setNewMobileData] = useState({
    phoneNumber: '',
    provider: 'mpesa'
  })
  const [newBillingData, setNewBillingData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'Tanzania'
  })
  const [newDeliveryData, setNewDeliveryData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'Tanzania',
    instructions: ''
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize with empty arrays - data will be loaded from API
    setPaymentMethods([])
    setBillingInfo([])
    setDeliveryInfo([])
    setIsLoading(false)
  }, [])

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'card':
        return <CreditCard className="w-5 h-5" />
      case 'mobile':
        return <Smartphone className="w-5 h-5" />
          case 'bank':
      return <Building2 className="w-5 h-5" />
      default:
        return <Wallet className="w-5 h-5" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'refunded':
        return <Badge className="bg-blue-100 text-blue-800">Refunded</Badge>
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getProviderIcon = (provider?: string) => {
    switch (provider) {
      case 'mpesa':
        return <div className="w-6 h-6 bg-green-600 rounded"></div>
      case 'tigopesa':
        return <div className="w-6 h-6 bg-blue-600 rounded"></div>
      case 'halopesa':
        return <div className="w-6 h-6 bg-purple-600 rounded"></div>
      default:
        return <Wallet className="w-5 h-5" />
    }
  }

  const handleAddCard = () => {
    if (!newCardData.cardNumber || !newCardData.cardholderName || !newCardData.expiryDate || !newCardData.cvv) {
      return
    }

    const newCard: PaymentMethod = {
      id: Date.now().toString(),
      type: 'card',
      name: `${newCardData.cardholderName} ending in ${newCardData.cardNumber.slice(-4)}`,
      number: `**** **** **** ${newCardData.cardNumber.slice(-4)}`,
      expiry: newCardData.expiryDate,
      isDefault: false,
      isActive: true
    }

    setPaymentMethods(prev => [...prev, newCard])
    setNewCardData({
      cardNumber: '',
      cardholderName: '',
      expiryDate: '',
      cvv: ''
    })
    setIsAddCardOpen(false)
  }

  const handleAddMobile = () => {
    if (!newMobileData.phoneNumber || !newMobileData.provider) {
      return
    }

    const newMobile: PaymentMethod = {
      id: Date.now().toString(),
      type: 'mobile',
      name: newMobileData.provider === 'mpesa' ? 'M-Pesa' : 
            newMobileData.provider === 'tigopesa' ? 'TigoPesa' : 'Halopesa',
      number: newMobileData.phoneNumber,
      isDefault: false,
      isActive: true,
      provider: newMobileData.provider
    }

    setPaymentMethods(prev => [...prev, newMobile])
    setNewMobileData({
      phoneNumber: '',
      provider: 'mpesa'
    })
    setIsAddMobileOpen(false)
  }

  const handleSetDefault = (id: string) => {
    setPaymentMethods(prev => prev.map(method => ({
      ...method,
      isDefault: method.id === id
    })))
  }

  const handleDeleteMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(method => method.id !== id))
  }

  const handleViewOrder = (orderNumber: string) => {
    router.push(`/account/orders?order=${orderNumber}`)
  }

  const handleAddBilling = () => {
    if (!newBillingData.fullName || !newBillingData.email || !newBillingData.phone || !newBillingData.address || !newBillingData.city) {
      return
    }

    const newBilling: BillingInfo = {
      id: Date.now().toString(),
      ...newBillingData,
      isDefault: billingInfo.length === 0
    }

    setBillingInfo(prev => [...prev, newBilling])
    setNewBillingData({
      fullName: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      region: '',
      postalCode: '',
      country: 'Tanzania'
    })
    setIsAddBillingOpen(false)
  }

  const handleAddDelivery = () => {
    if (!newDeliveryData.fullName || !newDeliveryData.phone || !newDeliveryData.address || !newDeliveryData.city) {
      return
    }

    const newDelivery: DeliveryInfo = {
      id: Date.now().toString(),
      ...newDeliveryData,
      isDefault: deliveryInfo.length === 0
    }

    setDeliveryInfo(prev => [...prev, newDelivery])
    setNewDeliveryData({
      fullName: '',
      phone: '',
      address: '',
      city: '',
      region: '',
      postalCode: '',
      country: 'Tanzania',
      instructions: ''
    })
    setIsAddDeliveryOpen(false)
  }

  const handleSetDefaultBilling = (id: string) => {
    setBillingInfo(prev => prev.map(info => ({
      ...info,
      isDefault: info.id === id
    })))
  }

  const handleSetDefaultDelivery = (id: string) => {
    setDeliveryInfo(prev => prev.map(info => ({
      ...info,
      isDefault: info.id === id
    })))
  }

  const handleDeleteBilling = (id: string) => {
    setBillingInfo(prev => prev.filter(info => info.id !== id))
  }

  const handleDeleteDelivery = (id: string) => {
    setDeliveryInfo(prev => prev.filter(info => info.id !== id))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading payment methods...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Payment & Billing Information</h1>
        <p className="text-muted-foreground">Manage your payment methods, billing, and delivery information for faster checkout</p>
      </div>

      {/* Payment Methods */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Payment Methods</h3>
              <p className="text-muted-foreground mb-4">
                Add a payment method to make checkout faster and more convenient.
              </p>
              <div className="flex justify-center space-x-2">
                <Button onClick={() => setIsAddCardOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
                <Button variant="outline" onClick={() => setIsAddMobileOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Mobile Money
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {method.type === 'mobile' ? getProviderIcon(method.provider) : getPaymentIcon(method.type)}
                      <div>
                        <h4 className="font-medium">{method.name}</h4>
                        <p className="text-sm text-muted-foreground">{method.number}</p>
                        {method.expiry && (
                          <p className="text-xs text-muted-foreground">Expires {method.expiry}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {method.isDefault && (
                        <Badge className="bg-green-100 text-green-800">Default</Badge>
                      )}
                      {!method.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      {!method.isDefault && method.isActive && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={!method.isActive}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteMethod(method.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-muted-foreground">Secure</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Billing Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingInfo.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Billing Addresses</h3>
              <p className="text-muted-foreground mb-4">
                Add a billing address to speed up checkout and ensure accurate invoicing.
              </p>
              <Button onClick={() => setIsAddBillingOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Billing Address
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {billingInfo.map((info) => (
                <div key={info.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium">{info.fullName}</h4>
                        <p className="text-sm text-muted-foreground">{info.email}</p>
                        <p className="text-sm text-muted-foreground">{info.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {info.isDefault && (
                        <Badge className="bg-green-100 text-green-800">Default</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    <p>{info.address}</p>
                    <p>{info.city}, {info.region} {info.postalCode}</p>
                    <p>{info.country}</p>
                    {info.company && <p>Company: {info.company}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      {!info.isDefault && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefaultBilling(info.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteBilling(info.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Information */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Delivery Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deliveryInfo.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Delivery Addresses</h3>
              <p className="text-muted-foreground mb-4">
                Add a delivery address to make checkout faster and ensure accurate delivery.
              </p>
              <Button onClick={() => setIsAddDeliveryOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Delivery Address
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliveryInfo.map((info) => (
                <div key={info.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-5 h-5 text-green-600" />
                      <div>
                        <h4 className="font-medium">{info.fullName}</h4>
                        <p className="text-sm text-muted-foreground">{info.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {info.isDefault && (
                        <Badge className="bg-green-100 text-green-800">Default</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    <p>{info.address}</p>
                    <p>{info.city}, {info.region} {info.postalCode}</p>
                    <p>{info.country}</p>
                    {info.instructions && (
                      <p className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <strong>Instructions:</strong> {info.instructions}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      {!info.isDefault && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefaultDelivery(info.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteDelivery(info.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ClickPesa Integration Notice */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wallet className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h4 className="font-medium">ClickPesa Integration</h4>
              <p className="text-sm text-muted-foreground">
                Your payment information will be securely processed through ClickPesa for all transactions. 
                Billing and delivery information will be used to auto-fill checkout forms for faster purchasing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentStatusesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-lg">Loading transaction history...</div>
            </div>
          ) : paymentStatusesError ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-lg text-red-600">Error loading transactions: {paymentStatusesError}</div>
            </div>
          ) : paymentStatuses.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-lg text-muted-foreground">No transactions found</div>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentStatuses.map((paymentStatus) => (
                <div key={paymentStatus.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">Order {paymentStatus.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {paymentStatus.payment_method} • {new Date(paymentStatus.created_at).toLocaleDateString()}
                      </p>
                      {paymentStatus.transaction_id && (
                        <p className="text-xs text-muted-foreground">
                          Transaction ID: {paymentStatus.transaction_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(paymentStatus.payment_status)}
                    <span className="font-bold">TZS {paymentStatus.amount.toFixed(0)}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewOrder(paymentStatus.order_number)}
                    >
                      View Order
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      {isAddCardOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Payment Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Card Number</label>
                <Input
                  value={newCardData.cardNumber}
                  onChange={(e) => setNewCardData(prev => ({ ...prev, cardNumber: e.target.value }))}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cardholder Name</label>
                <Input
                  value={newCardData.cardholderName}
                  onChange={(e) => setNewCardData(prev => ({ ...prev, cardholderName: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Expiry Date</label>
                  <Input
                    value={newCardData.expiryDate}
                    onChange={(e) => setNewCardData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">CVV</label>
                  <Input
                    value={newCardData.cvv}
                    onChange={(e) => setNewCardData(prev => ({ ...prev, cvv: e.target.value }))}
                    placeholder="123"
                    type="password"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddCardOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCard}>
                  Add Card
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Mobile Money Dialog */}
      {isAddMobileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Mobile Money</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Provider</label>
                <select
                  value={newMobileData.provider}
                  onChange={(e) => setNewMobileData(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="tigopesa">TigoPesa</option>
                  <option value="halopesa">Halopesa</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  value={newMobileData.phoneNumber}
                  onChange={(e) => setNewMobileData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+255 627 377 461"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddMobileOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMobile}>
                  Add Mobile Money
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Billing Dialog */}
      {isAddBillingOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Full Name *</label>
                  <Input
                    value={newBillingData.fullName}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    value={newBillingData.email}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                    type="email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone *</label>
                  <Input
                    value={newBillingData.phone}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+255 627 377 461"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Company</label>
                  <Input
                    value={newBillingData.company}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Company Name"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Address *</label>
                  <Input
                    value={newBillingData.address}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">City *</label>
                  <Input
                    value={newBillingData.city}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Dar es Salaam"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Region</label>
                  <Input
                    value={newBillingData.region}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, region: e.target.value }))}
                    placeholder="Dar es Salaam"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Postal Code</label>
                  <Input
                    value={newBillingData.postalCode}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="11101"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    value={newBillingData.country}
                    onChange={(e) => setNewBillingData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Tanzania"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddBillingOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddBilling}>
                  Add Billing Address
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Delivery Dialog */}
      {isAddDeliveryOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add Delivery Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Full Name *</label>
                  <Input
                    value={newDeliveryData.fullName}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone *</label>
                  <Input
                    value={newDeliveryData.phone}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+255 627 377 461"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Address *</label>
                  <Input
                    value={newDeliveryData.address}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">City *</label>
                  <Input
                    value={newDeliveryData.city}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Dar es Salaam"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Region</label>
                  <Input
                    value={newDeliveryData.region}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, region: e.target.value }))}
                    placeholder="Dar es Salaam"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Postal Code</label>
                  <Input
                    value={newDeliveryData.postalCode}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="11101"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    value={newDeliveryData.country}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Tanzania"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Delivery Instructions</label>
                  <Input
                    value={newDeliveryData.instructions}
                    onChange={(e) => setNewDeliveryData(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Leave at front door if no answer"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDeliveryOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddDelivery}>
                  Add Delivery Address
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Notice */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-green-600" />
            <div>
              <h4 className="font-medium">Secure Payment Processing</h4>
              <p className="text-sm text-muted-foreground">
                All payment information is encrypted and securely stored. We never store your full card details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <ProtectedRoute>
      <PaymentPageContent />
    </ProtectedRoute>
  )
} 
 