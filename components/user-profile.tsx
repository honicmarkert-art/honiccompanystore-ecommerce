"use client"

import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings, ShoppingBag, Heart, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

export function UserProfile() {
  const { user, signOut } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const router = useRouter()
  const { toast } = useToast()

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
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
    }
    return user?.email?.split('@')[0] || 'User'
  }

  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
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
                window.location.reload()
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
    <div className="flex flex-col items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full bg-gradient-to-br from-green-400 via-blue-500 to-indigo-600 hover:from-green-500 hover:via-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={getUserName()} />
              <AvatarFallback className="bg-transparent text-white font-semibold">{getUserInitials(user.email || '')}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getUserName()}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
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
      <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        Hi! {getUserName()}
      </span>
    </div>
  )
} 