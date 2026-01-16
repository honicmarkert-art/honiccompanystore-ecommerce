"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Menu,
  X,
  LogOut,
  DollarSign,
  Landmark,
  Crown,
  ArrowUp,
  TrendingUp,
  Megaphone,
  Star,
  HelpCircle,
  Building2,
  Globe,
  Moon,
  Sun,
  Settings,
  History,
} from "lucide-react"
import { supabaseClient } from '@/lib/supabase-client'

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useCurrency } from "@/contexts/currency-context"
import { useLanguage } from "@/contexts/language-context"
import { useCompanyContext } from "@/components/company-provider"
import { SupplierRouteGuard } from "@/components/supplier-route-guard"
import { SupplierNotificationCenter } from "@/components/supplier-notification-center"
import { Building2 as Building2Icon, MapPin, Phone, Save, FileText, AlertTriangle, Bell, Languages, User, IdCard, Camera, Upload, Image as ImageIcon, Lightbulb, FileCheck } from "lucide-react"
import { useIntlTranslation, useIntlTranslationNamespace } from "@/hooks/use-intl-translation"

// All Tanzania regions
const TANZANIA_REGIONS = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Mjini Magharibi',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pemba North',
  'Pemba South',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Unguja North',
  'Unguja South'
]

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const { backgroundColor, setBackgroundColor, themeClasses } = useTheme()
  const { signOut, user, loading, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currency, setCurrency } = useCurrency()
  const { language, setLanguage } = useLanguage()
  const t = useIntlTranslation()
  const tNav = useIntlTranslationNamespace('navigation')
  const tLayout = useIntlTranslationNamespace('layout')
  
  const allNavigation = [
    { name: tNav('dashboard'), href: "/supplier/dashboard", icon: LayoutDashboard },
    { name: tNav('products'), href: "/supplier/products", icon: Package },
    { name: 'Current Orders', href: "/supplier/orders", icon: ShoppingCart },
    { name: 'Order History', href: "/supplier/orders/history", icon: History },
    { name: tNav('analytics'), href: "/supplier/analytics", icon: TrendingUp },
    { name: tNav('marketing'), href: "/supplier/marketing", icon: Megaphone },
    { name: tNav('featured'), href: "/supplier/featured", icon: Star },
    { name: tNav('companyDetails'), href: "/supplier/company-info", icon: Building2 },
    { name: tNav('payoutAccounts'), href: "/supplier/payouts", icon: DollarSign },
    { name: tNav('invoicesBilling'), href: "/supplier/invoices", icon: FileText },
    { name: tNav('accountSettings'), href: "/supplier/account/settings", icon: Settings },
    { name: tNav('support'), href: "/supplier/support", icon: HelpCircle },
  ]
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { companyName, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  const [currentPlan, setCurrentPlan] = useState<{ id: string; name: string; slug: string; price: number; currency: string; term: string | null } | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [hasValidPremiumPayment, setHasValidPremiumPayment] = useState<boolean>(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [unreadOrderCount, setUnreadOrderCount] = useState(0)
  const [isActive, setIsActive] = useState<boolean | null>(null)
  const [userCompanyName, setUserCompanyName] = useState<string | null>(null)
  const [userCompanyLogo, setUserCompanyLogo] = useState<string | null>(null)
  const [companyInfoComplete, setCompanyInfoComplete] = useState<boolean | null>(null)
  const [isCheckingCompanyInfo, setIsCheckingCompanyInfo] = useState(false)
  const [shouldShowCompanyInfoModal, setShouldShowCompanyInfoModal] = useState(false)
  const [companyInfoForm, setCompanyInfoForm] = useState({
    companyName: '',
    location: '',
    officeNumber: '',
    registrationType: '',
    businessRegistrationNumber: '',
    tinOrNida: '',
    fullLegalName: '',
    region: '',
    nation: 'Tanzania'
  })
  const [hasInitializedCompanyInfoForm, setHasInitializedCompanyInfoForm] = useState(false)
  const [companyInfoFormDirty, setCompanyInfoFormDirty] = useState(false)
  const companyInfoFormDirtyRef = useRef(false)
  const [nidaCardPhoto, setNidaCardPhoto] = useState<string | null>(null)
  const [selfFacePhoto, setSelfFacePhoto] = useState<string | null>(null)
  const [businessTinCertificate, setBusinessTinCertificate] = useState<string | null>(null)
  const [companyCertificate, setCompanyCertificate] = useState<string | null>(null)
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null)
  const [isSubmittingCompanyInfo, setIsSubmittingCompanyInfo] = useState(false)
  const [nidaDeclarationAccepted, setNidaDeclarationAccepted] = useState(false)
  const [certificationDeclarationAccepted, setCertificationDeclarationAccepted] = useState(false)
  
  // Fallback logo system
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      // Clear local state immediately to prevent route guards from interfering
      // Clear all storage first
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Call logout API directly to avoid signOut's redirect interfering
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })
      } catch (apiError) {
        // Continue with redirect even if API fails
      }
      
      // Force hard redirect to become-supplier page immediately
      // Use window.location.replace to prevent back button from going to supplier pages
      // Do this immediately without waiting for anything else
      if (typeof window !== 'undefined') {
        window.location.replace('/become-supplier')
        return // Exit early to prevent any other code from running
      }
    } catch (error) {
      // On error, still force redirect to become-supplier immediately
      if (typeof window !== 'undefined') {
        window.location.replace('/become-supplier')
        return
      }
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Fetch current plan for suppliers (with ref to prevent duplicate calls)
  const planFetchedRef = useRef(false)
  useEffect(() => {
    // Prevent duplicate fetches
    if (planFetchedRef.current || !user || !isAuthenticated) {
      if (!user || !isAuthenticated) {
        setLoadingPlan(false)
      }
      return
    }

    planFetchedRef.current = true
    const fetchCurrentPlan = async () => {
      try {
        const response = await fetch('/api/user/current-plan', {
          credentials: 'include'
        })
        const data = await response.json()
        
        if (data.success && data.isSupplier) {
          setCurrentPlan(data.plan)
          setPendingPlanId(data.pendingPlanId || null)
          setHasValidPremiumPayment(data.hasValidPremiumPayment || false)
          setPaymentStatus(data.paymentStatus || null)
        }
      } catch (error) {
        } finally {
        setLoadingPlan(false)
      }
    }

    fetchCurrentPlan()
  }, [user?.id, isAuthenticated]) // Only depend on user.id, not entire user object

  // Fetch supplier status, company name, and check if company info is complete
  // This will auto-detect and show modal if info is incomplete (with throttling)
  const statusFetchedRef = useRef(false)
  const lastCheckKeyRef = useRef<string>('')
  const lastModalCheckAtRef = useRef<number>(0)
  const companyInfoCompleteRef = useRef<boolean | null>(null)
  const isCheckingCompanyInfoRef = useRef<boolean>(false)

  // Keep refs in sync with state for timers
  useEffect(() => {
    companyInfoCompleteRef.current = companyInfoComplete
  }, [companyInfoComplete])

  useEffect(() => {
    isCheckingCompanyInfoRef.current = isCheckingCompanyInfo
  }, [isCheckingCompanyInfo])

  // Keep a ref of whether the modal form has been edited, to avoid stale closures
  useEffect(() => {
    companyInfoFormDirtyRef.current = companyInfoFormDirty
  }, [companyInfoFormDirty])

  // Auto-detect and check company info completeness on mount, route change, and plan change
  useEffect(() => {
    if (!user?.id || !isAuthenticated) {
      setCompanyInfoComplete(null)
      statusFetchedRef.current = false
      setIsCheckingCompanyInfo(false)
      setShouldShowCompanyInfoModal(false)
      setHasInitializedCompanyInfoForm(false)
      setCompanyInfoFormDirty(false)
      return
    }

    // Create a unique key for this check combination
    const checkKey = `${user.id}-${pathname}-${currentPlan?.slug || 'none'}`
    
    // Skip if already checked for this exact combination
    if (statusFetchedRef.current && lastCheckKeyRef.current === checkKey) {
      return
    }

    // Update refs to mark as checking
    lastCheckKeyRef.current = checkKey
    statusFetchedRef.current = true

    const fetchSupplierStatus = async () => {
      setIsCheckingCompanyInfo(true)
      try {
        // First fetch current plan to check if user is Winga
        let isWinga = false
        try {
          const planResponse = await fetch('/api/user/current-plan', {
            credentials: 'include'
          })
          if (planResponse.ok) {
            const planData = await planResponse.json()
            isWinga = planData.success && planData.plan?.slug === 'winga'
          }
        } catch (planError) {
          // Silently handle plan fetch errors - continue with default values
        }
        
        const { data: profile, error } = await supabaseClient
          .from('profiles')
          .select('is_active, company_name, company_logo, location, office_number, registration_type, business_registration_number, tin_or_nida, region, nation, business_tin_certificate_url, company_certificate_url')
          .eq('id', user.id)
          .single()

        if (!error && profile) {
          setIsActive(profile.is_active !== false) // Default to true if null
          setUserCompanyName(profile.company_name || null)
          setUserCompanyLogo(profile.company_logo || null)
          
          // Check if company info is complete
          // For Winga users: company_name, office_number, tin_or_nida, and region are required (location is optional but recommended)
          // For non-Winga users: company_name, location, office_number, business_registration_number, and region are required
          // Only check required fields, not optional ones
          const isComplete = isWinga
            ? !!(
                profile.company_name && 
                profile.office_number &&
                profile.tin_or_nida &&
                profile.region &&
                profile.company_name.trim() !== '' &&
                profile.office_number.trim() !== '' &&
                profile.tin_or_nida.trim() !== '' &&
                profile.region.trim() !== ''
              )
            : !!(
                profile.company_name && 
                profile.location && 
                profile.office_number &&
                profile.registration_type &&
                profile.business_registration_number &&
                profile.region &&
                profile.company_name.trim() !== '' &&
                profile.location.trim() !== '' &&
                profile.office_number.trim() !== '' &&
                profile.registration_type.trim() !== '' &&
                profile.business_registration_number.trim() !== '' &&
                profile.region.trim() !== ''
              )
          setCompanyInfoComplete(isComplete)
          
          // Map database registration_type values back to form values
          const registrationTypeMap: Record<string, string> = {
            'business_registration': 'business',
            'company_registration': 'company',
            'tin': 'tin'
          }
          const formRegistrationType = profile.registration_type 
            ? (registrationTypeMap[profile.registration_type] || profile.registration_type)
            : ''
          
          // Set form data only once per session and only if user hasn't started editing
          if (!hasInitializedCompanyInfoForm && !companyInfoFormDirtyRef.current) {
            setCompanyInfoForm({
              companyName: profile.company_name || '',
              location: profile.location || '',
              officeNumber: profile.office_number || '',
              registrationType: formRegistrationType,
              businessRegistrationNumber: profile.business_registration_number || '',
              tinOrNida: profile.tin_or_nida || '',
              fullLegalName: (profile as any).full_legal_name || '',
              region: profile.region || '',
              nation: profile.nation || 'Tanzania'
            })
            setHasInitializedCompanyInfoForm(true)
          }
          if ((profile as any).nida_card_photo_url) {
            setNidaCardPhoto((profile as any).nida_card_photo_url)
          }
          if ((profile as any).self_face_photo_url) {
            setSelfFacePhoto((profile as any).self_face_photo_url)
          }
          if (profile.business_tin_certificate_url) {
            setBusinessTinCertificate(profile.business_tin_certificate_url)
          }
          if (profile.company_certificate_url) {
            setCompanyCertificate(profile.company_certificate_url)
          }
          
          // Auto-accept declarations if user already has submitted info
          if (profile.company_name || profile.business_registration_number || profile.tin_or_nida) {
            setNidaDeclarationAccepted(true)
            setCertificationDeclarationAccepted(true)
          }
          if (profile.business_tin_certificate_url || profile.company_certificate_url) {
            setCertificationDeclarationAccepted(true)
          }
        } else {
          // If no profile or error, show modal to fill info
          setCompanyInfoComplete(false)
        }
      } catch (error) {
        // If error fetching, assume incomplete to show modal
        setCompanyInfoComplete(false)
      } finally {
        setIsCheckingCompanyInfo(false)

        // Decide whether to show the modal, with a small delay and rate limiting
        const now = Date.now()
        const timeSinceLast = now - (lastModalCheckAtRef.current || 0)

        // Only consider showing the modal at most twice per minute (every 30s)
        if (timeSinceLast >= 30000 && companyInfoCompleteRef.current === false) {
          const timeoutId = setTimeout(() => {
            if (!isCheckingCompanyInfoRef.current && companyInfoCompleteRef.current === false) {
              lastModalCheckAtRef.current = Date.now()
              setShouldShowCompanyInfoModal(true)
            }
          }, 2000)

          ;(fetchSupplierStatus as any)._lastTimeoutId = timeoutId
        }
      }
    }

    fetchSupplierStatus()

    // Periodic re-check (every 30s); decision to show modal is still throttled above
    const intervalId = setInterval(fetchSupplierStatus, 30000)
    
    // Listen for company info updates
    const handleCompanyInfoUpdate = () => {
      // Reset refs to allow refetch on next check
      statusFetchedRef.current = false
      lastCheckKeyRef.current = ''
      // Immediately refetch status
      fetchSupplierStatus()
    }
    
    // Listen for account status changes (e.g., from notifications)
    const handleAccountStatusChange = () => {
      // Reset refs to allow refetch
      statusFetchedRef.current = false
      lastCheckKeyRef.current = ''
      // Immediately refetch status
      fetchSupplierStatus()
    }
    
    window.addEventListener('company-info-updated', handleCompanyInfoUpdate)
    window.addEventListener('plan-updated', handleCompanyInfoUpdate) // Listen for plan changes
    window.addEventListener('account-status-changed', handleAccountStatusChange) // Listen for account status changes
    
    return () => {
      window.removeEventListener('company-info-updated', handleCompanyInfoUpdate)
      window.removeEventListener('plan-updated', handleCompanyInfoUpdate)
      window.removeEventListener('account-status-changed', handleAccountStatusChange)
      clearInterval(intervalId)
      const tId = (fetchSupplierStatus as any)._lastTimeoutId
      if (tId) clearTimeout(tId)
    }
  }, [user?.id, isAuthenticated, pathname, currentPlan?.slug]) // Re-check on route change and plan change

  // Track if unread count setup is done
  const unreadCountSetupRef = useRef(false)
  useEffect(() => {
    if (unreadCountSetupRef.current || !isAuthenticated || !user) return

    unreadCountSetupRef.current = true
    
    // Fetch unread order count function (defined inside useEffect to avoid dependency issues)
    const fetchUnreadCount = async () => {
      if (!user || !isAuthenticated) return

      try {
        const response = await fetch('/api/supplier/orders/unread-count', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setUnreadOrderCount(data.unreadCount || 0)
          }
        }
      } catch (error) {
        // Silently handle fetch errors (network issues, extensions, etc.)
        // Don't update unread count on error to avoid resetting it
      }
    }
    
    // Initial fetch
    fetchUnreadCount()
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    
    // Real-time subscription for new confirmed orders
    const channel = supabaseClient
      .channel('supplier-layout-orders-realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'confirmed_orders' 
      }, () => {
        fetchUnreadCount()
      })
      .subscribe((status) => {
        // Silent subscription handling
      })
    
    // Listen for orders page visit to refresh count
    const handleOrdersVisited = () => {
      // Small delay to allow orders to load, then refresh count
      setTimeout(() => {
        fetchUnreadCount()
      }, 1000)
    }
    
    window.addEventListener('supplier-orders-visited', handleOrdersVisited)
    
    return () => {
      clearInterval(interval)
      supabaseClient.removeChannel(channel)
      window.removeEventListener('supplier-orders-visited', handleOrdersVisited)
      unreadCountSetupRef.current = false
    }
  }, [user?.id, isAuthenticated]) // Only depend on user.id

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'business_tin_certificate' | 'company_certificate') => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Error", description: "Please upload a valid image or PDF file.", variant: "destructive" })
      return
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({ title: "Error", description: "File size must be less than 10MB", variant: "destructive" })
      return
    }

    setUploadingDocument(type)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', type)

      const response = await fetch('/api/supplier/document-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      const result = await response.json()

      if (response.ok && result.success) {
        if (type === 'business_tin_certificate') setBusinessTinCertificate(result.url)
        if (type === 'company_certificate') setCompanyCertificate(result.url)
        toast({ title: "Success", description: `${type.replace(/_/g, ' ')} uploaded successfully.` })
      } else {
        toast({ title: "Error", description: "Failed", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed", variant: "destructive" })
    } finally {
      setUploadingDocument(null)
      event.target.value = ''
    }
  }

  const handleCompanyInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingCompanyInfo(true)

    try {
      // Map registration type values for API
      const registrationTypeMap: Record<string, string> = {
        'business': 'business_registration',
        'company': 'company_registration',
        'tin': 'tin'
      }
      const mappedRegistrationType = companyInfoForm.registrationType 
        ? (registrationTypeMap[companyInfoForm.registrationType] || companyInfoForm.registrationType)
        : companyInfoForm.registrationType

      const response = await fetch('/api/user/update-company-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...companyInfoForm,
          registrationType: mappedRegistrationType,
          businessTinCertificateUrl: businessTinCertificate,
          companyCertificateUrl: companyCertificate
        })
      })

      const result = await response.json()

        if (result.success) {
        // Immediately update account status to inactive (API sets is_active to false)
        setIsActive(false)
        
        // Check if user has pending premium plan - redirect to payment
        if (result.pendingPremiumPlan) {
          toast({
            title: 'Information Submitted',
            description: 'Redirecting to payment page to complete your premium plan upgrade...',
            duration: 5000,
          })
          
          // Small delay to allow toast to show
          setTimeout(() => {
            router.push(`/supplier/payment?planId=${result.pendingPremiumPlan.id}`)
          }, 1000)
          return
        }
        
        toast({
          title: 'Information Submitted',
          description: 'Your account will be activated after we review and confirm your information. Please ensure all details are correct.',
          duration: 10000,
        })

        // Close the company info modal after successful save
        setShouldShowCompanyInfoModal(false)
        
        // Immediately refetch supplier status to update all fields
        if (user?.id) {
          try {
            const { data: profile, error } = await supabaseClient
              .from('profiles')
              .select('is_active, company_name, company_logo, location, office_number, registration_type, business_registration_number, tin_or_nida, full_legal_name, nida_card_photo_url, self_face_photo_url, region, nation, business_tin_certificate_url, company_certificate_url')
              .eq('id', user.id)
              .single()

            if (!error && profile) {
            setIsActive(profile.is_active !== false)
            setUserCompanyName(profile.company_name || null)
              setUserCompanyLogo(profile.company_logo || null)
            
            // Map database registration_type values back to form values
            const registrationTypeMap: Record<string, string> = {
              'business_registration': 'business',
              'company_registration': 'company',
              'tin': 'tin'
            }
            const formRegistrationType = profile.registration_type 
              ? (registrationTypeMap[profile.registration_type] || profile.registration_type)
              : ''
            
            // Update form data with latest values ONLY if user hasn't started editing in this session
            if (!companyInfoFormDirtyRef.current) {
              setCompanyInfoForm({
                companyName: profile.company_name || '',
                location: profile.location || '',
                officeNumber: profile.office_number || '',
                registrationType: formRegistrationType,
                businessRegistrationNumber: profile.business_registration_number || '',
                tinOrNida: profile.tin_or_nida || '',
                fullLegalName: (profile as any).full_legal_name || '',
                region: profile.region || '',
                nation: profile.nation || 'Tanzania'
              })
            }
            if ((profile as any).nida_card_photo_url) {
              setNidaCardPhoto((profile as any).nida_card_photo_url)
            }
            if ((profile as any).self_face_photo_url) {
              setSelfFacePhoto((profile as any).self_face_photo_url)
            }
            if (profile.business_tin_certificate_url) {
              setBusinessTinCertificate(profile.business_tin_certificate_url)
            }
            if (profile.company_certificate_url) {
              setCompanyCertificate(profile.company_certificate_url)
            }
            
            // Auto-accept declarations if user already has submitted info
            if (profile.company_name || profile.business_registration_number || profile.tin_or_nida) {
              setNidaDeclarationAccepted(true)
              setCertificationDeclarationAccepted(true)
            }
          }
          } catch (refreshError) {
            }
        }
        // Form is now in sync with backend; future auto-refreshes can safely overwrite
        setCompanyInfoFormDirty(false)
        
        // Trigger refresh event for other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('company-info-updated'))
          window.dispatchEvent(new CustomEvent('account-status-changed'))
        }
        setCompanyInfoComplete(true)
        
        // Redirect Winga users to their business info page after submission
        // Similar to how regular suppliers go to company-info page
        if (currentPlan?.slug === 'winga') {
          // Small delay to allow modal to close
          setTimeout(() => {
            router.push('/winga/business-info')
          }, 500)
        }
      } else {
        toast({
          title: 'Error',
          description: 'Failed',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
    } finally {
      setIsSubmittingCompanyInfo(false)
    }
  }

  const isFreePlan = currentPlan?.slug === 'free'
  const isPremiumPlan = currentPlan?.slug === 'premium' && hasValidPremiumPayment
  const isWingaPlan = currentPlan?.slug === 'winga'
  const isPremiumPendingPayment = paymentStatus === 'pending' // Check payment_status directly

  // Compute navigation items using useMemo to prevent flash when plan loads
  const navigationItems = useMemo(() => {
    // Show skeleton while loading plan OR if plan hasn't been determined yet
    // Wait until we know the plan definitively before showing navigation
    if (loadingPlan || !currentPlan) {
      return []
    }
    
    // For Winga users, only show: Dashboard, Products, Orders, Payout Accounts, Account Settings, Support, and Winga Business Info
    if (isWingaPlan) {
      return allNavigation
        .filter(item => 
          item.href === "/supplier/dashboard" || 
          item.href === "/supplier/products" || 
          item.href === "/supplier/orders" ||
          item.href === "/supplier/payouts" ||
          item.href === "/supplier/account/settings" ||
          item.href === "/supplier/support" ||
          item.href === "/supplier/company-info"
        )
        .map(item => {
          if (item.href === "/supplier/company-info") {
            return { ...item, href: "/winga/business-info", name: "Winga Business Info" }
          }
          if (item.href === "/supplier/support") {
            return { ...item, href: "/winga/support", name: tNav('support') }
          }
          return item
        })
    }
    
    // For non-Winga users, show all navigation (payout accounts available to all plans)
    return allNavigation
  }, [loadingPlan, currentPlan, isWingaPlan, allNavigation])

  // Don't block on loading - SupplierRouteGuard handles authentication and loading states
  // The loading check is removed to prevent infinite loading issues

  return (
    <SupplierRouteGuard>
      <div className={cn("flex h-screen overflow-hidden", themeClasses.mainBg)} suppressHydrationWarning>
        {/* Modern Sidebar - No Borders */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out",
            "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl",
            "shadow-xl",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0 lg:static lg:inset-0 lg:mr-2"
          )}
          suppressHydrationWarning
        >
          <div className="flex h-full flex-col" suppressHydrationWarning>
            {/* Logo Header - No Border */}
            <div className={cn("flex h-16 items-center justify-between px-6", "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-900")} suppressHydrationWarning>
              <div className="flex items-center gap-2" suppressHydrationWarning>
                <Link href="/supplier/dashboard" className={cn("flex items-center gap-2", themeClasses.mainText)}>
                  <Image
                    src={displayLogo}
                    alt={`${companyName || 'Honic'} Logo`}
                    width={48}
                    height={48}
                    className="rounded-md"
                  />
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold leading-tight">{tLayout('supplier')}</span>
                    <span className={cn("text-xs leading-tight", themeClasses.textNeutralSecondary)}>
                      {tNav('dashboard')}
                    </span>
                  </div>
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

            {/* Modern Navigation - No Borders */}
            <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
              {/* Show loading skeleton FIRST while fetching data, then show navigation AFTER we know the plan */}
              {/* This prevents flash of wrong navigation items before we know if user is Winga or not */}
              {loadingPlan || !currentPlan ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center px-3 py-3">
                      <Skeleton className="h-5 w-5 rounded mr-3" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : (
                navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                const showBadge = item.name === 'Orders' && unreadOrderCount > 0
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center px-4 py-3 text-sm font-medium rounded-lg relative transition-all duration-200",
                      "hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 dark:hover:from-gray-800 dark:hover:to-gray-700",
                      isActive 
                        ? "bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 shadow-sm"
                        : "hover:shadow-sm"
                    )}
                  >
                    <Icon className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      isActive 
                        ? "text-yellow-600 dark:text-yellow-400" 
                        : "text-gray-600 dark:text-gray-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400"
                    )} />
                    <span className={cn(
                      isActive 
                        ? "text-yellow-900 dark:text-yellow-100 font-semibold" 
                        : "text-gray-700 dark:text-gray-300"
                    )}>{item.name}</span>
                    {showBadge && (
                      <Badge className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 min-w-[20px] flex items-center justify-center rounded-full shadow-sm">
                        {unreadOrderCount > 99 ? '99+' : unreadOrderCount}
                      </Badge>
                    )}
                  </Link>
                )
              })
              )}
            </nav>

            {/* Bottom section - No Border */}
            <div className={cn("p-4 bg-gradient-to-t from-gray-50 to-transparent dark:from-gray-900 dark:to-transparent")} suppressHydrationWarning>
              {/* Current Plan */}
              {!loadingPlan && currentPlan && (
                <div className={cn("mb-4 p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 shadow-sm")} suppressHydrationWarning>
                  <div className="flex items-center gap-2" suppressHydrationWarning>
                    <Crown className={cn(
                      "h-4 w-4",
                      isPremiumPlan ? "text-yellow-500" : "text-gray-400"
                    )} />
                    <span className={cn("text-xs font-medium", themeClasses.mainText)}>
                      {currentPlan.name}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3" suppressHydrationWarning>
                <span className={cn("text-xs font-medium", themeClasses.textNeutralSecondary)}>{tLayout('currency')}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex items-center gap-1.5 h-8 px-2 rounded-lg",
                        "hover:bg-yellow-50 dark:hover:bg-gray-800",
                        themeClasses.mainText
                      )}
                    >
                      {currency === "USD" ? <DollarSign className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                      <span className="text-xs font-medium">{currency}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("bg-white dark:bg-gray-900 shadow-xl rounded-lg")}>
                    <DropdownMenuItem
                      onClick={() => setCurrency("USD")}
                      className="hover:bg-yellow-50 dark:hover:bg-gray-800"
                    >
                      <DollarSign className="w-4 h-4 mr-2" /> USD
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCurrency("TZS")}
                      className="hover:bg-yellow-50 dark:hover:bg-gray-800"
                    >
                      <Landmark className="w-4 h-4 mr-2" /> TZS
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex items-center justify-between mb-3" suppressHydrationWarning>
                <span className={cn("text-xs font-medium", themeClasses.textNeutralSecondary)}>{tLayout('language')}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex items-center gap-1.5 h-8 px-2 rounded-lg",
                        "hover:bg-yellow-50 dark:hover:bg-gray-800",
                        themeClasses.mainText
                      )}
                    >
                      <Globe className="w-4 h-4" />
                      <span className="text-xs font-medium">{language === "en" ? "EN" : "SW"}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("bg-white dark:bg-gray-900 shadow-xl rounded-lg")}>
                    <DropdownMenuItem
                      onClick={() => setLanguage("en")}
                      className="hover:bg-yellow-50 dark:hover:bg-gray-800"
                    >
                      <Globe className="w-4 h-4 mr-2" /> {tLayout('english')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLanguage("sw")}
                      className="hover:bg-yellow-50 dark:hover:bg-gray-800"
                    >
                      <Globe className="w-4 h-4 mr-2" /> {tLayout('swahili')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start h-10 rounded-lg",
                  "hover:bg-red-50 dark:hover:bg-red-900/20",
                  "text-red-600 dark:text-red-400",
                  "font-medium"
                )}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoggingOut ? tLayout('signingOut') : tLayout('logout')}
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Top Header - No Border */}
        <div className={cn(
          "fixed top-0 left-0 right-0 lg:left-[calc(16rem+0.5rem)] z-40 flex h-16 sm:h-20 items-center gap-x-2 sm:gap-x-3 px-3 sm:px-4 lg:px-6",
          "bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl",
          "shadow-lg rounded-b-lg"
        )} suppressHydrationWarning>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>

            <div className="flex flex-1 items-center gap-x-1 sm:gap-x-2 self-stretch lg:gap-x-4 min-w-0 overflow-hidden" suppressHydrationWarning>
              {/* Company Name with Logo - Left Side */}
              <div className="hidden sm:flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                {userCompanyLogo && (
                  <Image
                    src={userCompanyLogo}
                    alt={`${userCompanyName || 'Honic'} Logo`}
                    width={40}
                    height={40}
                    className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex-shrink-0 rounded-lg object-contain"
                  />
                )}
                <span className={cn("text-xs sm:text-sm lg:text-base font-bold truncate block", themeClasses.mainText)}>
                  {userCompanyName || 'Honic'}
                </span>
              </div>
              <div className="flex flex-1 sm:hidden" suppressHydrationWarning />
              <div className="flex items-center gap-x-0.5 sm:gap-x-1 lg:gap-x-2 flex-shrink-0 overflow-visible" suppressHydrationWarning>
                {/* Account Status - Mobile Native Style */}
                {isActive !== null && (
                  <div className={cn(
                    "px-2.5 py-1.5 sm:px-2.5 sm:py-1 lg:px-3 lg:py-1.5",
                    "text-[10px] sm:text-[11px] lg:text-xs font-semibold uppercase text-center whitespace-nowrap",
                    "rounded-full shadow-sm",
                    "flex items-center justify-center min-w-[60px] sm:min-w-[70px]",
                    "active:scale-95 transition-transform",
                    isActive 
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/20" 
                      : "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/20"
                  )}>
                    <span className="hidden sm:inline">{isActive ? tLayout('accountActive') : tLayout('accountInactive')}</span>
                    <span className="sm:hidden">{isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                )}
                {/* Current Plan Status - Mobile Native Style */}
                {!loadingPlan && currentPlan && (
                  <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-7 sm:h-8 lg:h-10 px-2 sm:px-2.5 lg:px-4 whitespace-nowrap",
                        "rounded-lg sm:rounded-lg",
                        "font-semibold text-[10px] sm:text-xs lg:text-sm",
                        "shadow-sm active:scale-95 transition-transform",
                        isFreePlan 
                          ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                          : isPremiumPlan
                          ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-500 hover:to-orange-500 shadow-md border-0"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                      )}
                      disabled={!isFreePlan}
                    >
                      <Crown className={cn(
                        "h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4 mr-1 sm:mr-1.5 flex-shrink-0",
                        isPremiumPlan ? "text-black" : "text-gray-600 dark:text-gray-400"
                      )} />
                      <span className="hidden lg:inline">{currentPlan.name}</span>
                      <span className="lg:hidden text-[10px] sm:text-xs">{isPremiumPlan ? 'Premium' : 'Free'}</span>
                    </Button>
                    {(isFreePlan || isPremiumPendingPayment) && (
                      <Button
                        size="sm"
                        className={cn(
                          "h-7 sm:h-8 lg:h-10 rounded-lg sm:rounded-lg",
                          isPremiumPendingPayment
                            ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                            : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
                          "text-white font-semibold text-[9px] sm:text-[10px] lg:text-sm",
                          "px-1.5 sm:px-2 lg:px-4 whitespace-nowrap",
                          "shadow-md shadow-yellow-500/30",
                          "active:scale-95 transition-transform",
                          "border-0"
                        )}
                        onClick={async () => {
                          if (isPremiumPendingPayment && pendingPlanId) {
                            router.push(`/supplier/payment?planId=${pendingPlanId}`)
                          } else if (isFreePlan) {
                            // For free plan users, initiate upgrade and redirect directly to payment page
                            try {
                              // Step 1: Fetch premium plan
                              const plansResponse = await fetch('/api/supplier-plans', {
                                credentials: 'include'
                              })
                              const plansData = await plansResponse.json()
                              
                              if (!plansData.success || !plansData.plans) {
                                throw new Error('Failed to fetch plans')
                              }
                              
                              const premiumPlan = plansData.plans.find((p: any) => p.slug === 'premium')
                              if (!premiumPlan) {
                                throw new Error('Premium plan not found')
                              }
                              
                              // Step 2: Initiate upgrade to get referenceId
                              const initiateResponse = await fetch('/api/supplier/upgrade/initiate', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  planId: premiumPlan.id,
                                  amount: premiumPlan.price
                                })
                              })
                              
                              // Check response status before parsing JSON
                              if (!initiateResponse.ok) {
                                if (initiateResponse.status === 401) {
                                  throw new Error('Your session has expired. Please refresh the page and try again.')
                                }
                                const errorData = await initiateResponse.json().catch(() => ({ error: 'Failed to initiate upgrade' }))
                                throw new Error(errorData.error || `Server error: ${initiateResponse.status}`)
                              }
                              
                              const initiateData = await initiateResponse.json()
                              
                              if (!initiateData.success || !initiateData.upgrade) {
                                throw new Error(initiateData.error || 'Failed to initiate upgrade')
                              }
                              
                              const { referenceId } = initiateData.upgrade
                              
                              // Step 3: Redirect directly to payment page
                              router.push(`/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`)
                            } catch (error: any) {
                              toast({
                                title: 'Error',
                                description: 'Failed',
                                variant: 'destructive'
                              })
                            }
                          } else {
                            // For other plans (e.g., Winga), still go to upgrade page for plan selection
                            router.push('/supplier/upgrade')
                          }
                        }}
                      >
                        {isPremiumPendingPayment && !isFreePlan ? (
                          <>
                            <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4 mr-0.5 sm:mr-1 lg:mr-1.5 flex-shrink-0" />
                            <span className="hidden lg:inline">{tLayout('completePayment')}</span>
                            <span className="lg:hidden text-[9px] sm:text-[10px] font-bold">Complete</span>
                          </>
                        ) : (
                          <>
                            <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4 mr-0.5 sm:mr-1 lg:mr-1.5 flex-shrink-0" />
                            <span className="hidden lg:inline">{tLayout('upgradePlan')}</span>
                            <span className="lg:hidden text-[9px] sm:text-[10px] font-bold">Upgrade</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
                {/* Notification Center - Secure notification system */}
                <SupplierNotificationCenter />
                {/* Theme Toggle Button - Modern Design */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Toggle between white and dark (black) only
                    const newTheme = (backgroundColor === 'white' || backgroundColor === 'gray') ? 'dark' : 'white'
                    setBackgroundColor(newTheme)
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "px-2 sm:px-3 lg:px-3 py-2 h-9 sm:h-10"
                  )}
                  title={(backgroundColor === 'white' || backgroundColor === 'gray') ? 'Switch to dark theme' : 'Switch to light theme'}
                >
                  {(backgroundColor === 'white' || backgroundColor === 'gray') ? (
                    <>
                      <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden lg:inline text-xs font-medium">Dark</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden lg:inline text-xs font-medium">Light</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col" suppressHydrationWarning>
          {/* Mandatory Company Info Modal */}
          <Dialog open={shouldShowCompanyInfoModal} modal={true}>
            <DialogContent className={cn("sm:max-w-[600px] max-h-[90vh] overflow-y-auto", isWingaPlan && "sm:max-w-[700px]")} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <div className="flex items-center justify-between mb-2">
                  <DialogTitle className={cn("text-2xl font-bold text-center flex-1", themeClasses.mainText)}>
                    {isWingaPlan 
                      ? (language === 'sw' ? 'Kamilisha Usajili Wako' : 'Complete Your Registration')
                      : t('company.completeRegistration')}
                  </DialogTitle>
                  {isWingaPlan && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLanguage(language === 'sw' ? 'en' : 'sw')}
                      className={cn(
                        "ml-4 flex items-center gap-2",
                        themeClasses.cardBorder,
                        themeClasses.buttonGhostHoverBg
                      )}
                      title={language === 'sw' ? 'Switch to English' : 'Badilisha kwa Kiswahili'}
                    >
                      <Languages className="w-4 h-4" />
                      <span className="text-xs">{language === 'sw' ? 'EN' : 'SW'}</span>
                    </Button>
                  )}
                </div>
                <DialogDescription className={cn("text-center", themeClasses.textNeutralSecondary)}>
                  {isWingaPlan 
                    ? (language === 'sw' 
                        ? 'Tafadhali jaza taarifa za biashara yako ili kukamilisha usajili na kufikia vipengele vyote.'
                        : 'Please fill in your business information to complete your registration and access all features.')
                    : t('company.fillCompanyInfo')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCompanyInfoSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-company-name" className={cn(themeClasses.mainText)}>
                    <Building2Icon className="inline w-4 h-4 mr-2" />
                    {isWingaPlan 
                      ? (language === 'sw' ? 'Jina la Kampuni *' : 'Your Business Name *')
                      : t('company.companyName')} <span className="text-red-500">*</span>
                  </Label>
                  {isWingaPlan && (
                    <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                      This name will appear on your products (like business name). Your personal name or trading name (e.g., "John's Connections" or just "John Doe")
                    </p>
                  )}
                  <Input
                    id="modal-company-name"
                    type="text"
                    placeholder={isWingaPlan ? "Enter your business or trading name" : "Enter your company name"}
                    value={companyInfoForm.companyName}
                    onChange={(e) => {
                      setCompanyInfoFormDirty(true)
                      setCompanyInfoForm({ ...companyInfoForm, companyName: e.target.value })
                    }}
                    required
                    className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-location" className={cn(themeClasses.mainText)}>
                    <MapPin className="inline w-4 h-4 mr-2" />
                    {isWingaPlan ? 'Operating Location' : t('company.location')} 
                    {isWingaPlan ? <span className="text-yellow-600 dark:text-yellow-400 ml-1">(Recommended)</span> : <span className="text-red-500">*</span>}
                  </Label>
                  <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                    {isWingaPlan 
                      ? 'Where you operate (e.g., "Kariakoo Market", "Dar es Salaam", "Online via WhatsApp/Instagram")'
                      : 'Please provide the most correct and exact location. You can include nearby famous places or landmarks to help identify your location accurately.'}
                  </p>
                  <Input
                    id="modal-location"
                    type="text"
                    placeholder={isWingaPlan ? "Enter your operating location (recommended)" : "Enter your company location (e.g., Near ABC Mall, Main Street, City)"}
                    value={companyInfoForm.location}
                    onChange={(e) => {
                      setCompanyInfoFormDirty(true)
                      setCompanyInfoForm({ ...companyInfoForm, location: e.target.value })
                    }}
                    required={!isWingaPlan}
                    className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-office-number" className={cn(themeClasses.mainText)}>
                    <Phone className="inline w-4 h-4 mr-2" />
                    {isWingaPlan ? 'Business Phone Number *' : t('company.officeNumber')} <span className="text-red-500">*</span>
                  </Label>
                  {isWingaPlan && (
                    <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                      Your phone number for customer contact (WhatsApp, calls, etc.)
                    </p>
                  )}
                  <Input
                    id="modal-office-number"
                    type="text"
                    placeholder={isWingaPlan ? "Enter your business phone number" : "Enter your office phone number"}
                    value={companyInfoForm.officeNumber}
                    onChange={(e) => {
                      setCompanyInfoFormDirty(true)
                      setCompanyInfoForm({ ...companyInfoForm, officeNumber: e.target.value })
                    }}
                    required
                    className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                  />
                </div>
                {!isWingaPlan && (
                  <>
                    <div className="space-y-2">
                      <Label className={cn(themeClasses.mainText)}>
                        <FileText className="inline w-4 h-4 mr-2" />
                        Business / Company /TIN Registration Number <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                        Select the type of registration and enter your registration number
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={companyInfoForm.registrationType}
                          onValueChange={(value) => {
                            setCompanyInfoFormDirty(true)
                            setCompanyInfoForm({ ...companyInfoForm, registrationType: value })
                          }}
                          required
                        >
                          <SelectTrigger className={cn(themeClasses.cardBorder, themeClasses.cardBg)}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="company">Company</SelectItem>
                            <SelectItem value="tin">TIN</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          id="modal-business-registration-number"
                          type="text"
                          placeholder="Enter registration number"
                          value={companyInfoForm.businessRegistrationNumber ?? ''}
                          onChange={(e) => {
                            setCompanyInfoFormDirty(true)
                            setCompanyInfoForm({ ...companyInfoForm, businessRegistrationNumber: e.target.value })
                          }}
                          required
                          disabled={!companyInfoForm.registrationType}
                          className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-region" className={cn(themeClasses.mainText)}>
                        <MapPin className="inline w-4 h-4 mr-2" />
                        Region <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Select your business region within Tanzania
                      </p>
                      <Select
                        value={companyInfoForm.region}
                        onValueChange={(value) => {
                          setCompanyInfoFormDirty(true)
                          setCompanyInfoForm({ ...companyInfoForm, region: value })
                        }}
                        required
                      >
                        <SelectTrigger
                          id="modal-region"
                          className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                        >
                          <SelectValue placeholder="Select your region" />
                        </SelectTrigger>
                        <SelectContent>
                          {TANZANIA_REGIONS.map((region) => (
                            <SelectItem key={region} value={region}>
                              {region}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-nation" className={cn(themeClasses.mainText)}>
                        <Building2Icon className="inline w-4 h-4 mr-2" />
                        Nation <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Currently only Tanzania is supported
                      </p>
                      <Input
                        id="modal-nation"
                        type="text"
                        value={companyInfoForm.nation}
                        disabled
                        className={cn("bg-gray-100 dark:bg-gray-800", themeClasses.cardBorder, themeClasses.cardBg)}
                        required
                      />
                      <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                        Nation is set to Tanzania by default. Other nations are not available at this time.
                      </p>
                    </div>
                    
                    {/* Certification Documents - Show when registration type is selected */}
                    {companyInfoForm.registrationType && (
                      <>
                        {/* Business TIN Certificate Upload - Show for Business or TIN registration type */}
                        {(companyInfoForm.registrationType === 'business' || companyInfoForm.registrationType === 'tin') && (
                          <div className="space-y-2">
                            <Label htmlFor="modal-business-tin-certificate" className={cn(themeClasses.mainText)}>
                              Business TIN Certificate <span className="text-yellow-600 dark:text-yellow-400">(Required for verification)</span>
                            </Label>
                            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                              Upload a clear photo or scan of your Business TIN Certificate. This is required for account verification.
                            </p>
                            <div className="flex items-center gap-4">
                              <div className="relative flex flex-col items-center gap-2">
                                {businessTinCertificate ? (
                                  <>
                                    <div className="relative">
                                      {businessTinCertificate.includes('.pdf') || businessTinCertificate.toLowerCase().includes('application/pdf') ? (
                                        <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                          <FileText className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                        </div>
                                      ) : (
                                        <img
                                          src={businessTinCertificate}
                                          alt="Business TIN Certificate"
                                          className={cn("w-16 h-16 object-cover border rounded-md", themeClasses.cardBorder, themeClasses.cardBg)}
                                        />
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="mt-1 text-[10px] px-2 h-6"
                                      onClick={() => window.open(businessTinCertificate, '_blank', 'noopener,noreferrer')}
                                    >
                                      Preview
                                    </Button>
                                  </>
                                ) : (
                                  <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                    <FileCheck className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id="modal-business-tin-certificate"
                                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                                  onChange={(e) => handleDocumentUpload(e, 'business_tin_certificate')}
                                  className="hidden"
                                  disabled={uploadingDocument === 'business_tin_certificate'}
                                />
                                <Label
                                  htmlFor="modal-business-tin-certificate"
                                  className={cn(
                                    "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                    themeClasses.cardBorder,
                                    themeClasses.cardBg,
                                    uploadingDocument === 'business_tin_certificate' && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span>{uploadingDocument === 'business_tin_certificate' ? "Uploading..." : businessTinCertificate ? "Change Certificate" : "Upload TIN Certificate"}</span>
                                </Label>
                                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                  PNG, JPG, PDF (max 10MB) - Required for verification
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Company Certificate Upload - Show for Company registration type */}
                        {companyInfoForm.registrationType === 'company' && (
                          <div className="space-y-2">
                            <Label htmlFor="modal-company-certificate" className={cn(themeClasses.mainText)}>
                              Company Registration Certificate <span className="text-yellow-600 dark:text-yellow-400">(Required for verification)</span>
                            </Label>
                            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                              Upload a clear photo or scan of your Company Registration Certificate. This is required for account verification.
                            </p>
                            <div className="flex items-center gap-4">
                              <div className="relative flex flex-col items-center gap-2">
                                {companyCertificate ? (
                                  <>
                                    <div className="relative">
                                      {companyCertificate.includes('.pdf') || companyCertificate.toLowerCase().includes('application/pdf') ? (
                                        <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                          <FileText className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                        </div>
                                      ) : (
                                        <img
                                          src={companyCertificate}
                                          alt="Company Certificate"
                                          className={cn("w-16 h-16 object-cover border rounded-md", themeClasses.cardBorder, themeClasses.cardBg)}
                                        />
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="mt-1 text-[10px] px-2 h-6"
                                      onClick={() => window.open(companyCertificate, '_blank', 'noopener,noreferrer')}
                                    >
                                      Preview
                                    </Button>
                                  </>
                                ) : (
                                  <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                                    <FileCheck className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id="modal-company-certificate"
                                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                                  onChange={(e) => handleDocumentUpload(e, 'company_certificate')}
                                  className="hidden"
                                  disabled={uploadingDocument === 'company_certificate'}
                                />
                                <Label
                                  htmlFor="modal-company-certificate"
                                  className={cn(
                                    "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                    themeClasses.cardBorder,
                                    themeClasses.cardBg,
                                    uploadingDocument === 'company_certificate' && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span>{uploadingDocument === 'company_certificate' ? "Uploading..." : companyCertificate ? "Change Certificate" : "Upload Company Certificate"}</span>
                                </Label>
                                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                  PNG, JPG, PDF (max 10MB) - Required for verification
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {/* Winga-specific fields */}
                {isWingaPlan && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="modal-full-legal-name" className={cn(themeClasses.mainText)}>
                        <User className="inline w-4 h-4 mr-2" />
                        Full Legal Name (NIDA Name) * <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Enter your full legal name as it appears on your NIDA card
                      </p>
                      <Input
                        id="modal-full-legal-name"
                        type="text"
                        placeholder="Enter your full legal name"
                        value={companyInfoForm.fullLegalName}
                        onChange={(e) => setCompanyInfoForm({ ...companyInfoForm, fullLegalName: e.target.value })}
                        required
                        className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-tin-or-nida" className={cn(themeClasses.mainText)}>
                        <FileText className="inline w-4 h-4 mr-2" />
                        NIDA Number (Winga Personal Detail) * * <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Important for trust, verification, and priority in search results and orders
                      </p>
                      <Input
                        id="modal-tin-or-nida"
                        type="text"
                        placeholder="Enter your NIDA number"
                        value={companyInfoForm.tinOrNida}
                        onChange={(e) => setCompanyInfoForm({ ...companyInfoForm, tinOrNida: e.target.value })}
                        required
                        className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                      />
                      <div className={cn("mt-2 p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800")}>
                        <p className={cn("text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2")}>
                          <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span><strong>Why this matters for Wingas:</strong> {language === 'sw' 
                            ? 'Kutoa nambari yako ya NIDA huongeza uaminifu wako na kutupa kipaumbele katika matokeo ya utafutaji na usindikaji wa maagizo. Hii husaidia kuthibitisha uhalali wako kama broker/connector. Hii ni bora kwa sababu za kisheria, usalama, na uaminifu.'
                            : 'Providing your NIDA number increases your trust and gives us to priority you in search results and order processing. This helps verify your authenticity as a broker/connector. This is better for legal, security, and trust reasons.'}</span>
                        </p>
                      </div>
                    </div>
                    {/* NIDA Card Photo Upload (Optional) */}
                    <div className="space-y-2">
                      <Label htmlFor="modal-nida-card-photo" className={cn(themeClasses.mainText)}>
                        <IdCard className="inline w-4 h-4 mr-2" />
                        NIDA Card Photo <span className="text-yellow-600 dark:text-yellow-400 text-xs">(Optional - can upload later)</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Upload a clear photo of your NIDA card for verification and comparison purposes
                      </p>
                      <div className={cn("mt-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800")}>
                        <p className={cn("text-xs text-yellow-800 dark:text-yellow-300")}>
                          <strong>⚠️ Important:</strong> {language === 'sw' 
                            ? 'Ingawa sehemu hii ni ya hiari, akaunti yako haiwezi kuamilishwa hadi picha ya kadi ya NIDA itakapopakiwa. Tafadhali ipakie haraka iwezekanavyo ili kukamilisha uamilishaji wa akaunti yako.'
                            : 'While this field is optional, your account cannot be activated until the NIDA card photo is uploaded. Please upload it as soon as possible to complete your account activation.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {nidaCardPhoto ? (
                          <div className="relative flex flex-col items-center gap-2">
                            <Image
                              src={nidaCardPhoto}
                              alt="NIDA Card"
                              width={64}
                              height={64}
                              className={cn("w-16 h-16 object-cover border rounded-md", themeClasses.cardBorder, themeClasses.cardBg)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-1 text-[10px] px-2 h-6"
                              onClick={() => window.open(nidaCardPhoto, '_blank', 'noopener,noreferrer')}
                            >
                              Preview
                            </Button>
                          </div>
                        ) : (
                          <div className={cn("w-16 h-16 border rounded-md flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                            <IdCard className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                          </div>
                        )}
                        <div className="flex-1">
                          {!nidaCardPhoto ? (
                            <>
                              <input
                                type="file"
                                id="modal-nida-card-photo"
                                accept=".png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    const reader = new FileReader()
                                    reader.onload = (event) => {
                                      setNidaCardPhoto(event.target?.result as string)
                                    }
                                    reader.readAsDataURL(file)
                                  }
                                }}
                                className="hidden"
                                disabled={uploadingDocument === 'nida_card'}
                              />
                              <Label
                                htmlFor="modal-nida-card-photo"
                                className={cn(
                                  "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                                  themeClasses.cardBorder,
                                  themeClasses.cardBg,
                                  uploadingDocument === 'nida_card' && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Upload className="h-4 w-4" />
                                <span>{uploadingDocument === 'nida_card' ? "Uploading..." : "Upload NIDA Card Photo"}</span>
                              </Label>
                              <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                                PNG, JPG (max 10MB) - Required for account activation
                              </p>
                            </>
                          ) : (
                            <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                              NIDA card photo is already uploaded.{" "}
                              <button
                                type="button"
                                onClick={() =>
                                  router.push('/supplier/support?subject=Update%20NIDA%20Card%20Photo&category=verification')
                                }
                                className="underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                Please contact support if you need to update it.
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Self Face Photo Upload (Optional) */}
                    <div className="space-y-2">
                      <Label htmlFor="modal-self-face-photo" className={cn(themeClasses.mainText)}>
                        <Camera className="inline w-4 h-4 mr-2" />
                        Self Face Photo <span className="text-yellow-600 dark:text-yellow-400 text-xs">(Optional - can upload later)</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Upload a clear photo of yourself for comparison with your NIDA card photo
                      </p>
                      <div className="flex items-center gap-4">
                        {selfFacePhoto ? (
                          <div className="relative">
                            <Image
                              src={selfFacePhoto}
                              alt="Self Face"
                              width={64}
                              height={64}
                              className={cn("w-16 h-16 object-cover border rounded-full", themeClasses.cardBorder, themeClasses.cardBg)}
                            />
                          </div>
                        ) : (
                          <div className={cn("w-16 h-16 border rounded-full flex items-center justify-center", themeClasses.cardBorder, themeClasses.cardBg)}>
                            <Camera className={cn("w-6 h-6", themeClasses.textNeutralSecondary)} />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            id="modal-self-face-photo"
                            accept=".png,.jpg,.jpeg,.gif,.webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = (event) => {
                                  setSelfFacePhoto(event.target?.result as string)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="hidden"
                            disabled={uploadingDocument === 'self_face'}
                          />
                          <Label
                            htmlFor="modal-self-face-photo"
                            className={cn(
                              "cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-opacity-80 transition-colors text-sm",
                              themeClasses.cardBorder,
                              themeClasses.cardBg,
                              uploadingDocument === 'self_face' && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <Camera className="h-4 w-4" />
                            <span>{uploadingDocument === 'self_face' ? "Uploading..." : selfFacePhoto ? "Change Photo" : "Upload Self Face Photo"}</span>
                          </Label>
                          <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                            PNG, JPG (max 10MB) - Can be uploaded later
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-region" className={cn(themeClasses.mainText)}>
                        <MapPin className="inline w-4 h-4 mr-2" />
                        Region <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Select your business region within Tanzania
                      </p>
                      <Select
                        value={companyInfoForm.region}
                        onValueChange={(value) => setCompanyInfoForm({ ...companyInfoForm, region: value })}
                        required
                      >
                        <SelectTrigger
                          id="modal-region"
                          className={cn(themeClasses.cardBorder, themeClasses.cardBg)}
                        >
                          <SelectValue placeholder="Select your region" />
                        </SelectTrigger>
                        <SelectContent>
                          {TANZANIA_REGIONS.map((region) => (
                            <SelectItem key={region} value={region}>
                              {region}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-nation" className={cn(themeClasses.mainText)}>
                        <Building2Icon className="inline w-4 h-4 mr-2" />
                        Nation <span className="text-red-500">*</span>
                      </Label>
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>
                        Currently only Tanzania is supported
                      </p>
                      <Input
                        id="modal-nation"
                        type="text"
                        value={companyInfoForm.nation}
                        disabled
                        className={cn("bg-gray-100 dark:bg-gray-800", themeClasses.cardBorder, themeClasses.cardBg)}
                        required
                      />
                      <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                        Nation is set to Tanzania by default. Other nations are not available at this time.
                      </p>
                    </div>
                  </>
                )}
                {/* Warning Message - Only show when account is inactive */}
                {isActive === false && (
                  <div className={cn("p-4 rounded-lg border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20", themeClasses.cardBorder)}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className={cn("font-semibold mb-1 text-red-800 dark:text-red-300")}>
                          Important Notice
                        </h4>
                        <p className={cn("text-sm text-red-700 dark:text-red-400")}>
                          Your account will be set to inactive and will be activated after we review and confirm your information. 
                          <strong className="block mt-2">Please ensure all information is correct. Providing incorrect or false information will result in permanent account deletion.</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Declarations Section */}
                <div className={cn("pt-4 border-t space-y-4", themeClasses.cardBorder)}>
                  {/* NIDA Declaration for Winga Plans */}
                  {isWingaPlan && (
                    <div className={cn("p-4 rounded-lg border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="modal-nida-declaration"
                          checked={nidaDeclarationAccepted}
                          onCheckedChange={(checked) => setNidaDeclarationAccepted(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor="modal-nida-declaration" 
                            className={cn("text-sm font-semibold cursor-pointer", themeClasses.mainText)}
                          >
                            Declaration * <span className="text-red-500">*</span>
                          </Label>
                          <p className={cn("text-xs mt-2 leading-relaxed", themeClasses.textNeutralSecondary)}>
                            I hereby declare that:
                          </p>
                          <ul className={cn("text-xs mt-2 ml-4 space-y-1 list-disc", themeClasses.textNeutralSecondary)}>
                            <li>The NIDA card information provided is accurate and belongs to me</li>
                            <li>The self-picture uploaded is a recent and accurate representation of myself</li>
                            <li>I understand that providing false or misleading information will result in account suspension or termination</li>
                            <li>I agree to comply with all applicable laws and regulations regarding identity verification</li>
                            <li>I understand that this information will be used for verification purposes and to build trust with customers</li>
                          </ul>
                          {!nidaDeclarationAccepted && (
                            <p className={cn("text-xs mt-2 text-red-600 dark:text-red-400")}>
                              You must accept this declaration to submit your information
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Certification Declaration for Free and Premium Plans */}
                  {!isWingaPlan && (
                    <div className={cn("p-4 rounded-lg border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="modal-certification-declaration"
                          checked={certificationDeclarationAccepted}
                          onCheckedChange={(checked) => setCertificationDeclarationAccepted(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor="modal-certification-declaration" 
                            className={cn("text-sm font-semibold cursor-pointer", themeClasses.mainText)}
                          >
                            Certification Declaration * <span className="text-red-500">*</span>
                          </Label>
                          <p className={cn("text-xs mt-2 leading-relaxed", themeClasses.textNeutralSecondary)}>
                            I hereby declare that:
                          </p>
                          <ul className={cn("text-xs mt-2 ml-4 space-y-1 list-disc", themeClasses.textNeutralSecondary)}>
                            <li>The business registration certificate provided is authentic and valid</li>
                            <li>All business information provided is accurate and up-to-date</li>
                            <li>I understand that providing false or misleading information will result in account suspension or termination</li>
                            <li>I agree to comply with all applicable laws and regulations regarding business registration</li>
                            <li>I understand that this information will be used for verification purposes and to build trust with customers</li>
                            <li>The uploaded certificate document is a true copy of the original document</li>
                          </ul>
                          {!certificationDeclarationAccepted && (
                            <p className={cn("text-xs mt-2 text-red-600 dark:text-red-400")}>
                              You must accept this declaration to submit your information
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <Button
                  type="submit"
                  disabled={
                    isSubmittingCompanyInfo || 
                    loadingPlan ||
                    !currentPlan ||
                    (isWingaPlan && !nidaDeclarationAccepted) ||
                    (!isWingaPlan && (
                      !certificationDeclarationAccepted ||
                      (companyInfoForm.registrationType === 'business' && !businessTinCertificate) ||
                      (companyInfoForm.registrationType === 'tin' && !businessTinCertificate) ||
                      (companyInfoForm.registrationType === 'company' && !companyCertificate)
                    ))
                  }
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-neutral-950 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingCompanyInfo ? (
                    <>
                      <Save className="mr-2 h-4 w-4 animate-spin" />
                      {isWingaPlan ? 'Inahifadhi...' : t('company.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isWingaPlan ? 'Hifadhi na Endelea' : t('company.saveContinue')}
                    </>
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Page content */}
          <main className={cn("flex-1 overflow-y-auto pt-16 sm:pt-20", shouldShowCompanyInfoModal && "pointer-events-none opacity-50")} suppressHydrationWarning>
            <div className="py-4 sm:py-6" suppressHydrationWarning>
              <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-2" suppressHydrationWarning>
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
    </SupplierRouteGuard>
  )
}



