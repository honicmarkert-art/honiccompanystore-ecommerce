'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar as CalendarIcon,
  DollarSign,
  RefreshCw,
  ArrowLeft,
  Filter,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoice_number: string
  reference_id: string
  transaction_id: string
  plan_name: string
  plan_slug: string
  amount: number
  currency: string
  status: string
  payment_date: string | null
  created_at: string
  updated_at: string | null
  expires_at: string | null
  failure_reason: string | null
  payment_method: string
}

interface BillingSummary {
  total_invoices: number
  total_paid: number
  total_failed: number
  total_failed_invoices: number
  currency: string
}

function InvoicesContent() {
  const router = useRouter()
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null)
  
  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string>('all') // 'all', 'paid', 'failed', 'pending'
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/supplier/billing', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error('Server returned an invalid response. Please try again.')
      }

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch billing data')
      }

      const fetchedInvoices = data.invoices || []
      setAllInvoices(fetchedInvoices)
      setInvoices(fetchedInvoices)
      setSummary(data.summary || null)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load billing history'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      setDownloadingInvoice(invoice.id)
      
      // Generate invoice PDF or download
      // For now, we'll create a simple text-based invoice
      const invoiceContent = generateInvoiceContent(invoice)
      
      // Create a blob and download
      const blob = new Blob([invoiceContent], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Invoice Downloaded',
        description: `Invoice ${invoice.invoice_number} has been downloaded.`,
      })
    } catch (err: any) {
      toast({
        title: 'Download Error',
        description: 'Failed to download invoice. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setDownloadingInvoice(null)
    }
  }

  const generateInvoiceContent = (invoice: Invoice): string => {
    const date = invoice.payment_date 
      ? new Date(invoice.payment_date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : new Date(invoice.created_at).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })

    return `
INVOICE
${invoice.invoice_number}

Date: ${date}
Status: ${invoice.status.toUpperCase()}

BILL TO:
${user?.name || user?.email || 'Supplier'}
${user?.email || ''}

PLAN DETAILS:
Plan: ${invoice.plan_name}
Amount: ${formatPrice(invoice.amount, invoice.currency)}
Currency: ${invoice.currency}

PAYMENT INFORMATION:
Transaction ID: ${invoice.transaction_id}
Reference ID: ${invoice.reference_id}
Payment Method: ${invoice.payment_method.toUpperCase()}
Payment Date: ${date}

${invoice.expires_at ? `Expires: ${new Date(invoice.expires_at).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}` : ''}

${invoice.failure_reason && (invoice.status === 'failed' || invoice.status === 'cancelled') ? `Failure Reason: ${invoice.failure_reason}` : ''}

---
This is an automated invoice generated by the system.
For support, please contact customer service.
    `.trim()
  }

  // Filter invoices based on date range and status
  useEffect(() => {
    let filtered = [...allInvoices]

    // Filter by date range
    if (dateFrom || dateTo) {
      filtered = filtered.filter((invoice) => {
        const invoiceDate = invoice.payment_date 
          ? new Date(invoice.payment_date)
          : new Date(invoice.created_at)
        
        if (dateFrom && invoiceDate < dateFrom) return false
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999) // Include the entire end date
          if (invoiceDate > toDate) return false
        }
        return true
      })
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((invoice) => {
        const statusLower = invoice.status.toLowerCase()
        if (statusFilter === 'paid') {
          return statusLower === 'paid' || statusLower === 'success'
        } else if (statusFilter === 'failed') {
          return statusLower === 'failed' || statusLower === 'cancelled'
        } else if (statusFilter === 'pending') {
          return statusLower === 'pending'
        }
        return true
      })
    }

    setInvoices(filtered)

    // Update summary based on filtered invoices
    const filteredTotalPaid = filtered
      .filter(inv => inv.status.toLowerCase() === 'paid' || inv.status.toLowerCase() === 'success')
      .reduce((sum, inv) => sum + inv.amount, 0)
    
    const filteredTotalFailed = filtered
      .filter(inv => inv.status.toLowerCase() === 'failed' || inv.status.toLowerCase() === 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0)

    setSummary(prevSummary => prevSummary ? {
      ...prevSummary,
      total_invoices: filtered.length,
      total_paid: filteredTotalPaid,
      total_failed: filteredTotalFailed
    } : null)

    // Reset to page 1 when filters change
    setCurrentPage(1)
  }, [allInvoices, dateFrom, dateTo, statusFilter])

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setStatusFilter('all')
    setCurrentPage(1)
  }

  const hasActiveFilters = dateFrom || dateTo || statusFilter !== 'all'

  // Pagination calculations
  const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedInvoices = invoices.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'paid' || statusLower === 'success') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      )
    } else if (statusLower === 'failed' || statusLower === 'cancelled') {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <div className={cn("min-h-screen p-4 md:p-8", themeClasses.bg)}>
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen p-3 sm:p-4 md:p-6 lg:p-8", themeClasses.bg)}>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className={cn("text-2xl sm:text-3xl font-bold mb-1 sm:mb-2", themeClasses.mainText)}>
              Invoices & Billing
            </h1>
            <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              View and download your payment invoices and billing history
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              onClick={fetchBillingData}
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4 text-[10px] sm:text-xs lg:text-sm"
            >
              <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 mr-1 sm:mr-1.5 lg:mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => router.push('/supplier/dashboard')}
              variant="outline"
              size="sm"
              className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards - Mobile Grid View */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "shadow-sm")}>
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4 lg:p-6">
                <CardTitle className={cn("text-[10px] sm:text-xs lg:text-sm font-medium", themeClasses.textNeutralSecondary)}>
                  Total Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold">{summary.total_invoices}</div>
              </CardContent>
            </Card>
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "shadow-sm")}>
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4 lg:p-6">
                <CardTitle className={cn("text-[10px] sm:text-xs lg:text-sm font-medium", themeClasses.textNeutralSecondary)}>
                  Total Paid
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className={cn("text-lg sm:text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400", themeClasses.mainText)}>
                  {formatPrice(summary.total_paid, summary.currency)}
                </div>
              </CardContent>
            </Card>
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "shadow-sm")}>
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4 lg:p-6">
                <CardTitle className={cn("text-[10px] sm:text-xs lg:text-sm font-medium", themeClasses.textNeutralSecondary)}>
                  Total Failed
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className={cn("text-lg sm:text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400", themeClasses.mainText)}>
                  {formatPrice(summary.total_failed, summary.currency)}
                </div>
              </CardContent>
            </Card>
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "shadow-sm")}>
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4 lg:p-6">
                <CardTitle className={cn("text-[10px] sm:text-xs lg:text-sm font-medium", themeClasses.textNeutralSecondary)}>
                  Failed Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className={cn("text-lg sm:text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400", themeClasses.mainText)}>
                  {summary.total_failed_invoices || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters - Mobile Optimized */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "shadow-sm")}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className={cn("flex items-center gap-2 text-base sm:text-lg", themeClasses.mainText)}>
              <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
              Filters
            </CardTitle>
            <CardDescription className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              Filter invoices by date range and status
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Date From */}
              <div>
                <Label className={cn("text-xs sm:text-sm mb-1.5 sm:mb-2 block", themeClasses.textNeutralSecondary)}>
                  From Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9 sm:h-10 text-xs sm:text-sm",
                        !dateFrom && "text-muted-foreground",
                        themeClasses.cardBg,
                        themeClasses.cardBorder
                      )}
                    >
                      <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{dateFrom ? format(dateFrom, "PPP") : "Pick a date"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div>
                <Label className={cn("text-xs sm:text-sm mb-1.5 sm:mb-2 block", themeClasses.textNeutralSecondary)}>
                  To Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9 sm:h-10 text-xs sm:text-sm",
                        !dateTo && "text-muted-foreground",
                        themeClasses.cardBg,
                        themeClasses.cardBorder
                      )}
                    >
                      <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{dateTo ? format(dateTo, "PPP") : "Pick a date"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status Filter */}
              <div>
                <Label className={cn("text-xs sm:text-sm mb-1.5 sm:mb-2 block", themeClasses.textNeutralSecondary)}>
                  Status
                </Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    "w-full h-9 sm:h-10 px-3 rounded-md border text-xs sm:text-sm",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText,
                    "focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  )}
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className={cn(
                    "w-full h-9 sm:h-10 text-xs sm:text-sm",
                    !hasActiveFilters && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!hasActiveFilters}
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className={cn("mt-3 sm:mt-4 text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                Showing {invoices.length} of {allInvoices.length} invoices
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices List - Mobile Optimized */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "shadow-sm")}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className={cn("text-base sm:text-lg", themeClasses.mainText)}>Payment History</CardTitle>
            <CardDescription className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              All your payment transactions and invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {invoices.length === 0 ? (
              <div className={cn("text-center py-8 sm:py-12", themeClasses.textNeutralSecondary)}>
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-base sm:text-lg font-medium mb-1 sm:mb-2">No invoices found</p>
                <p className="text-xs sm:text-sm mb-4 sm:mb-0">You haven't made any payments yet.</p>
                <Button
                  onClick={async () => {
                    try {
                      // Fetch premium plan
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
                      
                      // Initiate upgrade to get referenceId
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
                      
                      // Redirect to payment page
                      router.push(`/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`)
                    } catch (error: any) {
                      toast({
                        title: 'Error',
                        description: error.message || 'Failed to initiate upgrade. Please try again.',
                        variant: 'destructive'
                      })
                    }
                  }}
                  className="mt-4 h-9 sm:h-10 text-xs sm:text-sm px-4 sm:px-6"
                >
                  Upgrade Plan
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:space-y-4">
                  {paginatedInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={cn(
                      "p-3 sm:p-4 rounded-lg border",
                      themeClasses.cardBorder,
                      themeClasses.cardBg,
                      "hover:shadow-md transition-shadow"
                    )}
                  >
                    {/* Mobile: Stacked Layout, Desktop: Horizontal */}
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Header Row - Invoice Number, Plan, Status */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                          <FileText className={cn("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5", themeClasses.textNeutralSecondary)} />
                          <div className="flex-1 min-w-0">
                            <h3 className={cn("font-semibold text-sm sm:text-base mb-0.5 sm:mb-1 truncate", themeClasses.mainText)}>
                              {invoice.invoice_number}
                            </h3>
                            <p className={cn("text-xs sm:text-sm truncate", themeClasses.textNeutralSecondary)}>
                              {invoice.plan_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(invoice.status)}
                        </div>
                      </div>
                      
                      {/* Details Grid - Mobile: 2 columns, Desktop: 4 columns */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <p className={cn("text-[10px] sm:text-xs mb-0.5 sm:mb-1", themeClasses.textNeutralSecondary)}>Amount</p>
                          <p className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                            {formatPrice(invoice.amount, invoice.currency)}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-[10px] sm:text-xs mb-0.5 sm:mb-1", themeClasses.textNeutralSecondary)}>Date</p>
                          <p className={cn("font-medium text-xs sm:text-sm", themeClasses.mainText)}>
                            {invoice.payment_date 
                              ? new Date(invoice.payment_date).toLocaleDateString()
                              : new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <p className={cn("text-[10px] sm:text-xs mb-0.5 sm:mb-1", themeClasses.textNeutralSecondary)}>Transaction ID</p>
                          <p className={cn("font-mono text-[10px] sm:text-xs break-all", themeClasses.mainText)}>
                            {invoice.transaction_id.substring(0, 12)}...
                          </p>
                        </div>
                        {invoice.expires_at && (
                          <div className="col-span-2 sm:col-span-1">
                            <p className={cn("text-[10px] sm:text-xs mb-0.5 sm:mb-1", themeClasses.textNeutralSecondary)}>Expires</p>
                            <p className={cn("font-medium text-xs sm:text-sm", themeClasses.mainText)}>
                              {new Date(invoice.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Failure Reason Alert - Only show for failed/cancelled payments */}
                      {invoice.failure_reason && (invoice.status === 'failed' || invoice.status === 'cancelled') && (
                        <Alert variant="destructive" className="mt-2 sm:mt-3 py-2 sm:py-3">
                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <AlertDescription className="text-[10px] sm:text-xs">
                            {invoice.failure_reason}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Action Buttons - Full width on mobile */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-gray-200 dark:border-gray-700">
                        <Button
                          onClick={() => handleDownloadInvoice(invoice)}
                          disabled={downloadingInvoice === invoice.id}
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                        >
                          {downloadingInvoice === invoice.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                              <span className="hidden sm:inline">Downloading...</span>
                              <span className="sm:hidden">Downloading</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                              Download
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setSelectedInvoice(invoice)}
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>

                {/* Pagination - Mobile Optimized */}
                {totalPages > 1 && (
                  <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mt-4 sm:mt-6 pt-4 border-t", themeClasses.cardBorder)}>
                    <p className={cn("text-xs sm:text-sm text-center sm:text-left", themeClasses.textNeutralSecondary)}>
                      Showing {startIndex + 1} to {Math.min(endIndex, invoices.length)} of {invoices.length} invoices
                    </p>
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className={cn("h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm", themeClasses.cardBg, themeClasses.cardBorder)}
                      >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </Button>
                      
                      {/* Page Numbers - Hide on very small screens, show dots */}
                      <div className="hidden xs:flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum: number
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => goToPage(pageNum)}
                              className={cn(
                                "h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm min-w-[2rem] sm:min-w-[2.5rem]",
                                currentPage === pageNum 
                                  ? '' 
                                  : themeClasses.cardBg + ' ' + themeClasses.cardBorder,
                                themeClasses.mainText
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
                        className={cn("h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm", themeClasses.cardBg, themeClasses.cardBorder)}
                      >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">Next</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Invoice Detail Modal - Mobile Optimized */}
        {selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
            <Card className={cn("max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto", themeClasses.cardBg, themeClasses.cardBorder, "shadow-xl")}>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className={cn("text-base sm:text-lg", themeClasses.mainText)}>
                    Invoice Details
                  </CardTitle>
                  <Button
                    onClick={() => setSelectedInvoice(null)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
                <CardDescription className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                  {selectedInvoice.invoice_number}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Plan</p>
                    <p className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>{selectedInvoice.plan_name}</p>
                  </div>
                  <div>
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Status</p>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <div>
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Amount</p>
                    <p className={cn("font-semibold text-base sm:text-lg", themeClasses.mainText)}>
                      {formatPrice(selectedInvoice.amount, selectedInvoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Payment Date</p>
                    <p className={cn("font-medium text-xs sm:text-sm", themeClasses.mainText)}>
                      {selectedInvoice.payment_date 
                        ? new Date(selectedInvoice.payment_date).toLocaleString()
                        : new Date(selectedInvoice.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Transaction ID</p>
                    <p className={cn("font-mono text-[10px] sm:text-xs break-all", themeClasses.mainText)}>
                      {selectedInvoice.transaction_id}
                    </p>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Reference ID</p>
                    <p className={cn("font-mono text-[10px] sm:text-xs break-all", themeClasses.mainText)}>
                      {selectedInvoice.reference_id}
                    </p>
                  </div>
                  {selectedInvoice.expires_at && (
                    <div>
                      <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Expires At</p>
                      <p className={cn("font-medium text-xs sm:text-sm", themeClasses.mainText)}>
                        {new Date(selectedInvoice.expires_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Payment Method</p>
                    <p className={cn("font-medium text-xs sm:text-sm", themeClasses.mainText)}>
                      {selectedInvoice.payment_method.toUpperCase()}
                    </p>
                  </div>
                </div>

                {selectedInvoice.failure_reason && (selectedInvoice.status === 'failed' || selectedInvoice.status === 'cancelled') && (
                  <Alert variant="destructive" className="py-2 sm:py-3">
                    <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <AlertDescription className="text-xs sm:text-sm">
                      <strong>Failure Reason:</strong> {selectedInvoice.failure_reason}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4">
                  <Button
                    onClick={() => handleDownloadInvoice(selectedInvoice)}
                    disabled={downloadingInvoice === selectedInvoice.id}
                    className="flex-1 sm:flex-none h-10 sm:h-11 text-xs sm:text-sm"
                  >
                    {downloadingInvoice === selectedInvoice.id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                        <span className="hidden sm:inline">Downloading...</span>
                        <span className="sm:hidden">Downloading</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        <span className="hidden sm:inline">Download Invoice</span>
                        <span className="sm:hidden">Download</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setSelectedInvoice(null)}
                    variant="outline"
                    className="flex-1 sm:flex-none h-10 sm:h-11 text-xs sm:text-sm"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SupplierInvoicesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invoices...</p>
        </div>
      </div>
    }>
      <InvoicesContent />
    </Suspense>
  )
}

