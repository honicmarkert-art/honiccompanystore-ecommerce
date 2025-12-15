"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings, ShoppingBag, Heart, CreditCard, Crown, ArrowUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface CurrentPlan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  term: string | null
}

export function UserProfile() {
  const { user, signOut } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const router = useRouter()
  const { toast } = useToast()
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null)
  const [isSupplier, setIsSupplier] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(true)

  const handleSignOut = async () => {
    try {
      await signOut()
      // signOut handles its own error display via toast
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getUserInitials = (email: string) => {
    return email.charAt(0).toUpperCase()
  }

  const getUserName = () => {
    // Handle different user object structures
    if (user?.name) {
      return user.name
    }
    if ((user as any)?.user_metadata?.full_name) {
      return (user as any).user_metadata.full_name
    }
    if ((user as any)?.user_metadata?.name) {
      return (user as any).user_metadata.name
    }
    return user?.email?.split('@')[0] || 'User'
  }
  
  const getUserAvatar = () => {
    // Handle different avatar sources
    if (user?.profile?.avatar) {
      return user.profile.avatar
    }
    if ((user as any)?.user_metadata?.avatar_url) {
      return (user as any).user_metadata.avatar_url
    }
    if ((user as any)?.user_metadata?.picture) {
      return (user as any).user_metadata.picture
    }
    return undefined
  }
  
  const getUserEmail = () => {
    return user?.email || ''
  }

  // Fetch current plan for suppliers
  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (!user) {
        setLoadingPlan(false)
        return
      }

      try {
        const response = await fetch('/api/user/current-plan', {
          credentials: 'include'
        })
        const data = await response.json()
        
        if (data.success) {
          setIsSupplier(data.isSupplier || false)
          setCurrentPlan(data.plan)
        }
      } catch (error) {
        console.error('Error fetching current plan:', error)
      } finally {
        setLoadingPlan(false)
      }
    }

    fetchCurrentPlan()
  }, [user])

  const isFreePlan = currentPlan?.slug === 'free'
  const isPremiumPlan = currentPlan?.slug === 'premium'

  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 sm:h-8 sm:w-8 rounded-full hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuItem className="p-0">
            <Button 
              onClick={() => openAuthModal('login')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white border border-gray-300 rounded-md"
            >
              Sign in
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAuthModal('register')} className="p-2">
            <span className="text-gray-400 hover:text-white cursor-pointer">Register</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/account/orders')}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            <span>My Orders</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/account/coins')}>
            <div className="mr-2 h-4 w-4 flex items-center justify-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full -ml-1"></div>
            </div>
            <span>My Coins</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/account/messages')}>
            <div className="mr-2 h-4 w-4 flex items-center justify-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
            <span>Message Center</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/account/payment')}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Payment</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/account/wishlist')}>
            <Heart className="mr-2 h-4 w-4" />
            <span>Wish List</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/account/coupons')}>
            <div className="mr-2 h-4 w-4 flex items-center justify-center">
              <div className="w-2 h-3 bg-green-500 rounded-sm"></div>
            </div>
            <span>My Coupons</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => {
              // Get current theme from localStorage or default to 'white'
              const currentTheme = (typeof window !== 'undefined' ? localStorage.getItem('backgroundColor') : 'white') || 'white'
              const themes = ['white', 'gray', 'dark']
              const currentIndex = themes.indexOf(currentTheme)
              const nextIndex = (currentIndex + 1) % themes.length
              const newTheme = themes[nextIndex]
              
              // Update localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('backgroundColor', newTheme)
                
                // Update HTML element class and color-scheme
                const htmlElement = document.documentElement
                if (newTheme === 'dark') {
                  htmlElement.className = 'dark'
                  htmlElement.style.colorScheme = 'dark'
                } else if (newTheme === 'gray') {
                  htmlElement.className = 'gray'
                  htmlElement.style.colorScheme = 'dark'
                } else {
                  htmlElement.className = 'light'
                  htmlElement.style.colorScheme = 'light'
                }
                
                // Reload page to apply theme changes
                router.refresh()
              }
            }}
          >
            <div className="mr-2 h-4 w-4 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            </div>
            <span>Change Theme Color</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-green-400 via-blue-500 to-indigo-600 hover:from-green-500 hover:via-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl">
          <Avatar className="h-8 w-8">
            <AvatarImage src={getUserAvatar()} alt={getUserName()} />
            <AvatarFallback className="bg-transparent text-white font-semibold text-sm">{getUserInitials(getUserEmail())}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getUserName()}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {getUserEmail()}
            </p>
            {/* Show current plan for suppliers */}
            {isSupplier && !loadingPlan && currentPlan && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className={cn(
                      "h-3 w-3",
                      isPremiumPlan ? "text-yellow-500" : "text-gray-400"
                    )} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {currentPlan.name}
                    </span>
                  </div>
                  {isFreePlan && (
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-black"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open('/become-supplier', '_blank', 'noopener,noreferrer')
                      }}
                    >
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Upgrade
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/account')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/account/orders')}>
          <ShoppingBag className="mr-2 h-4 w-4" />
          <span>My Orders</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/account/wishlist')}>
          <Heart className="mr-2 h-4 w-4" />
          <span>Wishlist</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/account/payment')}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Payment Methods</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/account/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 