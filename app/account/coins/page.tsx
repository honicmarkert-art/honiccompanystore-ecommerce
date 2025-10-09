"use client"

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
import { logger } from '@/lib/logger'
  Coins, 
  Gift, 
  TrendingUp, 
  History, 
  Plus, 
  Minus,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingBag
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'

interface CoinTransaction {
  id: string
  type: 'earned' | 'spent' | 'expired'
  amount: number
  description: string
  date: Date
  orderId?: string
  status: 'pending' | 'completed' | 'expired'
}

interface CoinReward {
  id: string
  name: string
  coinsRequired: number
  discount: number
  type: 'percentage' | 'fixed'
  validUntil: Date
  isAvailable: boolean
}

function CoinsPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [totalCoins, setTotalCoins] = useState(1250)
  const [availableCoins, setAvailableCoins] = useState(850)
  const [pendingCoins, setPendingCoins] = useState(400)
  const [transactions, setTransactions] = useState<CoinTransaction[]>([])
  const [rewards, setRewards] = useState<CoinReward[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock transactions data
    const mockTransactions: CoinTransaction[] = [
      {
        id: '1',
        type: 'earned',
        amount: 150,
        description: 'Order ORD-2024-001 completed',
        date: new Date('2024-01-15'),
        orderId: 'ORD-2024-001',
        status: 'completed'
      },
      {
        id: '2',
        type: 'earned',
        amount: 100,
        description: 'Order ORD-2024-002 completed',
        date: new Date('2024-01-10'),
        orderId: 'ORD-2024-002',
        status: 'completed'
      },
      {
        id: '3',
        type: 'spent',
        amount: -200,
        description: 'Redeemed for 20% discount coupon',
        date: new Date('2024-01-08'),
        status: 'completed'
      },
      {
        id: '4',
        type: 'earned',
        amount: 300,
        description: 'Order ORD-2024-003 placed',
        date: new Date('2024-01-05'),
        orderId: 'ORD-2024-003',
        status: 'pending'
      },
      {
        id: '5',
        type: 'earned',
        amount: 50,
        description: 'Welcome bonus',
        date: new Date('2024-01-01'),
        status: 'completed'
      },
      {
        id: '6',
        type: 'expired',
        amount: -75,
        description: 'Coins expired',
        date: new Date('2023-12-15'),
        status: 'expired'
      }
    ]

    // Mock rewards data
    const mockRewards: CoinReward[] = [
      {
        id: '1',
        name: '20% Off Next Order',
        coinsRequired: 200,
        discount: 20,
        type: 'percentage',
        validUntil: new Date('2024-02-15'),
        isAvailable: true
      },
      {
        id: '2',
        name: 'Free Shipping',
        coinsRequired: 150,
        discount: 10,
        type: 'fixed',
        validUntil: new Date('2024-01-30'),
        isAvailable: true
      },
      {
        id: '3',
        name: '50% Off Electronics',
        coinsRequired: 500,
        discount: 50,
        type: 'percentage',
        validUntil: new Date('2024-02-28'),
        isAvailable: true
      },
      {
        id: '4',
        name: '$25 Cash Back',
        coinsRequired: 1000,
        discount: 25,
        type: 'fixed',
        validUntil: new Date('2024-03-15'),
        isAvailable: false
      }
    ]

    setTransactions(mockTransactions)
    setRewards(mockRewards)
    setIsLoading(false)
  }, [])

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned':
        return <Plus className="w-4 h-4 text-green-600" />
      case 'spent':
        return <Minus className="w-4 h-4 text-red-600" />
      case 'expired':
        return <Clock className="w-4 h-4 text-gray-600" />
      default:
        return <Coins className="w-4 h-4" />
    }
  }

  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const handleRedeemReward = (rewardId: string) => {
    // In real app, this would call an API to redeem the reward
    logger.log('Redeeming reward:', rewardId)
  }

  const handleViewOrder = (orderId: string) => {
    router.push(`/account/orders/${orderId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading coins...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Coins</h1>
        <p className="text-muted-foreground">Earn, spend, and track your reward coins</p>
      </div>

      {/* Coin Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Coins className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Coins</p>
                <p className="text-2xl font-bold">{availableCoins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Coins</p>
                <p className="text-2xl font-bold">{pendingCoins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">{totalCoins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress to Next Level */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Progress to Gold Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Current Level: Silver</span>
              <span>Next Level: Gold (2000 coins)</span>
            </div>
            <Progress value={62.5} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {totalCoins} / 2000 coins earned
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Rewards */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gift className="w-5 h-5" />
            <span>Available Rewards</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((reward) => (
              <div key={reward.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{reward.name}</h4>
                  <Badge variant={reward.isAvailable ? "default" : "secondary"}>
                    {reward.coinsRequired} coins
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {reward.type === 'percentage' 
                    ? `${reward.discount}% discount` 
                    : `$${reward.discount} off`
                  }
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Valid until {reward.validUntil.toLocaleDateString()}
                  </span>
                  <Button 
                    size="sm" 
                    disabled={!reward.isAvailable || availableCoins < reward.coinsRequired}
                    onClick={() => handleRedeemReward(reward.id)}
                  >
                    {reward.isAvailable && availableCoins >= reward.coinsRequired 
                      ? 'Redeem' 
                      : 'Not Enough Coins'
                    }
                  </Button>
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
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.date.toLocaleDateString()}
                    </p>
                    {transaction.orderId && (
                      <button 
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => handleViewOrder(transaction.orderId!)}
                      >
                        View Order
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {getTransactionStatusIcon(transaction.status)}
                  <span className={`font-medium ${
                    transaction.type === 'earned' ? 'text-green-600' : 
                    transaction.type === 'spent' ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {transaction.type === 'earned' ? '+' : ''}{transaction.amount} coins
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How to Earn Coins */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How to Earn Coins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-medium mb-2">Make Purchases</h4>
              <p className="text-sm text-muted-foreground">
                Earn 10 coins for every $1 spent
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-medium mb-2">Complete Orders</h4>
              <p className="text-sm text-muted-foreground">
                Get bonus coins when orders are delivered
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-medium mb-2">Special Promotions</h4>
              <p className="text-sm text-muted-foreground">
                Earn extra coins during special events
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CoinsPage() {
  return (
    <ProtectedRoute>
      <CoinsPageContent />
    </ProtectedRoute>
  )
} 
 