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
  Building2
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'

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

interface Transaction {
  id: string
  date: Date
  amount: number
  description: string
  status: 'completed' | 'pending' | 'failed' | 'refunded'
  paymentMethod: string
  orderId?: string
}

function PaymentPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isAddMobileOpen, setIsAddMobileOpen] = useState(false)
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock payment methods data
    const mockPaymentMethods: PaymentMethod[] = [
      {
        id: '1',
        type: 'card',
        name: 'Visa ending in 1234',
        number: '**** **** **** 1234',
        expiry: '12/25',
        isDefault: true,
        isActive: true
      },
      {
        id: '2',
        type: 'mobile',
        name: 'M-Pesa',
        number: '+255 627 377 461',
        isDefault: false,
        isActive: true,
        provider: 'mpesa'
      },
      {
        id: '3',
        type: 'mobile',
        name: 'TigoPesa',
        number: '+255 627 377 461',
        isDefault: false,
        isActive: true,
        provider: 'tigopesa'
      },
      {
        id: '4',
        type: 'card',
        name: 'Mastercard ending in 5678',
        number: '**** **** **** 5678',
        expiry: '08/26',
        isDefault: false,
        isActive: false
      }
    ]

    // Mock transactions data
    const mockTransactions: Transaction[] = [
      {
        id: '1',
        date: new Date('2024-01-15'),
        amount: 156.99,
        description: 'Order ORD-2024-001',
        status: 'completed',
        paymentMethod: 'Visa ending in 1234',
        orderId: 'ORD-2024-001'
      },
      {
        id: '2',
        date: new Date('2024-01-10'),
        amount: 89.50,
        description: 'Order ORD-2024-002',
        status: 'completed',
        paymentMethod: 'M-Pesa',
        orderId: 'ORD-2024-002'
      },
      {
        id: '3',
        date: new Date('2024-01-05'),
        amount: 234.75,
        description: 'Order ORD-2024-003',
        status: 'pending',
        paymentMethod: 'TigoPesa',
        orderId: 'ORD-2024-003'
      },
      {
        id: '4',
        date: new Date('2024-01-01'),
        amount: 67.25,
        description: 'Order ORD-2024-004',
        status: 'failed',
        paymentMethod: 'Mastercard ending in 5678',
        orderId: 'ORD-2024-004'
      }
    ]

    setPaymentMethods(mockPaymentMethods)
    setTransactions(mockTransactions)
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

  const handleViewOrder = (orderId: string) => {
    router.push(`/account/orders/${orderId}`)
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
        <h1 className="text-3xl font-bold">Payment Methods</h1>
        <p className="text-muted-foreground">Manage your payment methods and view transaction history</p>
      </div>

      {/* Payment Methods */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Methods</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setIsAddCardOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Card
              </Button>
              <Button variant="outline" onClick={() => setIsAddMobileOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Mobile Money
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.paymentMethod} • {transaction.date.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {getStatusBadge(transaction.status)}
                  <span className="font-bold">${transaction.amount.toFixed(2)}</span>
                  {transaction.orderId && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewOrder(transaction.orderId!)}
                    >
                      View Order
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
 