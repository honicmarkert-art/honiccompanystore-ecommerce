"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Palette,
  DollarSign,
  Landmark,
  ShoppingCart,
  Image as ImageIcon,
  FileImage,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useCurrency } from "@/contexts/currency-context"
import { supabaseClient } from "@/lib/supabase-client"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { name: "Confirmed Orders", href: "/admin/confirmed-orders", icon: ShoppingCart },
  { name: "Categories", href: "/admin/categories", icon: Tags },
  { name: "Advertisements", href: "/admin/advertisements", icon: FileImage },
  { name: "Media", href: "/admin/media", icon: ImageIcon },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Settings", href: "/admin/settings", icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  const { signOut, user, loading, isAuthenticated, isAdmin } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currency, setCurrency } = useCurrency() // Use global currency context
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [orderCounts, setOrderCounts] = useState({
    pendingOrders: 0,
    confirmedOrders: 0,
    isLoading: true
  })

  // Admin authentication check
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || !user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to access the admin panel",
          variant: "destructive"
        })
        router.push('/auth/login?redirect=/admin')
        return
      }
      
      if (!isAdmin) {
        toast({
          title: "Access Denied",
          description: "Admin privileges required to access this area",
          variant: "destructive"
        })
        router.push('/')
        return
      }
    }
  }, [loading, isAuthenticated, user, isAdmin, router, toast])

  // Fetch order counts for navigation badges
  const fetchOrderCounts = async () => {
    try {
      const timestamp = Date.now()
      const pendingRes = await fetch(`/api/admin/orders?t=${timestamp}`, { cache: 'no-store' })
      
      
      const pendingData = pendingRes.ok ? await pendingRes.json() : { orders: [] }
      const pendingOrders = pendingData.orders?.length || 0
      

      let confirmedOrders = 0
      try {
        const confirmedRes = await fetch(`/api/admin/confirmed-orders?t=${timestamp}`, { cache: 'no-store' })
        if (confirmedRes.ok) {
          const confirmedData = await confirmedRes.json()
          confirmedOrders = confirmedData.orders?.length || 0
        }
      } catch (confirmedError) {
        confirmedOrders = 0
      }

      setOrderCounts({
        pendingOrders,
        confirmedOrders,
        isLoading: false
      })
    } catch (error) {
      setOrderCounts({
        pendingOrders: 0,
        confirmedOrders: 0,
        isLoading: false
      })
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (error) {
      toast({
        title: "Logout Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Fetch order counts on component mount
  useEffect(() => {
    fetchOrderCounts()
    
    // Refresh counts every 30 seconds
    const interval = setInterval(fetchOrderCounts, 30000)
    
    // Realtime: update counts on new orders and confirmed orders
    
    const ordersChannel = supabaseClient
      .channel('admin-layout-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrderCounts()
      })
      .subscribe((status) => {
        // Silent subscription handling
      })

    const confirmedChannel = supabaseClient
      .channel('admin-layout-confirmed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confirmed_orders' }, (payload) => {
        fetchOrderCounts()
      })
      .subscribe((status) => {
        // Silent subscription handling
      })
      
    return () => {
      clearInterval(interval)
      try {
        supabaseClient.getChannels().forEach(ch => {
          if (ch.topic?.includes('admin-layout-')) {
            supabaseClient.removeChannel(ch)
          }
        })
      } catch {}
    }
  }, [])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  // Don't render admin content if not authenticated or not admin
  if (!isAuthenticated || !user || !isAdmin) {
    return null
  }

  return (
    <div className={cn("flex h-screen", themeClasses.mainBg)} suppressHydrationWarning>
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-48 transform transition-transform duration-300 ease-in-out",
          themeClasses.cardBg,
          themeClasses.cardBorder,
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:inset-0"
        )}
        suppressHydrationWarning
      >
        <div className="flex h-full flex-col" suppressHydrationWarning>
          {/* Logo */}
          <div className={cn("flex h-16 items-center justify-between px-4", themeClasses.cardBorder, "border-b")} suppressHydrationWarning>
            <div className="flex items-center gap-2" suppressHydrationWarning>
              <Link href="/admin" className={cn("flex items-center gap-2", themeClasses.mainText)}>
                <Image
                  src="/placeholder.svg?height=48&width=48&text=Logo"
                  alt="Admin Logo"
                  width={48}
                  height={48}
                  className="rounded-md"
                />
                <span className="text-lg font-semibold">Admin Panel</span>
              </Link>
              <Link 
                href="/" 
                className={cn("ml-2 text-sm text-blue-500 hover:text-blue-600 underline", themeClasses.mainText)}
                title="Go to main site"
              >
                Home
              </Link>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              
              // Get count for specific navigation items
              let count = 0
              let showCount = false
              
              if (item.name === "Orders") {
                count = orderCounts.pendingOrders
                showCount = !orderCounts.isLoading
              } else if (item.name === "Confirmed Orders") {
                count = orderCounts.confirmedOrders
                showCount = !orderCounts.isLoading
              }
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md",
                    themeClasses.mainText,
                    themeClasses.buttonGhostHoverBg
                  )}
                >
                  <div className="flex items-center">
                    <Icon className={cn("mr-3 h-5 w-5", themeClasses.textNeutralSecondary)} />
                    {item.name}
                  </div>
                  
                  {/* Order Count Badge */}
                  {showCount && (
                    <span className={cn(
                      "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium",
                      count === 0 
                        ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        : item.name === "Orders" 
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                          : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                    )}>
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom section */}
          <div className={cn("border-t p-4", themeClasses.cardBorder)} suppressHydrationWarning>
            <div className="flex items-center justify-between mb-4" suppressHydrationWarning>
              <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>Currency</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex items-center gap-1",
                      themeClasses.mainText,
                      themeClasses.borderNeutralSecondary
                    )}
                  >
                    {currency === "USD" ? <DollarSign className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                    {currency}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                  <DropdownMenuItem
                    onClick={() => setCurrency("USD")}
                    className={themeClasses.buttonGhostHoverBg}
                  >
                    <DollarSign className="w-4 h-4 mr-2" /> USD
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setCurrency("TZS")}
                    className={themeClasses.buttonGhostHoverBg}
                  >
                    <Landmark className="w-4 h-4 mr-2" /> TZS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              variant="ghost"
              className={cn("w-full justify-start", themeClasses.mainText, themeClasses.buttonGhostHoverBg)}
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? "Signing out..." : "Logout"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col" suppressHydrationWarning>
        {/* Top bar */}
        <div className={cn("sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b px-4", themeClasses.cardBg, themeClasses.cardBorder)} suppressHydrationWarning>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-8 h-8"
          >
            <Menu className="w-8 h-8" />
          </Button>

          <div className="flex flex-1 items-center gap-x-4 self-stretch lg:gap-x-6" suppressHydrationWarning>
            <div className="flex flex-1" suppressHydrationWarning />
            <div className="flex items-center gap-x-4 lg:gap-x-6" suppressHydrationWarning>
              {/* Theme Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(themeClasses.mainText, themeClasses.buttonGhostHoverBg)}
                  >
                    <Palette className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                  <DropdownMenuItem
                    onClick={() => setBackgroundColor("dark")}
                    className={cn(themeClasses.buttonGhostHoverBg, backgroundColor === "dark" && "bg-yellow-500 text-white")}
                  >
                    Dark {backgroundColor === "dark" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setBackgroundColor("gray")}
                    className={cn(themeClasses.buttonGhostHoverBg, backgroundColor === "gray" && "bg-yellow-500 text-white")}
                  >
                    Gray {backgroundColor === "gray" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setBackgroundColor("white")}
                    className={cn(themeClasses.buttonGhostHoverBg, backgroundColor === "white" && "bg-yellow-500 text-white")}
                  >
                    White {backgroundColor === "white" && "✓"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" suppressHydrationWarning>
          <div className="py-6" suppressHydrationWarning>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
} 