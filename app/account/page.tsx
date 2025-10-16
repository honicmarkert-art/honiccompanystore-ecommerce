"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  User, 
  ShoppingBag, 
  Heart, 
  MessageCircle, 
  CreditCard, 
  Coins, 
  Ticket,
  Settings,
  LogOut,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Menu,
  X,
  ChevronRight,
  ShoppingCart
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { useCompanyContext } from '@/components/company-provider'
import { useCart } from '@/hooks/use-cart'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { ProtectedRoute } from '@/components/protected-route'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase-auth'

interface Order {
  id: string
  orderNumber: string
  date: Date
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  items: number
}

interface Coupon {
  id: string
  code: string
  discount: number
  type: 'percentage' | 'fixed'
  validUntil: Date
  isUsed: boolean
}

function AccountPageContent() {
  const { user, signOut } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { companyName, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  const { cartTotalItems } = useCart()
  const router = useRouter()
  const { toast } = useToast()
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [activeCoupons, setActiveCoupons] = useState<Coupon[]>([])
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)
  const [coins, setCoins] = useState(1250)
  const [unreadMessages, setUnreadMessages] = useState(3)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [fullName, setFullName] = useState('')

  // Fallback logo system
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    // Mock data
    setRecentOrders([
      {
        id: '1',
        orderNumber: 'ORD-2024-001',
        date: new Date('2024-01-15'),
        status: 'delivered',
        total: 156.99,
        items: 3
      },
      {
        id: '2',
        orderNumber: 'ORD-2024-002',
        date: new Date('2024-01-10'),
        status: 'shipped',
        total: 89.50,
        items: 2
      },
      {
        id: '3',
        orderNumber: 'ORD-2024-003',
        date: new Date('2024-01-05'),
        status: 'processing',
        total: 234.75,
        items: 5
      }
    ])

    setActiveCoupons([
      {
        id: '1',
        code: 'SAVE20',
        discount: 20,
        type: 'percentage',
        validUntil: new Date('2024-02-15'),
        isUsed: false
      },
      {
        id: '2',
        code: 'FREESHIP',
        discount: 10,
        type: 'fixed',
        validUntil: new Date('2024-01-30'),
        isUsed: false
      }
    ])
  }, [])

  // Load profile from API (requires supabase access token)
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      setProfileLoading(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) { setProfileLoading(false); return }
        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (res.ok && json?.profile) {
          setFullName(json.profile.full_name || user?.name || '')
          setPhone(json.profile.phone || user?.profile?.phone || '')
          setAvatarUrl(user?.profile?.avatar || '')
        } else {
          setFullName(user?.name || '')
          setPhone(user?.profile?.phone || '')
          setAvatarUrl(user?.profile?.avatar || '')
        }
      } catch {}
      setProfileLoading(false)
    }
    loadProfile()
  }, [user])

  const saveProfile = async () => {
    try {
      setProfileSaving(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast({ title: 'Not authenticated', description: 'Please login again', variant: 'destructive' })
        setProfileSaving(false)
        return
      }
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: fullName, phone })
      })
      const json = await res.json()
      if (res.ok) {
        // Save avatar to auth metadata
        await supabase.auth.updateUser({ data: { full_name: fullName, phone, avatar_url: avatarUrl } })
        toast({ title: 'Profile saved', description: 'Your details were updated.' })
      } else {
        toast({ title: 'Failed to save', description: json?.error || 'Try again', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save profile', variant: 'destructive' })
    } finally {
      setProfileSaving(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', 'image')
      form.append('context', 'profile')
      const resp = await fetch('/api/media/upload', { method: 'POST', body: form })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Upload failed')
      setAvatarUrl(data.url)
      toast({ title: 'Avatar uploaded' })
    } catch (e) {
      toast({ title: 'Upload failed', description: 'Please try another image', variant: 'destructive' })
    }
  }

  const changePassword = async () => {
    if (!password1 || password1.length < 8 || password1 !== password2) {
      toast({ title: 'Invalid password', description: 'Ensure passwords match and are 8+ chars', variant: 'destructive' })
      return
    }
    try {
      setIsChangingPassword(true)
      const { error } = await supabase.auth.updateUser({ password: password1 })
      if (error) throw error
      setPassword1(''); setPassword2('')
      toast({ title: 'Password updated' })
    } catch (e) {
      toast({ title: 'Failed to update password', variant: 'destructive' })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>
      case 'shipped':
        return <Badge className="bg-blue-100 text-blue-800">Shipped</Badge>
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'shipped':
        return <Truck className="w-4 h-4 text-blue-600" />
      case 'processing':
        return <Package className="w-4 h-4 text-yellow-600" />
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-600" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Package className="w-4 h-4" />
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast({
        title: 'Success',
        description: 'Logged out successfully',
      })
      router.push('/')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to logout',
        variant: 'destructive'
      })
    }
  }

  const getUserName = () => {
    if (user?.name) {
      return user.name
    }
    return user?.email?.split('@')[0] || 'User'
  }

  const getUserInitials = () => {
    const name = getUserName()
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Mobile Hamburger Menu Button */}
      <div className="block sm:hidden mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="flex items-center justify-center w-8 h-8"
          onClick={() => setIsHamburgerMenuOpen(true)}
        >
          <Menu className="w-6 h-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        {/* Remove avatar/email and welcome headline from Overview header */}
      </div>

      {/* Profile editing moved to Settings page - removed from Overview */}

      {/* Security moved to Settings page */}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{recentOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Coins className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">My Coins</p>
                <p className="text-2xl font-bold">{coins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Wishlist</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Messages</p>
                <p className="text-2xl font-bold">{unreadMessages}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Recent Orders</span>
            </CardTitle>
            <Button variant="outline" onClick={() => router.push('/account/orders')}>
              View All Orders
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(order.status)}
                  <div>
                    <p className="font-medium">Order #{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items} items • ${order.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.date.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {getStatusBadge(order.status)}
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Coupons */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Ticket className="w-5 h-5" />
              <span>My Coupons</span>
            </CardTitle>
            <Button variant="outline" onClick={() => router.push('/account/coupons')}>
              View All Coupons
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCoupons.map((coupon) => (
              <div key={coupon.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-lg">{coupon.code}</span>
                  <Badge variant="outline">
                    {coupon.type === 'percentage' ? `${coupon.discount}%` : `$${coupon.discount}`}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Valid until {coupon.validUntil.toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/orders')}
        >
          <ShoppingBag className="w-6 h-6" />
          <span>My Orders</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/coins')}
        >
          <Coins className="w-6 h-6" />
          <span>My Coins</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/messages')}
        >
          <MessageCircle className="w-6 h-6" />
          <span>Message Center</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/payment')}
        >
          <CreditCard className="w-6 h-6" />
          <span>Payment</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/wishlist')}
        >
          <Heart className="w-6 h-6" />
          <span>Wish List</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/coupons')}
        >
          <Ticket className="w-6 h-6" />
          <span>My Coupons</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2"
          onClick={() => router.push('/account/settings')}
        >
          <Settings className="w-6 h-6" />
          <span>Settings</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex-col space-y-2 text-red-600 hover:text-red-700"
          onClick={handleLogout}
        >
          <LogOut className="w-6 h-6" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className={`hamburger-overlay ${isHamburgerMenuOpen ? 'open' : ''}`} onClick={() => setIsHamburgerMenuOpen(false)} />
      <div className={`hamburger-menu ${isHamburgerMenuOpen ? 'open' : ''}`}>
        {/* Header with Logo and Close */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <Image
              src={displayLogo}
              alt={`${companyName} Logo`}
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg"
            />
            <div>
              <h2 className="text-lg font-bold text-white">{companyName}</h2>
              <p className="text-xs text-white/70">Menu</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHamburgerMenuOpen(false)}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="flex flex-col h-full">
          {/* Main Navigation */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    href="/products"
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Package className="w-6 h-6 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-xs font-medium text-white">Products</span>
                  </Link>
                  
                  <Link 
                    href="/cart"
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <div className="relative">
                      <ShoppingCart className="w-6 h-6 text-white group-hover:text-yellow-400 transition-colors" />
                      {cartTotalItems > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-black">
                          {cartTotalItems}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-white">Cart</span>
                  </Link>
                </div>
              </div>

              {/* Account Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Account</h3>
                <div className="space-y-2">
                  <Link 
                    href="/account"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <User className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">My Account</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/orders"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <ShoppingBag className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">My Orders</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/wishlist"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Heart className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">Wishlist</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/messages"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <MessageCircle className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">Messages</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/payment"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <CreditCard className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">Payment</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/coins"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Coins className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">My Coins</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/coupons"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Ticket className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">My Coupons</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                  <Link 
                    href="/account/settings"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">Settings</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with User Info */}
          <div className="p-6 border-t border-white/10 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10">
              <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                <span className="text-black font-bold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">{user?.email}</p>
                <p className="text-white/60 text-xs">Welcome back!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountPageContent />
    </ProtectedRoute>
  )
} 
 