'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { usePublicCompanyContext } from '@/contexts/public-company-context'
import { useCurrency } from '@/contexts/currency-context'
import { cn } from '@/lib/utils'
import { Package, TrendingUp, DollarSign, Shield, Users, CheckCircle, Landmark, Home, ShoppingBag, ChevronLeft, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton, ShimmerSkeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/contexts/language-context'
import { t } from '@/lib/translations'
import { UserProfile } from '@/components/user-profile'

interface PlanFeature {
  name: string
  description: string
}

interface SupplierPlan {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  term: string | null
  max_products: number | null
  commission_rate: number | null
  features: PlanFeature[]
}

export default function BecomeSupplierPage() {
  const { themeClasses, backgroundColor, setBackgroundColor } = useTheme()
  const { companyName, companyLogo, companyColor } = usePublicCompanyContext()
  const { currency, setCurrency, formatPrice: formatCurrencyPrice } = useCurrency()
  const { signUp, signIn, user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const { closeAuthModal, openAuthModal } = useGlobalAuthModal()
  const router = useRouter()
  const { language, setLanguage } = useLanguage()
  const translate = t(language)
  
  // Fallback logo system
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const [plans, setPlans] = useState<SupplierPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTerm, setSelectedTerm] = useState<'month' | 'year'>('month')
  const [isDeclarationOpen, setIsDeclarationOpen] = useState(false)
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SupplierPlan | null>(null)
  const [declarationAgreed, setDeclarationAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationForm, setRegistrationForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptedPrivacyPolicy: false
  })
  const [registrationError, setRegistrationError] = useState('')
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeout) {
        clearTimeout(emailCheckTimeout)
      }
    }
  }, [emailCheckTimeout])

  const benefits = [
    { icon: TrendingUp, title: 'Grow Your Business', description: 'Reach thousands of customers looking for quality products' },
    { icon: DollarSign, title: 'Fair Pricing', description: 'Competitive commission structure that works for you' },
    { icon: Shield, title: 'Trust & Security', description: 'Secure transactions and reliable payment processing' },
    { icon: Users, title: 'Support Team', description: 'Dedicated support to help you succeed' }
  ]

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch('/api/supplier-plans')
        const data = await response.json()
        if (data.success && data.plans) {
          setPlans(data.plans)
        }
      } catch (error) {
        console.error('Error fetching plans:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [])

  // Redirect logged-in suppliers to dashboard
  useEffect(() => {
    if (user && (user.isSupplier || user.profile?.is_supplier)) {
      router.push('/supplier/dashboard')
    }
  }, [user, router])

  const formatPrice = (price: number, dbCurrency: string) => {
    // Always show price with 2 decimal places and comma separators, even if 0
    // Database stores prices in TZS (default currency)
    // Currency context expects prices in TZS and handles conversion to USD if needed
    const numPrice = typeof price === 'number' ? price : parseFloat(String(price || 0))
    if (isNaN(numPrice)) {
      return currency === 'TZS' ? 'TSh 0.00' : '$0.00'
    }
    
    // Format with commas and 2 decimal places
    if (currency === 'TZS') {
      // For TZS, format with commas and 2 decimal places
      return `TSh ${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    } else {
      // For USD, convert TZS to USD (1 USD = 2500 TZS)
      const usdAmount = numPrice / 2500
      return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }

  return (
    <div className={cn("min-h-screen", themeClasses.mainBg)}>
      {/* Enhanced Header with Logo and Navigation */}
      <header className={cn(
        "fixed top-0 z-40 w-full border-b sm:top-0",
        "bg-white/95 dark:bg-black/50 backdrop-blur-sm",
        "border-white dark:border-gray-800",
        "shadow-[0_15px_30px_-5px_rgba(0,0,0,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(255,255,255,0.15)]"
      )}>
        <div className="container mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex items-center h-16 sm:h-20 justify-between">
            {/* Logo and Company Name */}
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 flex-shrink-0 group"
            >
              <div className="relative">
                <Image
                  src={displayLogo}
                  alt={`${companyName} Logo`}
                  width={48}
                  height={48}
                  className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
                />
              </div>
              <div className="hidden sm:flex flex-col">
                <span 
                  className="text-lg sm:text-xl lg:text-2xl font-bold truncate"
                  style={{ color: companyColor || '#f97316' }}
                >
                  {companyName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Become a Supplier
                </span>
              </div>
              <div className="sm:hidden">
                <span className="text-base font-bold" style={{ color: companyColor || '#f97316' }}>
                  Supplier
                </span>
              </div>
            </Link>

            {/* Navigation Links - Desktop */}
            <nav className="hidden md:flex items-center gap-6 flex-1 justify-center">
              <Link
                href="/"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-orange-500",
                  "text-gray-700 dark:text-gray-300"
                )}
              >
                <Home className="w-4 h-4 inline mr-1" />
                Home
              </Link>
              <Link
                href="/products"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-orange-500",
                  "text-gray-700 dark:text-gray-300"
                )}
              >
                <ShoppingBag className="w-4 h-4 inline mr-1" />
                Products
              </Link>
              <Link
                href="/become-supplier"
                className={cn(
                  "text-sm font-semibold transition-colors",
                  "text-orange-500 dark:text-orange-400"
                )}
              >
                <Package className="w-4 h-4 inline mr-1" />
                Become Seller
              </Link>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle Button - Switch between White and Dark (Black) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Toggle between white and dark (black) only
                  const newTheme = (backgroundColor === 'white' || backgroundColor === 'gray') ? 'dark' : 'white'
                  setBackgroundColor(newTheme)
                }}
                className={cn(
                  "flex items-center gap-2",
                  "border-gray-300 dark:border-gray-600",
                  "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
                title={(backgroundColor === 'white' || backgroundColor === 'gray') ? 'Switch to dark theme' : 'Switch to light theme'}
              >
                {(backgroundColor === 'white' || backgroundColor === 'gray') ? (
                  <>
                    <Moon className="w-4 h-4" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                )}
              </Button>

              {/* User Profile or Sign In */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <UserProfile />
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Only open login form (no registration, no Google OAuth redirects)
                      openAuthModal('login', '/supplier/dashboard')
                    }}
                    className={cn(
                      "flex items-center gap-2",
                      "border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10",
                      "dark:border-orange-400 dark:text-orange-400",
                      "text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    )}
                  >
                    Sign In
                  </Button>
                </>
              )}

              {/* Currency Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex items-center gap-2",
                      "border-gray-300 dark:border-gray-600",
                      "hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    {currency === "USD" ? (
                      <DollarSign className="w-4 h-4" />
                    ) : (
                      <Landmark className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{currency}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn(
                  "bg-white text-neutral-900 border border-neutral-200",
                  "dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800"
                )}>
                  <DropdownMenuItem
                    onClick={() => setCurrency("TZS")}
                    className={cn(
                      "cursor-pointer",
                      currency === "TZS" && "bg-yellow-100 dark:bg-yellow-900/20"
                    )}
                  >
                    <Landmark className="w-4 h-4 mr-2" /> TZS
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setCurrency("USD")}
                    className={cn(
                      "cursor-pointer",
                      currency === "USD" && "bg-yellow-100 dark:bg-yellow-900/20"
                    )}
                  >
                    <DollarSign className="w-4 h-4 mr-2" /> USD
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Top Padding for Fixed Header */}
      <main className="pt-24 sm:pt-28 pb-8 md:pb-16 px-4 sm:px-6 md:px-12 lg:px-20 xl:px-24 2xl:px-32">
        {/* Enhanced Hero Section */}
        <div className="text-center mb-8 sm:mb-12 md:mb-16 relative overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 dark:from-orange-950/20 dark:via-yellow-950/20 dark:to-orange-950/20 -z-10 rounded-3xl" />
          
          {/* Decorative Elements */}
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-orange-200/30 dark:bg-orange-800/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-200/30 dark:bg-yellow-800/20 rounded-full blur-3xl -z-10" />
          
          <div className="relative z-10 py-8 sm:py-12 md:py-16 px-2 sm:px-4">
            {/* Icon with Animation */}
            <div className="inline-block p-4 sm:p-5 md:p-6 rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-500 mb-4 sm:mb-6 shadow-lg hover:shadow-xl transition-shadow animate-pulse">
              <Package className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-white" />
            </div>
            
            <h1 className={cn(
              "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-4 sm:mb-6",
              "bg-gradient-to-r from-orange-600 via-yellow-500 to-orange-600 bg-clip-text text-transparent"
            )}>
              Become a Supplier
            </h1>
            
            <p className={cn(
              "text-base sm:text-lg md:text-xl lg:text-2xl max-w-3xl mx-auto mb-6 sm:mb-8 px-2",
              "text-gray-700 dark:text-gray-300",
              "leading-relaxed"
            )}>
              Join our marketplace and grow your business with{' '}
              <span className="font-semibold" style={{ color: companyColor || '#f97316' }}>
                {companyName}
              </span>
              . Start selling to thousands of customers today.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8 px-2">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold w-full sm:w-auto px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg shadow-lg hover:shadow-xl transition-all"
                onClick={() => {
                  const plansSection = document.getElementById('plans-section')
                  plansSection?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                View Plans
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 font-semibold w-full sm:w-auto px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg"
                onClick={() => router.push('/products')}
              >
                Browse Products
              </Button>
            </div>
          </div>
        </div>
        
        {/* Title - Desktop Only */}
        <div className="hidden lg:block mt-8 mb-8">
          <h2 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
            {translate('chooseYourPlan')}
          </h2>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            {translate('selectPerfectPlan')}
          </p>
        </div>

        <div id="plans-section" className="flex lg:flex-row flex-col gap-8 lg:gap-12 scroll-mt-24 w-full">
          {/* Benefits Section - Left Side */}
          <div className="space-y-6 w-full lg:w-[400px] lg:flex-shrink-0">
            <h2 className={cn("text-xl sm:text-2xl font-bold mb-4 sm:mb-6", themeClasses.mainText)}>
              Why Partner With Us?
            </h2>
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <Card key={index} className={cn("border", themeClasses.cardBorder, themeClasses.cardBg)}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex-shrink-0">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={cn("text-base sm:text-lg font-semibold mb-1", themeClasses.mainText)}>
                          {benefit.title}
                        </h3>
                        <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Plans Section - Right Side (One Line) */}
          <div className="flex-1 min-w-0">
            {/* Title - Mobile Only */}
            <div className="lg:hidden text-center mb-6">
              <h2 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
                {translate('chooseYourPlan')}
              </h2>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                {translate('selectPerfectPlan')}
              </p>
            </div>
            {/* Term Toggle and Language Toggle - Positioned above grid to avoid overlap */}
            <div className="flex justify-center items-center gap-2 sm:gap-4 mb-6 sm:mb-8 flex-wrap -mt-4 sm:-mt-8">
                <ToggleGroup 
                  type="single" 
                  value={selectedTerm} 
                  onValueChange={(value) => {
                    if (value) setSelectedTerm(value as 'month' | 'year')
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 p-1 rounded-lg border",
                    themeClasses.cardBorder,
                    themeClasses.cardBg
                  )}
                >
                  <ToggleGroupItem
                    value="month"
                    aria-label="Monthly"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      selectedTerm === 'month'
                        ? "bg-yellow-500 text-neutral-950"
                        : cn(themeClasses.textNeutralSecondary, "hover:bg-gray-100 dark:hover:bg-gray-800")
                    )}
                  >
                    {translate('monthly')}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="year"
                    aria-label="Yearly"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      selectedTerm === 'year'
                        ? "bg-yellow-500 text-neutral-950"
                        : cn(themeClasses.textNeutralSecondary, "hover:bg-gray-100 dark:hover:bg-gray-800")
                    )}
                  >
                    {translate('yearly')}
                  </ToggleGroupItem>
                </ToggleGroup>
                
                <ToggleGroup 
                  type="single" 
                  value={language} 
                  onValueChange={(value) => {
                    if (value) setLanguage(value as 'en' | 'sw')
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 p-1 rounded-lg border",
                    themeClasses.cardBorder,
                    themeClasses.cardBg
                  )}
                >
                  <ToggleGroupItem
                    value="en"
                    aria-label="English"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      language === 'en'
                        ? "bg-yellow-500 text-neutral-950"
                        : cn(themeClasses.textNeutralSecondary, "hover:bg-gray-100 dark:hover:bg-gray-800")
                    )}
                  >
                    English
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="sw"
                    aria-label="Swahili"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      language === 'sw'
                        ? "bg-yellow-500 text-neutral-950"
                        : cn(themeClasses.textNeutralSecondary, "hover:bg-gray-100 dark:hover:bg-gray-800")
                    )}
                  >
                    Kiswahili
                  </ToggleGroupItem>
                </ToggleGroup>
            </div>
            
            <div className={cn("grid gap-4 sm:gap-6 w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
            {loading ? (
              // Skeleton Loaders - Show 3 cards with center card zoomed
              Array.from({ length: 3 }).map((_, index) => {
                const isCenter = index === 1
                return (
                  <Card 
                    key={index} 
                    className={cn(
                      "border-2 relative overflow-hidden",
                      themeClasses.cardBorder,
                      themeClasses.cardBg,
                      isCenter ? "md:scale-105 md:z-10 md:shadow-xl" : ""
                    )}
                  >
                    <CardContent className={cn("p-6 relative h-full flex flex-col", isCenter ? "md:p-7" : "")}>
                      <div className="text-center mb-6">
                        <ShimmerSkeleton className={cn("mx-auto mb-2", isCenter ? "h-10 w-36" : "h-8 w-32")} />
                        <ShimmerSkeleton className={cn("mx-auto mb-2", isCenter ? "h-14 w-28" : "h-12 w-24")} />
                        <ShimmerSkeleton className={cn("mx-auto", isCenter ? "h-5 w-44" : "h-4 w-40")} />
                      </div>
                      <ul className="space-y-3 mb-6 flex-grow">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <ShimmerSkeleton className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5" />
                            <ShimmerSkeleton className="h-4 flex-1" />
                          </li>
                        ))}
                      </ul>
                      <ShimmerSkeleton className={cn("rounded-full", isCenter ? "h-12 w-36 mx-auto" : "h-10 w-32")} />
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              plans.map((plan, index) => {
                const isPremium = plan.slug === 'premium'
                const isWinga = plan.slug === 'winga'
                const isFree = plan.slug === 'free' || plan.slug === '0' || plan.price === 0
                const isCenter = index === 1
                const iconColor = isPremium ? 'text-yellow-500' : isWinga ? 'text-purple-500' : 'text-green-500'
                
                return (
                  <Card 
                    key={plan.id} 
                    className={cn(
                      "border-2 cursor-pointer transition-all duration-300 ease-in-out",
                      cn(themeClasses.cardBorder, "hover:border-yellow-500"),
                      themeClasses.cardBg,
                      "relative overflow-hidden",
                      "flex-1 min-w-0",
                      // Center card: smaller zoom with small hover effect
                      isCenter ? "md:scale-105 md:z-10 md:shadow-xl" : "",
                      // Non-center cards: independent hover scale effect
                      !isCenter ? "hover:scale-105 hover:shadow-xl hover:z-20" : ""
                    )}
                    style={isCenter ? { transform: 'scale(1.05)', transition: 'transform 0.3s ease-in-out' } : undefined}
                    onMouseEnter={(e) => {
                      if (isCenter) {
                        e.currentTarget.style.transform = 'scale(1.07)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isCenter) {
                        e.currentTarget.style.transform = 'scale(1.05)'
                      }
                    }}
                    onClick={() => {
                      setSelectedPlan(plan)
                      setIsDeclarationOpen(true)
                    }}
                  >
                    {isPremium && (
                      <div className="absolute top-0 right-0 bg-yellow-500 text-neutral-950 px-3 py-1 text-xs font-bold rounded-bl-lg z-10">
                        POPULAR
                      </div>
                    )}
                    {isWinga && (
                      <div className="absolute top-0 right-0 bg-purple-500 text-white px-3 py-1 text-xs font-bold rounded-bl-lg z-10">
                        WINGA
                      </div>
                    )}
                    {isFree && !isPremium && !isWinga && (
                      <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-bold rounded-bl-lg z-10">
                        Free Plan
                      </div>
                    )}
                    <CardContent className={cn("p-3 sm:p-4 md:p-5 relative h-full flex flex-col", (isPremium || isWinga || isFree) && "pt-8 sm:pt-10", isCenter && "md:p-5")}>
                      <div className="text-center mb-3 sm:mb-4">
                        <h3 className={cn("text-lg sm:text-xl font-bold mb-1", themeClasses.mainText)}>
                          {plan.name}
                        </h3>
                        <div className="mb-2">
                          <span className={cn("text-2xl sm:text-3xl md:text-4xl font-bold", themeClasses.mainText)}>
                            {formatPrice(
                              selectedTerm === 'year' ? plan.price * 12 : plan.price, 
                              plan.currency
                            )}
                          </span>
                          <span className={cn("text-sm sm:text-base md:text-lg ml-2", themeClasses.textNeutralSecondary)}>
                            / {selectedTerm}
                          </span>
                        </div>
                        {plan.description && (
                          <>
                            <p className={cn("text-xs sm:text-sm mb-2 sm:mb-3", themeClasses.textNeutralSecondary)}>
                              {isWinga 
                                ? "Perfect for brokers, connectors, and hustlers. No shop or stock needed - just your connections and market knowledge!"
                                : plan.description
                              }
                            </p>
                            {/* Badges */}
                            <div className="flex justify-center mb-3 sm:mb-4 flex-wrap gap-1">
                              {isPremium ? (
                                <>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-r border-yellow-200 dark:border-yellow-800">
                                    Best Value
                                  </span>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-r border-blue-200 dark:border-blue-800">
                                    Medium & Large Business
                                  </span>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                    Recommended
                                  </span>
                                </>
                              ) : isWinga ? (
                                <>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-r border-purple-200 dark:border-purple-800">
                                    Broker/Connector
                                  </span>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-r border-green-200 dark:border-green-800">
                                    Post Your Products
                                  </span>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                    No Capital Needed
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                                    Starter Plan
                                  </span>
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                    Perfect for Small Business
                                  </span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {/* Features Title with Decorative Lines */}
                      <div className="flex items-center justify-center mb-3">
                        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                        <h4 className={cn("px-4 text-xs font-semibold uppercase tracking-wide", themeClasses.mainText)}>
                          {translate('features')}
                        </h4>
                        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                      <ul className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 flex-grow">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-2">
                            <CheckCircle className={cn("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5", iconColor)} />
                            <span className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                              {feature.name}
                            </span>
                          </li>
                        ))}
                        {plan.commission_rate !== null && !isWinga && (
                          <li className="flex items-start gap-2">
                            <CheckCircle className={cn("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5", iconColor)} />
                            <span className={cn("text-xs sm:text-sm font-semibold", themeClasses.mainText)}>
                              {translate('commissionRate')}: <span className="font-bold text-yellow-600 dark:text-yellow-500">{plan.commission_rate}%</span>
                            </span>
                          </li>
                        )}
                      </ul>
                      <Button 
                        className={cn(
                          "w-full sm:w-auto self-start rounded-full px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium transition-colors",
                          isPremium 
                            ? "bg-yellow-500 hover:bg-yellow-600 text-neutral-950 border border-yellow-600"
                            : isWinga
                            ? "bg-purple-500 hover:bg-purple-600 text-white border border-purple-600"
                            : "bg-neutral-950 dark:bg-black text-white hover:bg-neutral-800 border border-gray-300 dark:border-gray-600"
                        )}
                        onClick={(e) => {
                          e.stopPropagation() // Prevent card click when button is clicked
                          setSelectedPlan(plan)
                          setIsDeclarationOpen(true)
                        }}
                      >
                        {isPremium ? translate('choosePremium') : isWinga ? 'Choose Winga Plan' : translate('getStarted')}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })
            )}
            </div>
          </div>
        </div>
      </main>

      {/* Declaration Modal */}
      <Dialog open={isDeclarationOpen} onOpenChange={(open) => {
        setIsDeclarationOpen(open)
        if (!open) {
          setDeclarationAgreed(false)
        }
      }}>
        <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900", themeClasses.cardBorder)}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className={cn("text-2xl font-bold", themeClasses.mainText)}>
                  {translate('supplierDeclarationTerms')}
                </DialogTitle>
                <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
                  {selectedPlan && (
                    <span>
                      {translate('readAgreeTerms')} <strong>{selectedPlan.name}</strong> {translate('plan')}
                    </span>
                  )}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn("flex items-center gap-1 ml-4", themeClasses.mainText, themeClasses.borderNeutralSecondary)}
                onClick={() => setLanguage(language === "en" ? "sw" : "en")}
              >
                {language === "en" ? "Kiswahili" : "English"}
              </Button>
            </div>
          </DialogHeader>

          <div className={cn("space-y-4 mt-4", themeClasses.textNeutralSecondary)}>
            {selectedPlan?.slug === 'winga' ? (
              <>
                {/* Winga-Specific Declaration */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-4">
                  <h3 className={cn("text-lg font-semibold mb-2 text-purple-900 dark:text-purple-200", themeClasses.mainText)}>
                    What is a Winga?
                  </h3>
                  <p className={cn("text-sm mb-3", themeClasses.textNeutralSecondary)}>
                    A <strong>Winga</strong> is an informal trader who acts as a broker or connector, helping customers find products they want easy noe by posting to honic online store.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>1. Winga Business Model & Responsibilities</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>You act as a broker/connector - helping customers find products they want</li>
                    <li>You do NOT need to own a shop or keep physical stock</li>
                    <li>You work with minimal or no starting capital</li>
                    <li>You must provide accurate product information to customers</li>
                    <li>You must respond to customer inquiries promptly</li>
                    <li>You must comply with all applicable laws and regulations</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>2. Commission & Payment Terms</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li className={cn("font-semibold", themeClasses.mainText)}>
                      Commission fee 5%
                    </li>
                    <li>Commissions are processed after customer payment is confirmed</li>
                    <li>Payments are made to your registered account</li>
                    <li>All transactions are subject to platform fees</li>
                    <li>Refunds and returns are handled according to <Link href="/terms#shipping-returns" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">platform policies</Link></li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>3. Product Listing & Business Limits</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>You can list up to <strong>10 products</strong> at a time</li>
                    <li>Products must be accurately described with correct information</li>
                    <li>Prohibited items are strictly forbidden</li>
                    <li>Pricing must be competitive and fair</li>
                    <li>You can connect customers to products from other suppliers</li>
                    <li>You must clearly indicate when you're acting as a broker/middleman</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>4. Winga Code of Conduct - Be a Good Winga!</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li className="text-green-600 dark:text-green-400 font-semibold">✓ Be HONEST with customers about products and prices</li>
                    <li className="text-green-600 dark:text-green-400 font-semibold">✓ Help customers find GOOD DEALS and avoid scams</li>
                    <li className="text-green-600 dark:text-green-400 font-semibold">✓ Use your market knowledge to benefit customers</li>
                    <li className="text-red-600 dark:text-red-400 font-semibold">✗ DO NOT overcharge customers</li>
                    <li className="text-red-600 dark:text-red-400 font-semibold">✗ DO NOT lie about product quality</li>
                    <li className="text-red-600 dark:text-red-400 font-semibold">✗ DO NOT scam customers - this will result in immediate account termination</li>
                    <li>Build trust through honest business practices</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>5. Account Management & Compliance</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>You must maintain account security and protect your login credentials</li>
                    <li>Your account may be suspended or terminated for violations of these terms</li>
                    <li>You can upgrade to Premium or to Free plan anytime (requires business/company/TIN business registration number)</li>
                    <li>You can delete your account at any time</li>
                    <li>You must provide NIDA Number, 2 photos of NIDA card front and rear (important for trust and verification)</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>6. Platform Rights</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>The platform reserves the right to review and approve all products</li>
                    <li>The platform may modify these terms with notice</li>
                    <li>The platform may suspend or terminate accounts that violate terms</li>
                    <li>The platform may update features and functionality</li>
                    <li>Bad wingas (scammers, dishonest traders) will be permanently banned</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                {/* Standard Supplier Declaration */}
                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>1. {translate('supplierResponsibilities')}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>{translate('provideAccurateInfo')}</li>
                    <li>{translate('maintainInventory')}</li>
                    <li>{translate('processOrdersPromptly')}</li>
                    <li>{translate('respondToCustomers')}</li>
                    <li>{translate('complyWithLaws')}</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>2. {translate('commissionPayment')}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    {selectedPlan && selectedPlan.commission_rate !== null && (
                      <li className={cn("font-semibold", themeClasses.mainText)}>
                        {translate('commissionRateValue')} <span className="font-bold text-yellow-600 dark:text-yellow-500">{selectedPlan.commission_rate}%</span> {translate('commissionRatePerProduct')}
                      </li>
                    )}
                    <li>{translate('commissionRatesSpecified')}</li>
                    <li>{translate('paymentsProcessed')}</li>
                    <li>{translate('transactionsSubjectFees')}</li>
                    <li>{translate('refundsReturnsHandled')}</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>3. {translate('productListingGuidelines')}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>{translate('productsAccuratelyDescribed')}</li>
                    <li>{translate('prohibitedItemsForbidden')}</li>
                    <li>{translate('pricingCompetitive')}</li>
                    <li>{translate('productLimitsApply')}</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>4. {translate('accountManagement')}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>{translate('maintainAccountSecurity')}</li>
                    <li>{translate('accountSuspension')}</li>
                    <li>{translate('planUpgradesDowngrades')}</li>
                    <li>{translate('deleteAccountAnytime')}</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>5. {translate('platformRights')}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>{translate('reviewApproveProducts')}</li>
                    <li>{translate('modifyTermsNotice')}</li>
                    <li>{translate('suspendTerminateAccounts')}</li>
                    <li>{translate('updatePlatformFeatures')}</li>
                  </ul>
                </div>
              </>
            )}

            <div className="flex items-start space-x-3 pt-4 border-t">
              <Checkbox
                id="declaration-agreement"
                checked={declarationAgreed}
                onCheckedChange={(checked) => setDeclarationAgreed(checked === true)}
                className="mt-1"
              />
              <Label
                htmlFor="declaration-agreement"
                className={cn("text-sm leading-relaxed cursor-pointer", themeClasses.mainText)}
              >
                {translate('agreeToTerms')} {companyName}.
              </Label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeclarationOpen(false)
                setDeclarationAgreed(false)
              }}
              className="flex-1"
            >
              {translate('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (declarationAgreed) {
                  setIsDeclarationOpen(false)
                  setIsRegistrationOpen(true)
                  setDeclarationAgreed(false)
                } else {
                  toast({
                    title: translate('agreementRequired'),
                    description: translate('pleaseAgreeToTerms'),
                    variant: 'destructive'
                  })
                }
              }}
              disabled={!declarationAgreed}
              className={cn("flex-1 bg-yellow-500 hover:bg-yellow-600 text-neutral-950", !declarationAgreed && "opacity-50 cursor-not-allowed")}
            >
              {translate('iAgreeContinue')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registration Modal */}
      <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
        <DialogContent className={cn(
          "max-w-md bg-white dark:bg-neutral-900",
          themeClasses.cardBorder,
          "max-h-[calc(100vh-2rem)] sm:max-h-[85vh]",
          "overflow-y-auto",
          "top-[1rem] sm:top-[50%]",
          "translate-y-0 sm:translate-y-[-50%]",
          "left-[50%] translate-x-[-50%]",
          "w-[calc(100vw-2rem)] sm:w-full"
        )}>
          <DialogHeader className="flex-shrink-0 pb-2 mb-2">
            <DialogTitle className={cn("text-xl sm:text-2xl font-bold", themeClasses.mainText)}>
              Create Your Account
            </DialogTitle>
            <DialogDescription className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              {selectedPlan && (
                <span>
                  Sign up for <strong>{selectedPlan.name}</strong> plan
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <form 
            onSubmit={async (e) => {
              e.preventDefault()
              setIsSubmitting(true)
              setRegistrationError('')

              if (!registrationForm.fullName || !registrationForm.email || !registrationForm.phone || !registrationForm.password || !registrationForm.confirmPassword) {
                setRegistrationError('Please fill in all required fields')
                setIsSubmitting(false)
                return
              }

              if (!registrationForm.acceptedPrivacyPolicy) {
                setRegistrationError('You must accept the Privacy Policy to create an account')
                setIsSubmitting(false)
                return
              }

              if (registrationForm.password !== registrationForm.confirmPassword) {
                setRegistrationError('Passwords do not match')
                setIsSubmitting(false)
                return
              }

              if (registrationForm.password.length < 8) {
                setRegistrationError('Password must be at least 8 characters')
                setIsSubmitting(false)
                return
              }

              // Check if email exists before submitting
              if (emailExists) {
                setRegistrationError('An account with this email address already exists. Please use a different email or try logging in.')
                setIsSubmitting(false)
                return
              }

              // Final email check before submission using Supabase auth
              try {
                const emailCheckResponse = await fetch(`/api/auth/check-email?email=${encodeURIComponent(registrationForm.email.toLowerCase().trim())}`)
                const emailCheckData = await emailCheckResponse.json()
                
                if (emailCheckData.exists) {
                  setEmailExists(true)
                  setRegistrationError('An account with this email address already exists. Please use a different email or try logging in.')
                  setIsSubmitting(false)
                  return
                }
              } catch (error) {
                console.error('Error checking email before submission:', error)
                // Continue with submission if check fails (server will validate)
              }

              try {
                const result = await signUp(
                  registrationForm.fullName,
                  registrationForm.email,
                  registrationForm.password,
                  registrationForm.confirmPassword,
                  registrationForm.phone,
                  true, // Set isSupplier to true for registrations from become-seller page
                  true, // Skip opening login modal since we're doing auto-login
                  selectedPlan?.id as string | undefined // Pass planId to assign during registration
                )

                if (result.success) {
                  // Close registration form immediately
                  setIsRegistrationOpen(false)
                  setRegistrationForm({
                    fullName: '',
                    email: '',
                    phone: '',
                    password: '',
                    confirmPassword: '',
                    acceptedPrivacyPolicy: false
                  })
                  
                  // Check if user was auto-logged in (email verified)
                  const autoLoggedIn = (result as any).autoLoggedIn
                  const isVerified = (result as any).isVerified
                  
                  if (autoLoggedIn && isVerified) {
                    // User is verified and logged in - redirect to company info
                    toast({
                      title: 'Account Created',
                      description: 'Welcome! Redirecting to complete your profile...',
                      duration: 3000,
                    })
                    router.push('/supplier/company-info')
                  } else {
                    // User needs to verify email - show message and auto-open login form
                    toast({
                      title: 'Account Created',
                      description: 'Please verify your email to continue. Check your inbox for the verification link.',
                      duration: 5000,
                    })
                    
                    // Close registration form
                    setIsRegistrationOpen(false)
                    setRegistrationForm({
                      fullName: '',
                      email: '',
                      phone: '',
                      password: '',
                      confirmPassword: '',
                      acceptedPrivacyPolicy: false
                    })
                    
                    // Store email for verification message and pre-fill in login form
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('pending_verification_email', registrationForm.email)
                      sessionStorage.setItem('supplier_registration', 'true')
                    }
                    
                    // Auto-open login form after a short delay (email will be auto-filled from sessionStorage)
                    setTimeout(() => {
                      openAuthModal('login', '/supplier/dashboard')
                    }, 500)
                  }
                } else {
                  setRegistrationError(result.error || 'Registration failed. Please try again.')
                  // Clear sessionStorage on error
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('selected_plan_id')
                    sessionStorage.removeItem('selected_plan_slug')
                  }
                }
              } catch (error) {
                setRegistrationError('An error occurred. Please try again.')
              } finally {
                setIsSubmitting(false)
              }
            }}
            className="space-y-4 pb-4"
            autoComplete="on"
          >
            <div>
              <Label htmlFor="fullName" className={cn(themeClasses.mainText)}>
                Full Name *
              </Label>
              <Input
                id="fullName"
                name="name"
                type="text"
                value={registrationForm.fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegistrationForm(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Enter your full name"
                className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                autoComplete="name"
                required
              />
            </div>

            <div>
              <Label htmlFor="email" className={cn(themeClasses.mainText)}>
                Email *
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={registrationForm.email}
                onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const email = e.target.value
                  setRegistrationForm(prev => ({ ...prev, email }))
                  setEmailExists(false)
                  setRegistrationError('')
                  
                  // Clear previous timeout
                  if (emailCheckTimeout) {
                    clearTimeout(emailCheckTimeout)
                  }
                  
                  // Validate email format first
                  if (!email || !/\S+@\S+\.\S+/.test(email)) {
                    return
                  }
                  
                  // Debounce email check (wait 500ms after user stops typing)
                  const timeout = setTimeout(async () => {
                    setCheckingEmail(true)
                    try {
                      const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email.toLowerCase().trim())}`)
                      const data = await response.json()
                      
                      if (data.exists) {
                        setEmailExists(true)
                        setRegistrationError('An account with this email address already exists. Please use a different email or try logging in.')
                      } else {
                        setEmailExists(false)
                      }
                    } catch (error) {
                      console.error('Error checking email:', error)
                      // Don't block user if check fails
                    } finally {
                      setCheckingEmail(false)
                    }
                  }, 500)
                  
                  setEmailCheckTimeout(timeout)
                }}
                placeholder="Enter your email"
                className={cn(
                  "mt-1", 
                  themeClasses.cardBg, 
                  themeClasses.borderNeutralSecondary,
                  emailExists && "border-red-500 focus:border-red-500 focus:ring-red-500"
                )}
                autoComplete="email"
                required
              />
              {checkingEmail && (
                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                  Checking email availability...
                </p>
              )}
              {emailExists && (
                <p className="text-xs mt-1 text-red-500">
                  An account with this email already exists. Please use a different email or try logging in.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone" className={cn(themeClasses.mainText)}>
                Phone *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={registrationForm.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegistrationForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter your phone number"
                className={cn("mt-1", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className={cn(themeClasses.mainText)}>
                Password *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={registrationForm.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegistrationForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                  className={cn("pr-10", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  autoComplete="new-password"
                  data-1p-ignore
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className={cn("w-4 h-4", themeClasses.textNeutralSecondary)} />
                  ) : (
                    <Eye className={cn("w-4 h-4", themeClasses.textNeutralSecondary)} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className={cn(themeClasses.mainText)}>
                Confirm Password *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={registrationForm.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegistrationForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                  className={cn("pr-10", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
                  autoComplete="new-password"
                  data-1p-ignore
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showConfirmPassword ? (
                    <EyeOff className={cn("w-4 h-4", themeClasses.textNeutralSecondary)} />
                  ) : (
                    <Eye className={cn("w-4 h-4", themeClasses.textNeutralSecondary)} />
                  )}
                </button>
              </div>
            </div>

            {registrationError && (
              <div className={cn("p-3 rounded-md bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm")}>
                {registrationError}
              </div>
            )}

            <div className="flex items-start space-x-2 pt-2">
              <Checkbox
                id="privacyPolicy"
                checked={registrationForm.acceptedPrivacyPolicy}
                onCheckedChange={(checked) => 
                  setRegistrationForm(prev => ({ ...prev, acceptedPrivacyPolicy: checked === true }))
                }
                className={cn("mt-1", themeClasses.borderNeutralSecondary)}
              />
              <Label
                htmlFor="privacyPolicy"
                className={cn("text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer", themeClasses.mainText)}
              >
                I agree to the{' '}
                <Link
                  href={`/privacy?return=${encodeURIComponent('/become-supplier')}`}
                  className="text-yellow-500 hover:text-yellow-600 underline"
                >
                  Privacy Policy
                </Link>
                {' '}*
              </Label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                    setIsRegistrationOpen(false)
                    setRegistrationForm({
                      fullName: '',
                      email: '',
                      phone: '',
                      password: '',
                      confirmPassword: '',
                      acceptedPrivacyPolicy: false
                    })
                    setRegistrationError('')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-neutral-950"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </Button>
            </div>

            <div className="text-center pt-2">
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Already have an account?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="text-yellow-500 hover:text-yellow-600 p-0 h-auto text-sm font-medium"
                  onClick={() => {
                    setIsRegistrationOpen(false)
                    // Store redirect for Google OAuth and flag for supplier registration
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('oauth_redirect', '/supplier/dashboard')
                      sessionStorage.setItem('supplier_registration', 'true')
                    }
                    openAuthModal('login', '/supplier/dashboard')
                  }}
                >
                  Sign in here
                </Button>
              </p>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Already Have Account Section - Bottom of Content */}
      <div className={cn("border-t py-8 sm:py-12", themeClasses.cardBorder)}>
        <div className="container mx-auto px-4 sm:px-6 md:px-12 lg:px-20 xl:px-24 2xl:px-32">
          <div className="text-center">
            <p className={cn("text-sm sm:text-base mb-4", themeClasses.textNeutralSecondary)}>
              Already have an account?
            </p>
            <Button
              variant="outline"
              onClick={() => {
                // Store redirect for Google OAuth and flag for supplier registration
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('oauth_redirect', '/supplier/dashboard')
                  sessionStorage.setItem('supplier_registration', 'true')
                }
                openAuthModal('login', '/supplier/dashboard')
              }}
              className={cn(
                "border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10",
                "dark:border-orange-400 dark:text-orange-400",
                "px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base font-semibold"
              )}
            >
              Supplier Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

