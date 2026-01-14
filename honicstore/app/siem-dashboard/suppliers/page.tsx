"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabaseClient } from '@/lib/supabase-client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Search,
  Crown,
  Package,
  DollarSign,
  User,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Eye,
  Power,
  PowerOff,
  Trash2,
  AlertTriangle,
  FileText,
  Download,
  Image as ImageIcon,
  IdCard,
  Camera
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SupplierPlan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  term: string
}

interface Supplier {
  id: string
  fullName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  location: string | null
  officeNumber: string | null
  businessRegistrationNumber?: string | null
  registrationType?: string | null
  tinOrNida?: string | null
  region?: string | null
  nation?: string | null
  isSupplier: boolean
  isActive: boolean
  planId: string | null
  plan: SupplierPlan | null
  createdAt: string
  updatedAt: string
  isVerified?: boolean
  detailSentence?: string | null
  rating?: number | null
  reviewCount?: number | null
  companyLogo?: string | null
  businessTinCertificateUrl?: string | null
  companyCertificateUrl?: string | null
  nidaCardFrontUrl?: string | null
  nidaCardRearUrl?: string | null
  selfPictureUrl?: string | null
}

export default function SuppliersPage() {
  const { themeClasses } = useTheme()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isEditingSupplier, setIsEditingSupplier] = useState(false)
  const [editFormData, setEditFormData] = useState({
    isVerified: false,
    detailSentence: '',
    rating: 0,
    reviewCount: 0
  })
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const { toast } = useToast()

  const openDocumentPreview = (url: string) => {
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) {
        // Popup blocked – fall back to storing URL (for potential future inline preview)
        setPreviewDocumentUrl(url)
        setIsPreviewOpen(true)
      }
    } catch (error) {
      toast({
        title: 'Unable to open document',
        description: 'Your browser blocked the new tab. Please check popup settings.',
        variant: 'destructive',
      })
    }
  }

  // Fetch suppliers from API
  const fetchSuppliers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/suppliers', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data = await res.json()
      setSuppliers(data.suppliers || [])
      setFilteredSuppliers(data.suppliers || [])
    } catch (e) {
      setSuppliers([])
      setFilteredSuppliers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  // Real-time subscription for supplier status changes
  useEffect(() => {
    let isMounted = true
    let channel: RealtimeChannel | null = null

    const setupRealtime = async () => {
      if (!isMounted) return

      try {
        // Remove existing channel if any
        if (channel) {
          try {
            supabaseClient.removeChannel(channel)
          } catch (error) {
            }
        }

        channel = supabaseClient
          .channel('admin-suppliers-status-realtime', {
            config: {
              broadcast: { self: true },
            }
          })
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: 'is_supplier=eq.true'
            },
            (payload) => {
              if (!isMounted) return
              
              const updatedProfile = payload.new as any
              const oldProfile = payload.old as any
              
              // Only update if is_active changed
              if (updatedProfile.is_active !== oldProfile.is_active) {
                // Update the supplier in the list
                setSuppliers(prev => 
                  prev.map(supplier => 
                    supplier.id === updatedProfile.id
                      ? { ...supplier, isActive: updatedProfile.is_active !== false }
                      : supplier
                  )
                )
                
                // Update filtered suppliers as well
                setFilteredSuppliers(prev => 
                  prev.map(supplier => 
                    supplier.id === updatedProfile.id
                      ? { ...supplier, isActive: updatedProfile.is_active !== false }
                      : supplier
                  )
                )
                
                // Update selected supplier if it's the one being changed
                setSelectedSupplier(prev => 
                  prev && prev.id === updatedProfile.id
                    ? { ...prev, isActive: updatedProfile.is_active !== false }
                    : prev
                )
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              // Try to reconnect after a delay
              if (isMounted) {
                setTimeout(() => {
                  if (isMounted) {
                    setupRealtime()
                  }
                }, 3000)
              }
            }
          })

      } catch (error) {
        }
    }

    setupRealtime()

    return () => {
      isMounted = false
      if (channel) {
        try {
          supabaseClient.removeChannel(channel)
        } catch (error) {
          }
      }
    }
  }, [])

  // Filter suppliers
  useEffect(() => {
    let filtered = suppliers

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(supplier => 
        (supplier.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.location || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Plan filter
    if (planFilter !== 'all') {
      filtered = filtered.filter(supplier => {
        if (planFilter === 'free') return supplier.plan?.slug === 'free'
        if (planFilter === 'premium') return supplier.plan?.slug === 'premium'
        if (planFilter === 'no-plan') return !supplier.plan
        return true
      })
    }

    setFilteredSuppliers(filtered)
    // Reset to page 1 when filters change
    setCurrentPage(1)
  }, [suppliers, searchTerm, planFilter])

  // Calculate pagination
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex)

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const formatPrice = (price: number, currency: string = 'TZS') => {
    return `${currency} ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPlanBadge = (plan: SupplierPlan | null) => {
    if (!plan) {
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">No Plan</Badge>
    }
    
    if (plan.slug === 'premium') {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <Crown className="w-3 h-3" />
          {plan.name}
        </Badge>
      )
    }
    
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{plan.name}</Badge>
  }

  // Handle supplier actions
  const handleActivate = async () => {
    if (!selectedSupplier) return
    
    setIsActionLoading(true)
    
    // Optimistically update UI immediately
    const updateSupplierStatus = (isActive: boolean) => {
      setSuppliers(prev => 
        prev.map(s => s.id === selectedSupplier.id ? { ...s, isActive } : s)
      )
      setFilteredSuppliers(prev => 
        prev.map(s => s.id === selectedSupplier.id ? { ...s, isActive } : s)
      )
      setSelectedSupplier(prev => prev ? { ...prev, isActive } : null)
    }
    
    // Update optimistically
    updateSupplierStatus(true)
    
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        // Revert optimistic update on error
        updateSupplierStatus(selectedSupplier.isActive)
        throw new Error(data.error || 'Failed to activate supplier')
      }
      
      toast({
        title: 'Success',
        description: 'Supplier activated successfully. Products are now visible.',
      })
      
      // Real-time subscription will handle the update, but refresh as fallback
      await fetchSuppliers()
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate supplier',
        variant: 'destructive'
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!selectedSupplier) return
    
    setIsActionLoading(true)
    
    // Optimistically update UI immediately
    const updateSupplierStatus = (isActive: boolean) => {
      setSuppliers(prev => 
        prev.map(s => s.id === selectedSupplier.id ? { ...s, isActive } : s)
      )
      setFilteredSuppliers(prev => 
        prev.map(s => s.id === selectedSupplier.id ? { ...s, isActive } : s)
      )
      setSelectedSupplier(prev => prev ? { ...prev, isActive } : null)
    }
    
    // Update optimistically
    updateSupplierStatus(false)
    
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        // Revert optimistic update on error
        updateSupplierStatus(selectedSupplier.isActive)
        throw new Error(data.error || 'Failed to deactivate supplier')
      }
      
      toast({
        title: 'Success',
        description: 'Supplier deactivated successfully. Products are now hidden.',
      })
      
      // Real-time subscription will handle the update, but refresh as fallback
      await fetchSuppliers()
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate supplier',
        variant: 'destructive'
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSupplier) return
    
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete supplier')
      }
      
      toast({
        title: 'Success',
        description: 'Supplier account deleted successfully. All products have been hidden.',
      })
      
      // Refresh suppliers list
      await fetchSuppliers()
      setIsDialogOpen(false)
      setDeleteDialogOpen(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete supplier',
        variant: 'destructive'
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle edit supplier info
  const handleEditSupplier = () => {
    if (!selectedSupplier) return
    setIsEditingSupplier(true)
    setEditFormData({
      isVerified: selectedSupplier.isVerified ?? false,
      detailSentence: selectedSupplier.detailSentence ?? '',
      rating: selectedSupplier.rating ?? 0,
      reviewCount: selectedSupplier.reviewCount ?? 0
    })
  }

  const handleSaveSupplierInfo = async () => {
    if (!selectedSupplier) return
    
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          isVerified: editFormData.isVerified,
          detailSentence: editFormData.detailSentence,
          rating: editFormData.rating === 0 ? 0 : (editFormData.rating || null),
          reviewCount: editFormData.reviewCount === 0 ? 0 : (editFormData.reviewCount || null)
        }),
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update supplier info')
      }
      
      toast({
        title: 'Success',
        description: 'Supplier information updated successfully.',
      })
      
      // Refresh suppliers list
      await fetchSuppliers()
      setIsEditingSupplier(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update supplier info',
        variant: 'destructive'
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
              Suppliers Management
            </h1>
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              View and manage all registered suppliers and their plans
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>View:</span>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className={cn("mb-6", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Search Suppliers
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name, email, phone, location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      "pl-10",
                      themeClasses.cardBg,
                      themeClasses.cardBorder,
                      themeClasses.mainText
                    )}
                  />
                </div>
              </div>

              {/* Plan Filter */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Filter by Plan
                </label>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  <option value="all">All Plans</option>
                  <option value="premium">Premium Plan</option>
                  <option value="free">Free Plan</option>
                  <option value="no-plan">No Plan</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Total Suppliers</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{suppliers.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Premium Plans</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                  {suppliers.filter(s => s.plan?.slug === 'premium').length}
                </p>
              </div>
              <Crown className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Free Plans</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                  {suppliers.filter(s => s.plan?.slug === 'free').length}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>No Plan</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                  {suppliers.filter(s => !s.plan).length}
                </p>
              </div>
              <User className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers List */}
      {isLoading ? (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className={cn(themeClasses.textNeutralSecondary)}>Loading suppliers...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredSuppliers.length === 0 ? (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className={cn("text-lg font-medium mb-2", themeClasses.mainText)}>No Suppliers Found</p>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                {searchTerm || planFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'No suppliers have been registered yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {paginatedSuppliers.map((supplier) => (
            <Card key={supplier.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className={cn("text-lg", themeClasses.mainText)}>
                        {supplier.companyName || supplier.fullName || 'Unnamed Supplier'}
                      </CardTitle>
                      <Badge className={
                        supplier.isActive 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {supplier.companyName && supplier.fullName && (
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {supplier.fullName}
                      </p>
                    )}
                  </div>
                  {getPlanBadge(supplier.plan)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Important Contact Information Only */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {supplier.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {supplier.email}
                          </span>
                        </div>
                      )}
                      
                      {supplier.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {supplier.phone}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* View Detail Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSupplier(supplier)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedSuppliers.map((supplier) => (
            <Card key={supplier.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>
                            {supplier.companyName || supplier.fullName || 'Unnamed Supplier'}
                          </h3>
                          <Badge className={
                            supplier.isActive 
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }>
                            {supplier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {supplier.companyName && supplier.fullName && (
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {supplier.fullName}
                          </p>
                        )}
                      </div>
                      {getPlanBadge(supplier.plan)}
                    </div>
                    
                    {/* Important Info Only */}
                    <div className="flex items-start justify-between gap-4 pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        {supplier.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {supplier.email}
                            </span>
                          </div>
                        )}
                        
                        {supplier.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {supplier.phone}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* View Detail Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSupplier(supplier)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredSuppliers.length > itemsPerPage && (
        <Card className={cn("mt-6", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Showing {startIndex + 1} to {Math.min(endIndex, filteredSuppliers.length)} of {filteredSuppliers.length} suppliers
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={cn(
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 7) {
                      pageNum = i + 1
                    } else if (currentPage <= 4) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i
                    } else {
                      pageNum = currentPage - 3 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className={cn(
                          currentPage === pageNum 
                            ? '' 
                            : themeClasses.cardBg + ' ' + themeClasses.cardBorder,
                          themeClasses.mainText,
                          "min-w-[2.5rem]"
                        )}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={cn(
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplier Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn("max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl bg-white dark:bg-neutral-900", themeClasses.cardBorder)}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", themeClasses.mainText)}>
              <Building2 className="w-5 h-5" />
              Supplier Details
            </DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              Complete supplier information and plan details
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <div className="space-y-6">
              {/* Supplier Header */}
              <div className="flex items-start justify-between pb-4 border-b">
                <div>
                  <h3 className={cn("text-2xl font-bold mb-1", themeClasses.mainText)}>
                    {selectedSupplier.companyName || selectedSupplier.fullName || 'Unnamed Supplier'}
                  </h3>
                  {selectedSupplier.companyName && selectedSupplier.fullName && (
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      {selectedSupplier.fullName}
                    </p>
                  )}
                </div>
                {getPlanBadge(selectedSupplier.plan)}
              </div>

              {/* Contact Information */}
              <div>
                <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedSupplier.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Email</p>
                        <p className={cn("text-sm", themeClasses.mainText)}>{selectedSupplier.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedSupplier.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Phone</p>
                        <p className={cn("text-sm", themeClasses.mainText)}>{selectedSupplier.phone}</p>
                      </div>
                    </div>
                  )}

                  {selectedSupplier.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Location</p>
                        <p className={cn("text-sm", themeClasses.mainText)}>{selectedSupplier.location}</p>
                      </div>
                    </div>
                  )}

                  {selectedSupplier.officeNumber && (
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Office Number</p>
                        <p className={cn("text-sm", themeClasses.mainText)}>{selectedSupplier.officeNumber}</p>
                      </div>
                    </div>
                  )}

                  {selectedSupplier.region && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Region</p>
                        <p className={cn("text-sm", themeClasses.mainText)}>{selectedSupplier.region}</p>
                      </div>
                    </div>
                  )}

                  {selectedSupplier.nation && (
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Nation</p>
                        <p className={cn("text-sm", themeClasses.mainText)}>{selectedSupplier.nation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Registration Information */}
              {(selectedSupplier.registrationType || selectedSupplier.businessRegistrationNumber || selectedSupplier.tinOrNida) && (
                <div className="pt-4 border-t">
                  <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Registration Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedSupplier.registrationType && (
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Registration Type</p>
                          <p className={cn("text-sm font-semibold", themeClasses.mainText)}>
                            {selectedSupplier.registrationType === 'tin' && 'TIN Number'}
                            {selectedSupplier.registrationType === 'business_registration' && 'Business Registration Number'}
                            {selectedSupplier.registrationType === 'company_registration' && 'Company Registration Number'}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedSupplier.businessRegistrationNumber && (
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>
                            {selectedSupplier.registrationType === 'tin' && 'TIN Number'}
                            {selectedSupplier.registrationType === 'business_registration' && 'Business Registration Number'}
                            {selectedSupplier.registrationType === 'company_registration' && 'Company Registration Number'}
                            {!selectedSupplier.registrationType && 'Registration Number'}
                          </p>
                          <p className={cn("text-sm font-mono", themeClasses.mainText)}>{selectedSupplier.businessRegistrationNumber}</p>
                        </div>
                      </div>
                    )}

                    {selectedSupplier.tinOrNida && (
                      <div className="flex items-start gap-3">
                        <IdCard className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>TIN/NIDA Number</p>
                          <p className={cn("text-sm font-mono", themeClasses.mainText)}>{selectedSupplier.tinOrNida}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company Logo */}
              {selectedSupplier.companyLogo && (
                <div className="pt-4 border-t">
                  <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Company Logo</h4>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Image
                        src={selectedSupplier.companyLogo}
                        alt="Company Logo"
                        width={120}
                        height={120}
                        className="w-30 h-30 object-contain border rounded-md"
                      />
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDocumentPreview(selectedSupplier.companyLogo!)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Full Size
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploaded Documents - Free/Premium Plans */}
              {(selectedSupplier.businessTinCertificateUrl || selectedSupplier.companyCertificateUrl) && (
                <div className="pt-4 border-t">
                  <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Business Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedSupplier.businessTinCertificateUrl && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-500" />
                          <p className={cn("text-sm font-semibold", themeClasses.mainText)}>Business TIN Certificate</p>
                        </div>
                        <div className="mb-3">
                          {selectedSupplier.businessTinCertificateUrl.includes('.pdf') || selectedSupplier.businessTinCertificateUrl.includes('application/pdf') ? (
                            <div className="w-full h-32 border rounded-md flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                              <FileText className="w-12 h-12 text-gray-400" />
                            </div>
                          ) : (
                            <div className="relative w-full h-32 border rounded-md overflow-hidden">
                              <Image
                                src={selectedSupplier.businessTinCertificateUrl}
                                alt="TIN Certificate"
                                fill
                                className="object-contain"
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDocumentPreview(selectedSupplier.businessTinCertificateUrl!)}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          View/Download
                        </Button>
                      </div>
                    )}

                    {selectedSupplier.companyCertificateUrl && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-green-500" />
                          <p className={cn("text-sm font-semibold", themeClasses.mainText)}>
                            {selectedSupplier.registrationType === 'business_registration' 
                              ? 'Business Registration Certificate'
                              : 'Company Registration Certificate'}
                          </p>
                        </div>
                        <div className="mb-3">
                          {selectedSupplier.companyCertificateUrl.includes('.pdf') || selectedSupplier.companyCertificateUrl.includes('application/pdf') ? (
                            <div className="w-full h-32 border rounded-md flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                              <FileText className="w-12 h-12 text-gray-400" />
                            </div>
                          ) : (
                            <div className="relative w-full h-32 border rounded-md overflow-hidden">
                              <Image
                                src={selectedSupplier.companyCertificateUrl}
                                alt="Company Certificate"
                                fill
                                className="object-contain"
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDocumentPreview(selectedSupplier.companyCertificateUrl!)}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          View/Download
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Uploaded Documents - Winga Plan */}
              {(selectedSupplier.nidaCardFrontUrl || selectedSupplier.nidaCardRearUrl || selectedSupplier.selfPictureUrl) && (
                <div className="pt-4 border-t">
                  <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Identity Documents (Winga Plan)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedSupplier.nidaCardFrontUrl && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <IdCard className="w-5 h-5 text-purple-500" />
                          <p className={cn("text-sm font-semibold", themeClasses.mainText)}>NIDA Card - Front</p>
                        </div>
                        <div className="mb-3">
                          <div className="relative w-full h-32 border rounded-md overflow-hidden">
                            <Image
                              src={selectedSupplier.nidaCardFrontUrl}
                              alt="NIDA Card Front"
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDocumentPreview(selectedSupplier.nidaCardFrontUrl!)}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          View/Download
                        </Button>
                      </div>
                    )}

                    {selectedSupplier.nidaCardRearUrl && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <IdCard className="w-5 h-5 text-purple-500" />
                          <p className={cn("text-sm font-semibold", themeClasses.mainText)}>NIDA Card - Rear</p>
                        </div>
                        <div className="mb-3">
                          <div className="relative w-full h-32 border rounded-md overflow-hidden">
                            <Image
                              src={selectedSupplier.nidaCardRearUrl}
                              alt="NIDA Card Rear"
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDocumentPreview(selectedSupplier.nidaCardRearUrl!)}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          View/Download
                        </Button>
                      </div>
                    )}

                    {selectedSupplier.selfPictureUrl && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Camera className="w-5 h-5 text-orange-500" />
                          <p className={cn("text-sm font-semibold", themeClasses.mainText)}>Self Picture</p>
                        </div>
                        <div className="mb-3">
                          <div className="relative w-full h-32 border rounded-md rounded-full overflow-hidden">
                            <Image
                              src={selectedSupplier.selfPictureUrl}
                              alt="Self Picture"
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDocumentPreview(selectedSupplier.selfPictureUrl!)}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          View/Download
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Plan Information */}
              {selectedSupplier.plan && (
                <div className="pt-4 border-t">
                  <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Plan Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Plan Name</p>
                      <p className={cn("text-sm font-semibold", themeClasses.mainText)}>{selectedSupplier.plan.name}</p>
                    </div>
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Price</p>
                      <p className={cn("text-sm font-semibold", themeClasses.mainText)}>
                        {formatPrice(selectedSupplier.plan.price, selectedSupplier.plan.currency)}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Billing Term</p>
                      <p className={cn("text-sm font-semibold", themeClasses.mainText)}>
                        {selectedSupplier.plan.term === 'month' ? 'Monthly' : 'Yearly'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      <strong>Full Plan:</strong> {formatPrice(selectedSupplier.plan.price, selectedSupplier.plan.currency)}/{selectedSupplier.plan.term}
                    </p>
                  </div>
                </div>
              )}

              {!selectedSupplier.plan && (
                <div className="pt-4 border-t">
                  <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Plan Information</h4>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      No plan assigned to this supplier.
                    </p>
                  </div>
                </div>
              )}

              {/* Account Information */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h4 className={cn("text-lg font-semibold", themeClasses.mainText)}>Account Information</h4>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        Reset Account Info
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md border-2 border-red-500/70 bg-red-50 dark:bg-red-950 shadow-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-800 dark:text-red-200">
                          Dangerous Action: Reset Supplier Account Info
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs sm:text-sm text-red-800/90 dark:text-red-200/90 mt-1">
                          This will clear the supplier&apos;s verified business information (company name, location,
                          registration type &amp; number, region, nation, logo, and certificate URLs) and mark the
                          account as inactive. The supplier will need to submit their information again for review.
                          <br />
                          Make sure you have confirmed this request with the supplier (e.g. via phone) before
                          continuing.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isActionLoading}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isActionLoading}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={async () => {
                            if (!selectedSupplier) return
                            try {
                              setIsActionLoading(true)
                              const response = await fetch(`/api/admin/suppliers/${selectedSupplier.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ action: 'reset_account_info' }),
                              })
                              const data = await response.json()
                              if (!response.ok) {
                                throw new Error(data.error || 'Failed to reset account info')
                              }
                              // Refresh suppliers list
                              await fetchSuppliers()
                              toast({
                                title: 'Account Info Reset',
                                description:
                                  'Supplier account info has been cleared. They will need to resubmit their details.',
                              })
                            } catch (error: any) {
                              toast({
                                title: 'Error',
                                description: error.message || 'Failed to reset account info.',
                                variant: 'destructive',
                              })
                            } finally {
                              setIsActionLoading(false)
                            }
                          }}
                        >
                          {isActionLoading ? 'Resetting...' : 'Confirm Reset'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Supplier ID</p>
                      <p className={cn("text-sm font-mono", themeClasses.mainText)}>{selectedSupplier.id}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Registered</p>
                      <p className={cn("text-sm", themeClasses.mainText)}>{formatDate(selectedSupplier.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Last Updated</p>
                      <p className={cn("text-sm", themeClasses.mainText)}>{formatDate(selectedSupplier.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={cn("text-xs font-medium mb-1", themeClasses.textNeutralSecondary)}>Status</p>
                      <Badge className={
                        selectedSupplier.isSupplier && selectedSupplier.isActive 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }>
                        {selectedSupplier.isSupplier && selectedSupplier.isActive ? 'Active Supplier' : 'Inactive/Deactivated'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seller Information Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h4 className={cn("text-lg font-semibold", themeClasses.mainText)}>Seller Information</h4>
                  {!isEditingSupplier && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditSupplier}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingSupplier ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isVerified"
                        checked={editFormData.isVerified}
                        onCheckedChange={(checked) => 
                          setEditFormData({ ...editFormData, isVerified: checked === true })
                        }
                      />
                      <Label htmlFor="isVerified" className={cn("text-sm font-medium", themeClasses.mainText)}>
                        Verified Seller
                      </Label>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="detailSentence" className={cn("text-sm font-medium", themeClasses.mainText)}>
                        Detail Sentence (4 words max)
                      </Label>
                      <Textarea
                        id="detailSentence"
                        value={editFormData.detailSentence}
                        onChange={(e) => setEditFormData({ ...editFormData, detailSentence: e.target.value })}
                        placeholder="e.g., Trusted quality products supplier"
                        maxLength={50}
                        className={cn(themeClasses.cardBg, themeClasses.cardBorder)}
                        rows={2}
                      />
                      <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                        {editFormData.detailSentence.length}/50 characters
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rating" className={cn("text-sm font-medium", themeClasses.mainText)}>
                          Rating (0-5, optional)
                        </Label>
                        <Input
                          id="rating"
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={editFormData.rating || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditFormData({ ...editFormData, rating: val === '' ? 0 : parseFloat(val) || 0 })
                          }}
                          placeholder="0.0"
                          className={cn(themeClasses.cardBg, themeClasses.cardBorder)}
                        />
                        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                          Leave empty or set to 0 to remove rating
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reviewCount" className={cn("text-sm font-medium", themeClasses.mainText)}>
                          Review Count (optional)
                        </Label>
                        <Input
                          id="reviewCount"
                          type="number"
                          min="0"
                          value={editFormData.reviewCount || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditFormData({ ...editFormData, reviewCount: val === '' ? 0 : parseInt(val) || 0 })
                          }}
                          placeholder="0"
                          className={cn(themeClasses.cardBg, themeClasses.cardBorder)}
                        />
                        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                          Leave empty or set to 0 to remove review count
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveSupplierInfo}
                        disabled={isActionLoading}
                        className="flex items-center gap-2"
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingSupplier(false)
                          if (selectedSupplier) {
                            setEditFormData({
                              isVerified: selectedSupplier.isVerified || false,
                              detailSentence: selectedSupplier.detailSentence || '',
                              rating: selectedSupplier.rating || 0,
                              reviewCount: selectedSupplier.reviewCount || 0
                            })
                          }
                        }}
                        disabled={isActionLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>Verified:</span>
                      <Badge className={
                        selectedSupplier.isVerified
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }>
                        {selectedSupplier.isVerified ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {selectedSupplier.detailSentence && (
                      <div>
                        <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>Detail:</span>
                        <p className={cn("text-sm mt-1", themeClasses.mainText)}>{selectedSupplier.detailSentence}</p>
                      </div>
                    )}
                    {selectedSupplier.rating && (
                      <div className="flex items-center gap-4">
                        <div>
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>Rating:</span>
                          <span className={cn("text-sm font-semibold ml-2", themeClasses.mainText)}>
                            {selectedSupplier.rating} ({selectedSupplier.reviewCount || 0} reviews)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t">
                <h4 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Actions</h4>
                <div className="flex flex-wrap gap-3">
                  {selectedSupplier.isActive ? (
                    <Button
                      variant="outline"
                      onClick={handleDeactivate}
                      disabled={isActionLoading}
                      className="flex items-center gap-2"
                    >
                      <PowerOff className="w-4 h-4" />
                      Deactivate Account
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleActivate}
                      disabled={isActionLoading}
                      className="flex items-center gap-2"
                    >
                      <Power className="w-4 h-4" />
                      Activate Account
                    </Button>
                  )}
                  
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isActionLoading}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </Button>
                </div>
                <p className={cn("text-xs mt-3", themeClasses.textNeutralSecondary)}>
                  {selectedSupplier.isActive 
                    ? 'Deactivating will hide all products from this supplier.' 
                    : 'Activating will make all products from this supplier visible again.'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Supplier Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the supplier account for <strong>{selectedSupplier?.companyName || selectedSupplier?.fullName || 'this supplier'}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove supplier status from the account</li>
                <li>Hide all products from this supplier</li>
                <li>This action cannot be undone</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isActionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isActionLoading ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Preview Dialog (fallback if popup blocked) */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className={cn(themeClasses.mainText)}>Document Preview</DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              We tried to open this document in a new tab, but your browser blocked the popup.
              Please allow popups for this site or click the button below.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                if (previewDocumentUrl) {
                  window.open(previewDocumentUrl, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              <Download className="w-4 h-4" />
              <span>Open document in new tab</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


