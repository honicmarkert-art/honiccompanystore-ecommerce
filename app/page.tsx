"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ServiceCardWithRotation } from '@/components/service-card-with-rotation'
import { OptimizedLink } from '@/components/optimized-link'
import { PromotionalCartPopup } from '@/components/promotional-cart-popup'
import { logger } from '@/lib/logger'
import { 
  Search, 
  Camera, 
  Globe, 
  ShoppingCart, 
  User, 
  Menu,
  Play,
  Shield,
  FileText,
  Layers,
  Expand,
  HelpCircle,
  Flag,
  Truck,
  Eye,
  Zap,
  Cpu,
  CircuitBoard,
  Bot,
  Lightbulb,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Download,
  ArrowRight,
  CheckCircle,
  Building2
} from 'lucide-react'
import Image from 'next/image';
import { useRouter } from 'next/navigation'
import { useCompanyContext } from '@/components/company-provider'
import { UserProfile } from '@/components/user-profile'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { useCart } from '@/hooks/use-cart'

// Helper function to detect if a file is a video
const isVideoFile = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

export default function LandingPage() {
  const router = useRouter()
  const { 
    companyName, 
    companyColor, 
    companyLogo, 
    mainHeadline, 
    heroBackgroundImage,
    heroTaglineAlignment,
    serviceRetailImages,
    servicePrototypingImages,
    servicePcbImages,
    serviceAiImages,
    serviceStemImages,
    serviceHomeImages,
    serviceImageRotationTime,
    settings: adminSettings
  } = useCompanyContext()
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { cartTotalItems } = useCart()
  const [searchTerm, setSearchTerm] = useState('')
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [email, setEmail] = useState('')
  const [ads, setAds] = useState<any[]>([])
  const [adRotation, setAdRotation] = useState<number>(5000)
  const [isPromotionalCartOpen, setIsPromotionalCartOpen] = useState(false)
  const [promotionalProducts, setPromotionalProducts] = useState<any[]>([])

  // Debug logging for service images and hero background
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.log('🏠 Landing Page - Service Images:', {
        serviceRetailImages,
        servicePrototypingImages,
        servicePcbImages,
        serviceAiImages,
        serviceStemImages
      })
    }
  }, [serviceRetailImages, servicePrototypingImages, servicePcbImages, serviceAiImages, serviceStemImages])


  // Fetch admin-controlled advertisements (same API as product list)
  useEffect(() => {
    let cancelled = false
    const loadAds = async () => {
      try {
        const cacheBust = typeof window !== 'undefined' ? (localStorage.getItem('settings_cache_bust') || Date.now()) : Date.now()
        
        const [adsRes, rotRes] = await Promise.all([
          fetch(`/api/advertisements?placement=home&cb=${cacheBust}`, { cache: 'no-store' }),
          fetch(`/api/advertisements/rotation-time?cb=${cacheBust}`, { cache: 'no-store' })
        ])
        
        if (!cancelled) {
          if (adsRes.ok) {
            const adsData = await adsRes.json()
            setAds(adsData)
          } else {
            console.warn('⚠️ [Advertisements] Failed to fetch home ads:', adsRes.status)
          }
          
          if (rotRes.ok) {
            const rotationData = await rotRes.json()
            setAdRotation(rotationData)
          } else {
            console.warn('⚠️ [Advertisements] Failed to fetch rotation time:', rotRes.status)
          }
        }
      } catch (error) {
        console.error('❌ [Advertisements] Error fetching home ads:', error)
      }
    }
    loadAds()
    return () => { cancelled = true }
  }, [])

  // Fetch promotional products and show popup after 5 seconds
  useEffect(() => {
    const fetchPromotionalProducts = async () => {
      try {
        // Fetch more products to find ones with real images
        const response = await fetch('/api/products?limit=20')
        if (response.ok) {
          const data = await response.json()
          
          // Filter products with real images (not placeholder)
          const productsWithRealImages = (data.products || []).filter((product: any) => 
            product.image && !product.image.includes('placeholder')
          )
          
          // Take first 3 products with real images
          const selectedProducts = productsWithRealImages.slice(0, 3)
          
          setPromotionalProducts(selectedProducts)
        }
      } catch (error) {
        console.error('Error fetching promotional products:', error)
      }
    }

    fetchPromotionalProducts()

    // Show popup after 5 seconds
    const timer = setTimeout(() => {
      setIsPromotionalCartOpen(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  // Rotate promotional products every 10 seconds
  useEffect(() => {
    if (!isPromotionalCartOpen) return

    const interval = setInterval(async () => {
      try {
        // Get random offset to fetch different products each time
        const randomOffset = Math.floor(Math.random() * 50) // Random offset 0-49
        const response = await fetch(`/api/products?limit=20&offset=${randomOffset}`)
        if (response.ok) {
          const data = await response.json()
          
          // Filter products with real images (not placeholder)
          const productsWithRealImages = (data.products || []).filter((product: any) => 
            product.image && !product.image.includes('placeholder')
          )
          
          // Take first 3 products with real images
          const selectedProducts = productsWithRealImages.slice(0, 3)
          
          setPromotionalProducts(selectedProducts)
        }
      } catch (error) {
        console.error('Error rotating promotional products:', error)
      }
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [isPromotionalCartOpen])

  const handleSearch = () => {
    if (searchTerm.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchTerm.trim())}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle newsletter subscription
    logger.log('Newsletter subscription:', email)
    setEmail('')
  }


  const frequentlySearched = [
    'DHT11 sensor',
    'Arduino Uno',
    'ESP32 module',
    'sensor'
  ]

  const features = [
    {
      icon: <Layers className="w-8 h-8" />,
      title: 'All Categories',
      description: 'Browse through thousands of products'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Order Protection',
      description: 'Secure transactions and buyer protection'
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: 'Trade Assurance',
      description: 'Quality guaranteed with trade assurance'
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: 'Become Supplier',
      description: 'Open your store and sell with us'
    },
    {
      icon: <Truck className="w-8 h-8" />,
      title: 'Logistics Solutions',
      description: 'Global shipping and logistics services'
    }
  ]

  const services = [
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      title: "Retail & Online Sales",
      description: "Buy electronics and components online",
      images: serviceRetailImages && serviceRetailImages.length > 0 ? serviceRetailImages : [],
      color: "blue",
      onClick: () => router.push('/products')
    },
    {
      icon: <Cpu className="w-8 h-8" />,
      title: "Project Prototyping",
      description: "Custom prototyping for your ideas",
      images: servicePrototypingImages && servicePrototypingImages.length > 0 ? servicePrototypingImages : [],
      color: "green",
      onClick: () => router.push('/services/prototyping')
    },
    {
      icon: <CircuitBoard className="w-8 h-8" />,
      title: "PCB Printing",
      description: "Professional PCB design and printing",
      images: servicePcbImages && servicePcbImages.length > 0 ? servicePcbImages : [],
      color: "purple",
      onClick: () => router.push('/services/pcb')
    },
    {
      icon: <Bot className="w-8 h-8" />,
      title: "AI Consultancy",
      description: "AI-powered project guidance and support",
      images: serviceAiImages && serviceAiImages.length > 0 ? serviceAiImages : [],
      color: "orange",
      onClick: () => router.push('/services/ai')
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "STEM Training Kits",
      description: "Educational kits for learning and teaching",
      images: serviceStemImages && serviceStemImages.length > 0 ? serviceStemImages : [],
      color: "red",
      onClick: () => router.push('/services/stem-kits')
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: "Home Devices",
      description: "Smart home and automation solutions",
      images: serviceHomeImages && serviceHomeImages.length > 0 ? serviceHomeImages : [],
      color: "teal",
      onClick: () => router.push('/products?category=home-innovations')
    }
  ]

  const footerLinks = {
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Our Story', href: '/story' },
      { name: 'Careers', href: '/careers' },
      { name: 'Press & Media', href: '/press' },
      { name: 'Contact Us', href: '/contact' }
    ],
    services: [
      { name: 'Electronics Supply', href: '/services/electronics' },
      { name: 'Prototyping Services', href: '/services/prototyping' },
      { name: 'PCB Printing', href: '/services/pcb' },
      { name: 'AI Consultancy', href: '/services/ai' },
      { name: 'Logistics Solutions', href: '/services/logistics' }
    ],
    support: [
      { name: 'Help Center', href: '/help' },
      { name: 'Order Tracking', href: '/tracking' },
      { name: 'Returns & Refunds', href: '/returns' },
      { name: 'Shipping Info', href: '/shipping' },
      { name: 'Technical Support', href: '/support' }
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'GDPR Compliance', href: '/gdpr' },
      { name: 'Data Protection', href: '/data-protection' }
    ]
  }

  const socialLinks = [
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, href: '/social/facebook' },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, href: '/social/twitter' },
    { name: 'Instagram', icon: <Instagram className="w-5 h-5" />, href: '/social/instagram' },
    { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, href: '/social/linkedin' },
    { name: 'YouTube', icon: <Youtube className="w-5 h-5" />, href: '/social/youtube' }
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white" suppressHydrationWarning>
      {/* Welcome Message Bar */}
      <div className="fixed top-0 z-50 w-full bg-stone-100/90 dark:bg-gray-900/95 backdrop-blur-sm border-b border-stone-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-6 px-4">
          {user ? (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Hi! {(user as any).user_metadata?.full_name || user.email?.split('@')[0] || 'User'} - Welcome again <span className="text-blue-600 dark:text-blue-400">{companyName}</span>
            </div>
          ) : (
            <button 
              onClick={() => openAuthModal('login')}
              className="text-xs text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors font-medium"
            >
              Welcome to {companyName} <span className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">login here</span> for better search
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm fixed top-6 left-0 right-0 z-40">
        <div className="bg-gradient-to-b from-black/70 via-black/50 to-black/30">
        <div className="px-4 py-2">
          {/* Mobile Navigation */}
          <div className="block sm:hidden">
            {/* Mobile Header Row */}
            <div className="flex items-center justify-between mb-3">
              {/* Mobile Logo and Company Name */}
              <div className="flex items-center cursor-pointer" onClick={() => router.push('/')}>
                <Image 
                  src={companyLogo} 
                  alt={`${companyName} Logo`} 
                  width={32} 
                  height={32} 
                  className="w-8 h-8 rounded-md"
                />
                <div className="ml-2">
                  <span className="text-sm font-bold text-white truncate max-w-[120px]" style={{ color: companyColor }}>
                  {companyName || 'Honic Co.'}
                  </span>
                </div>
              </div>

              {/* Mobile Right Actions */}
              <div className="flex items-center space-x-3">
                {/* Cart */}
                <div className="relative cursor-pointer" onClick={() => router.push('/cart')}>
                  <ShoppingCart className="w-5 h-5 text-white" />
                  {cartTotalItems > 0 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {cartTotalItems > 99 ? '99+' : cartTotalItems}
                    </div>
                  )}
                </div>

                {/* Account */}
                {user ? (
                  <UserProfile />
                ) : (
                  <div className="flex items-center space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white hover:text-orange-400 hover:bg-gray-800/50 px-2 py-0.5 text-xs h-6"
                      onClick={() => openAuthModal('login')}
                    >
                      Sign in
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 text-xs h-6"
                      onClick={() => openAuthModal('register')}
                    >
                      Sign up
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Navigation Menu - Single Row */}
            <div className="flex items-center justify-between text-xs mt-2">
              <div className="flex items-center space-x-1 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/ai-agent')}>
                <Bot className="w-3 h-3" />
                <span className="text-[10px]">AI Sourcing</span>
              </div>
              <div className="flex items-center space-x-1 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/discover')}>
                <Eye className="w-3 h-3" />
                <span className="text-[10px]">Discovery</span>
              </div>
              <div className="flex items-center space-x-1 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/services')}>
                <Layers className="w-3 h-3" />
                <span className="text-[10px]">Our Service</span>
              </div>
              <div className="flex items-center space-x-1 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/become-supplier')}>
                <Building2 className="w-3 h-3" />
                <span className="text-[10px]">Become Supplier</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation - Two Row Layout */}
          <div className="hidden sm:block">
            {/* First Row - Logo, Delivery, Language, Cart, Account */}
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/')}>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Image 
                    src={companyLogo} 
                    alt={`${companyName} Logo`} 
                    width={48} 
                    height={48}
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md"
                  />
                  <div className="hidden sm:flex flex-col">
                    <span 
                      className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                      style={{ color: companyColor }}
                    >
                      {companyName || 'Honic Co.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Navigation Items */}
              <div className="flex items-center gap-2 lg:gap-3">
                {/* Deliver to */}
                <div className="flex items-center space-x-1 text-xs sm:text-sm cursor-pointer hover:text-orange-400 transition-colors">
                <Flag className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Deliver to: TZ</span>
                <span className="sm:hidden">TZ</span>
                <span className="text-gray-400">▼</span>
              </div>

                {/* Language/Currency */}
                <div className="flex items-center space-x-1 text-xs sm:text-sm cursor-pointer hover:text-orange-400 transition-colors">
                <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">English-TZS</span>
                <span className="sm:hidden">EN</span>
                <span className="text-gray-400">▼</span>
              </div>

                {/* Cart */}
              <div className="flex items-center space-x-1 cursor-pointer relative" onClick={() => router.push('/cart')}>
                <div className="relative">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  {cartTotalItems > 0 && (
                    <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-transparent text-orange-500 text-xs font-bold">
                      {cartTotalItems > 99 ? '99+' : cartTotalItems}
                    </div>
                  )}
                </div>
                <span className="text-xs sm:text-sm hidden sm:inline">Cart</span>
              </div>

                {/* Account/Sign in */}
              {user ? (
                <UserProfile />
              ) : (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => openAuthModal('login')}>
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm">Sign in</span>
                    </div>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-xs sm:text-sm px-2 py-1" onClick={() => openAuthModal('register')}>
                      <span>Create account</span>
                    </Button>
                  </div>
              )}
            </div>
          </div>

            {/* Second Row - AI Sourcing, Discovery, Become Supplier */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="flex items-center space-x-1 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/categories')}>
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">All categories</span>
              </div>
                <span className="text-gray-300 text-xs sm:text-sm hidden md:inline cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/featured')}>Featured selections</span>
                <span className="text-gray-300 text-xs sm:text-sm hidden md:inline cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/protection')}>Order protections</span>
              <span 
                  className="text-gray-300 hover:text-orange-400 cursor-pointer flex items-center space-x-1 text-xs sm:text-sm transition-colors"
                onClick={() => router.push('/logistics')}
              >
                <Truck className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Logistics</span>
              </span>
              </div>
              <div className="flex items-center gap-2 lg:gap-3 text-xs sm:text-sm">
                <span className="text-gray-700 dark:text-gray-300 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/ai-agent')}>
                  <span className="flex items-center space-x-1">
                    <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>AI Sourcing</span>
                  </span>
              </span>
              <span 
                  className="text-gray-700 dark:text-gray-300 hover:text-orange-400 cursor-pointer flex items-center space-x-1 transition-colors"
                onClick={() => router.push('/discover')}
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Discovery</span>
                </span>
                <span className="text-gray-700 dark:text-gray-300 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/become-supplier')}>
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Become Supplier</span>
                  </span>
              </span>
                <span className="text-gray-700 dark:text-gray-300 cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/help')}>Help</span>
                <span className="text-gray-700 dark:text-gray-300 hidden md:inline cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/buyer-central')}>Buyer Central</span>
                <span className="text-gray-700 dark:text-gray-300 hidden md:inline cursor-pointer hover:text-orange-400 transition-colors" onClick={() => router.push('/app')}>App & extension</span>
            </div>
            </div>
          </div>
        </div>
        </div>
      </header>

      {/* Add top padding to account for fixed header and welcome bar */}
      <div className="pt-28 sm:pt-32">

      {/* Hero Section */}
      <section className="relative min-h-[360px] sm:min-h-[460px] md:min-h-[560px] flex items-center">
        {/* Background Image or Color */}
        <div 
          className={`absolute inset-0 ${heroBackgroundImage ? 'hero-bg-responsive' : ''}`}
          style={{
            backgroundImage: heroBackgroundImage ? (() => {
              const cacheBust = typeof window !== 'undefined' ? (localStorage.getItem('settings_cache_bust') || Date.now()) : Date.now()
              const finalUrl = `${heroBackgroundImage}${heroBackgroundImage.includes('?') ? '&' : '?' }cb=${cacheBust}`
              return `url(${finalUrl})`
            })() : 'none',
            backgroundColor: heroBackgroundImage ? 'transparent' : undefined,
            backgroundPosition: heroBackgroundImage ? 'center center' : undefined,
            backgroundRepeat: heroBackgroundImage ? 'no-repeat' : undefined
          }}
        >
          {heroBackgroundImage ? (
            <>
              {/* Image background with overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-50"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
            </>
          ) : (
            <>
              {/* Color background fallback */}
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900"></div>
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className={`max-w-4xl w-full ${heroTaglineAlignment === 'center' ? 'text-center mx-auto' : heroTaglineAlignment === 'right' ? 'text-right ml-auto' : 'text-left'}`}>
            {/* Video Link */}
            <div className={`flex items-center space-x-2 mb-4 sm:mb-6 ${heroTaglineAlignment === 'center' ? 'justify-center' : heroTaglineAlignment === 'right' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex items-center space-x-2 text-orange-400 hover:text-orange-300 cursor-pointer">
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">Learn about {companyName || 'Honic Co.'}</span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6 md:mb-8 leading-tight ${heroTaglineAlignment === 'center' ? 'text-center' : heroTaglineAlignment === 'right' ? 'text-right' : 'text-left'}`}>
              {mainHeadline || 'The leading B2B ecommerce platform for global trade'}
            </h1>

            {/* Search Bar */}
            <div className={`w-full max-w-2xl mb-4 sm:mb-6 md:mb-8 ${heroTaglineAlignment === 'center' ? 'mx-auto' : heroTaglineAlignment === 'right' ? 'ml-auto' : ''}`}>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="essentials hoodie"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full h-10 sm:h-12 md:h-14 pl-3 sm:pl-4 md:pl-6 pr-14 sm:pr-16 md:pr-20 text-sm sm:text-base md:text-lg bg-white text-gray-900 rounded-full border-0 focus:ring-2 focus:ring-orange-500"
                />
                <div className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 sm:space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 sm:p-2 hover:bg-gray-100"
                  >
                    <Camera className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-600" />
                  </Button>
                  <Button
                    onClick={handleSearch}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 md:px-6 py-1 sm:py-2 rounded-full text-xs sm:text-sm"
                  >
                    <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">Search</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Frequently Searched */}
            <div className={`w-full max-w-2xl mb-4 sm:mb-6 md:mb-8 ${heroTaglineAlignment === 'center' ? 'mx-auto' : heroTaglineAlignment === 'right' ? 'ml-auto' : ''}`}>
              <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 flex-wrap gap-1 sm:gap-2">
                <span className="text-gray-300 text-xs sm:text-sm whitespace-nowrap">Frequently searched:</span>
                {frequentlySearched.map((term, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer text-xs sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1"
                    onClick={() => {
                      setSearchTerm(term)
                      router.push(`/products?search=${encodeURIComponent(term)}`)
                    }}
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Hero Call-to-Action */}
            <div className="mt-8 sm:mt-12 text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 sm:mb-6">
                Electronics You Need, Just a Click Away!
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-8 max-w-2xl mx-auto">
                Discover our extensive collection of high-quality electronic components, tools, and innovative solutions for all your projects.
              </p>
              <div className="mb-8 sm:mb-12">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => router.push('/products')}
                >
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Shop Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-gray-800 py-3 sm:py-4 md:py-5 lg:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center mb-2 sm:mb-3 md:mb-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">Our Services</h2>
            <p className="text-gray-300 text-sm sm:text-base lg:text-lg max-w-3xl mx-auto px-2">
              Empowering innovation through comprehensive electronics solutions, prototyping services, and AI-driven guidance
            </p>
          </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 px-4 sm:px-6 lg:px-8">
            {services.map((service, index) => (
              <ServiceCardWithRotation 
                key={index} 
                service={service} 
                rotationTime={serviceImageRotationTime}
              />
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center mt-2 sm:mt-3 md:mt-4">
            <Button 
              size="lg" 
              className="bg-orange-500 hover:bg-orange-600 text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 py-2 sm:py-3 w-full sm:w-auto"
              onClick={() => router.push('/products')}
            >
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Explore Our Services
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-900 py-8 sm:py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {/* Admin-controlled Advertisements (like product list) */}
          {ads && ads.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {ads.slice(0,3).map((ad: any, i: number) => (
                <OptimizedLink key={i} href={ad.link || '/products'} className="block">
                  <div className="relative overflow-hidden rounded-lg border border-gray-700 bg-gray-800 group">
                    {ad.image ? (
                      // simple img to avoid heavy next/image CLS on dynamic ads
                      <img src={ad.image} alt={ad.title || 'Advertisement'} className="w-full h-32 object-cover group-hover:scale-[1.02] transition-transform" />
                    ) : (
                      <div className="h-32 flex items-center justify-center text-sm">Advertisement</div>
                    )}
                    <div className="p-3">
                      <h3 className="text-sm font-semibold">{ad.title || 'Promo'}</h3>
                      {ad.subtitle && <p className="text-xs text-gray-300">{ad.subtitle}</p>}
                    </div>
                  </div>
                </OptimizedLink>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gray-800 rounded-lg p-4 sm:p-6 text-center hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => {
                  if (feature.title === 'Logistics Solutions') {
                    router.push('/logistics')
                  } else if (feature.title === 'Become Supplier') {
                    router.push('/become-supplier')
                  }
                }}
              >
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-500 rounded-lg flex items-center justify-center">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-300 text-xs sm:text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Floating Help Buttons */}
      <div className="fixed right-2 sm:right-4 bottom-4 flex flex-col space-y-2">
        <Button
          size="sm"
          className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 hover:bg-orange-600 rounded-full p-0"
        >
          <Expand className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
        <Button
          size="sm"
          className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-700 hover:bg-gray-600 rounded-full p-0"
        >
          <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

      {/* Call to Action */}
      <section className="bg-gray-900 py-6 sm:py-8 md:py-12 lg:py-16">
        <div className="container mx-auto px-3 sm:px-4 text-center">
          

          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
            Ready to start your global trade journey?
          </h2>
          <p className="text-gray-300 mb-4 sm:mb-6 md:mb-8 max-w-2xl mx-auto text-sm sm:text-base px-2">
            Join thousands of buyers and suppliers who trust our platform for secure, 
            efficient B2B transactions with comprehensive trade protection.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Button 
              size="lg" 
              className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"
              onClick={() => router.push('/products')}
            >
              Start Shopping
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="w-full sm:w-auto text-black"
              onClick={() => router.push('/auth/register')}
            >
              Create Account
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-300">
        {/* Main Footer Content */}
        <div className="px-6 py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-1 sm:gap-2 mb-4">
                  <Image 
                  src={companyLogo} 
                  alt={`${companyName} Logo`} 
                  width={48} 
                  height={48}
                  className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md"
                />
                <div className="flex flex-col">
                  <span 
                    className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                    style={{ color: companyColor }}
                  >
                    {companyName || 'Honic Co.'}
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                Empowering innovation through comprehensive electronics solutions, prototyping services, 
                and AI-driven guidance for students, developers, and businesses worldwide.
              </p>
              
              {/* Contact Info */}
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">
                    {adminSettings?.contactEmail || `info@${companyName?.toLowerCase().replace(/\s+/g, '') || 'honicco'}.com`}
                  </span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">
                    {adminSettings?.contactPhone || '+255 123 456 789'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">
                    {adminSettings?.address || 'Dar es Salaam, Tanzania'}
                  </span>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex space-x-2 sm:space-x-4">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Company</h3>
              <ul className="space-y-1 sm:space-y-2">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services Links */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Services</h3>
              <ul className="space-y-1 sm:space-y-2">
                {footerLinks.services.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Support</h3>
              <ul className="space-y-1 sm:space-y-2">
                {footerLinks.support.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="border-t border-gray-800 mt-8 sm:mt-12 pt-6 sm:pt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Stay Updated</h3>
                <p className="text-xs sm:text-sm text-gray-400">
                  Subscribe to our newsletter for the latest updates, exclusive offers, and industry insights.
                </p>
              </div>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-400 text-xs sm:text-sm"
                  required
                />
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-xs sm:text-sm">
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Download App Section */}
          <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Get Our Mobile App</h3>
                <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                  Download our mobile app for a better shopping experience on the go.
                </p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <Button variant="outline" className="border-gray-700 hover:bg-gray-800 text-xs sm:text-sm">
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    App Store
                  </Button>
                  <Button variant="outline" className="border-gray-700 hover:bg-gray-800 text-xs sm:text-sm">
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Google Play
                  </Button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className="text-xs sm:text-sm">Secure Payment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className="text-xs sm:text-sm">24/7 Support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className="text-xs sm:text-sm">Free Shipping</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800">
          <div className="px-6 py-4 sm:py-6">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-3 sm:space-y-4 md:space-y-0">
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm">
                <span>&copy; 2024 {companyName || 'Honic Co.'}. All rights reserved.</span>
                <div className="flex flex-wrap justify-center sm:justify-start space-x-2 sm:space-x-4">
                  {footerLinks.legal.map((link, index) => (
                    <a key={index} href={link.href} className="hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm">
                <span>Made with ❤️ in Tanzania</span>
                <div className="flex items-center space-x-2">
                  <Flag className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>TZ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      </div>

      {/* Promotional Cart Popup */}
      <PromotionalCartPopup
        isOpen={isPromotionalCartOpen}
        onClose={() => setIsPromotionalCartOpen(false)}
        products={promotionalProducts}
      />


    </div>
  )
} 