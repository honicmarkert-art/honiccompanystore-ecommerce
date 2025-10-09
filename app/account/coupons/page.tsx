"use client"

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Ticket, 
  Search, 
  Filter,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  Gift,
  Percent,
  DollarSign
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'

interface Coupon {
  id: string
  code: string
  name: string
  description: string
  discount: number
  type: 'percentage' | 'fixed'
  minAmount?: number
  maxDiscount?: number
  validFrom: Date
  validUntil: Date
  isUsed: boolean
  usedDate?: Date
  orderId?: string
  category?: string
  isActive: boolean
}

function CouponsPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [filteredCoupons, setFilteredCoupons] = useState<Coupon[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock coupons data
    const mockCoupons: Coupon[] = [
      {
        id: '1',
        code: 'SAVE20',
        name: '20% Off Electronics',
        description: 'Get 20% off on all electronics and gadgets',
        discount: 20,
        type: 'percentage',
        minAmount: 50,
        maxDiscount: 100,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-02-15'),
        isUsed: false,
        isActive: true,
        category: 'Electronics'
      },
      {
        id: '2',
        code: 'FREESHIP',
        name: 'Free Shipping',
        description: 'Free shipping on orders over $100',
        discount: 10,
        type: 'fixed',
        minAmount: 100,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-01-30'),
        isUsed: false,
        isActive: true,
        category: 'Shipping'
      },
      {
        id: '3',
        code: 'WELCOME50',
        name: '50% Off First Order',
        description: 'Half price on your first order',
        discount: 50,
        type: 'percentage',
        minAmount: 25,
        maxDiscount: 200,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-03-31'),
        isUsed: true,
        usedDate: new Date('2024-01-15'),
        orderId: 'ORD-2024-001',
        isActive: false,
        category: 'Welcome'
      },
      {
        id: '4',
        code: 'FLASH25',
        name: 'Flash Sale 25% Off',
        description: 'Limited time 25% discount on selected items',
        discount: 25,
        type: 'percentage',
        minAmount: 30,
        validFrom: new Date('2024-01-10'),
        validUntil: new Date('2024-01-20'),
        isUsed: false,
        isActive: true,
        category: 'Flash Sale'
      },
      {
        id: '5',
        code: 'LOYALTY10',
        name: 'Loyalty Reward',
        description: '10% off for loyal customers',
        discount: 10,
        type: 'percentage',
        minAmount: 75,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-12-31'),
        isUsed: false,
        isActive: true,
        category: 'Loyalty'
      },
      {
        id: '6',
        code: 'BIRTHDAY15',
        name: 'Birthday Special',
        description: '15% off on your birthday month',
        discount: 15,
        type: 'percentage',
        minAmount: 40,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-01-31'),
        isUsed: false,
        isActive: true,
        category: 'Special'
      }
    ]

    setCoupons(mockCoupons)
    setFilteredCoupons(mockCoupons)
    setIsLoading(false)
  }, [])

  // Filter coupons based on search and status
  useEffect(() => {
    let filtered = coupons

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(coupon =>
        coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coupon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coupon.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(coupon => {
        switch (statusFilter) {
          case 'active':
            return coupon.isActive && !coupon.isUsed && new Date() <= coupon.validUntil
          case 'used':
            return coupon.isUsed
          case 'expired':
            return new Date() > coupon.validUntil
          default:
            return true
        }
      })
    }

    setFilteredCoupons(filtered)
  }, [searchTerm, statusFilter, coupons])

  const getStatusBadge = (coupon: Coupon) => {
    if (coupon.isUsed) {
      return <Badge className="bg-gray-100 text-gray-800">Used</Badge>
    }
    if (new Date() > coupon.validUntil) {
      return <Badge className="bg-red-100 text-red-800">Expired</Badge>
    }
    if (!coupon.isActive) {
      return <Badge className="bg-yellow-100 text-yellow-800">Inactive</Badge>
    }
    return <Badge className="bg-green-100 text-green-800">Active</Badge>
  }

  const getDiscountIcon = (type: string) => {
    return type === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    // In real app, show a toast notification
  }

  const handleViewOrder = (orderId: string) => {
    router.push(`/account/orders/${orderId}`)
  }

  const isExpired = (validUntil: Date) => {
    return new Date() > validUntil
  }

  const isExpiringSoon = (validUntil: Date) => {
    const daysUntilExpiry = Math.ceil((validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading coupons...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Coupons</h1>
        <p className="text-muted-foreground">Manage your discount coupons and promotional codes</p>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search coupons by code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCoupons.map((coupon) => (
          <Card key={coupon.id} className={`relative ${coupon.isUsed || isExpired(coupon.validUntil) ? 'opacity-75' : ''}`}>
            {coupon.isUsed && (
              <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center z-10">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Ticket className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold">{coupon.name}</h3>
                </div>
                {getStatusBadge(coupon)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {coupon.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getDiscountIcon(coupon.type)}
                    <span className="font-bold text-lg">
                      {coupon.type === 'percentage' ? `${coupon.discount}%` : `$${coupon.discount}`}
                    </span>
                    {coupon.type === 'percentage' && coupon.maxDiscount && (
                      <span className="text-xs text-muted-foreground">
                        (max ${coupon.maxDiscount})
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-lg bg-gray-100 px-3 py-1 rounded">
                      {coupon.code}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {coupon.minAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minimum Order:</span>
                    <span>${coupon.minAmount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span className={isExpired(coupon.validUntil) ? 'text-red-600' : ''}>
                    {coupon.validUntil.toLocaleDateString()}
                  </span>
                </div>
                {coupon.category && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{coupon.category}</span>
                  </div>
                )}
              </div>

              {isExpiringSoon(coupon.validUntil) && !coupon.isUsed && (
                <div className="flex items-center space-x-2 p-2 bg-yellow-50 rounded">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">Expires soon!</span>
                </div>
              )}

              {coupon.isUsed && coupon.usedDate && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used on:</span>
                    <span>{coupon.usedDate.toLocaleDateString()}</span>
                  </div>
                  {coupon.orderId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleViewOrder(coupon.orderId!)}
                    >
                      View Order
                    </Button>
                  )}
                </div>
              )}

              {!coupon.isUsed && !isExpired(coupon.validUntil) && (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyCode(coupon.code)}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => router.push('/products')}
                    className="flex-1"
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    Use Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredCoupons.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'No coupons found' 
                : 'No coupons available'
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'You don\'t have any coupons yet. Earn coupons by making purchases or participating in promotions.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => router.push('/products')}>
                Start Shopping
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {coupons.length > 0 && (
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{coupons.length}</p>
                <p className="text-sm text-muted-foreground">Total Coupons</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {coupons.filter(c => c.isActive && !c.isUsed && new Date() <= c.validUntil).length}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {coupons.filter(c => c.isUsed).length}
                </p>
                <p className="text-sm text-muted-foreground">Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {coupons.filter(c => new Date() > c.validUntil).length}
                </p>
                <p className="text-sm text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How to Earn Coupons */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How to Earn Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-medium mb-2">Make Purchases</h4>
              <p className="text-sm text-muted-foreground">
                Earn coupons automatically when you reach spending milestones
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-medium mb-2">Complete Orders</h4>
              <p className="text-sm text-muted-foreground">
                Get bonus coupons when your orders are successfully delivered
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Ticket className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-medium mb-2">Special Promotions</h4>
              <p className="text-sm text-muted-foreground">
                Participate in seasonal events and promotional campaigns
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CouponsPage() {
  return (
    <ProtectedRoute>
      <CouponsPageContent />
    </ProtectedRoute>
  )
} 
 