"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { 
  DollarSign, 
  Search,
  Building2,
  CreditCard,
  Smartphone,
  Mail,
  Eye,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Banknote,
  Filter,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SupplierInfo {
  id: string
  full_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  is_active: boolean
}

interface PayoutAccount {
  id: string
  supplier_id: string
  account_type: 'bank' | 'mobile_money' | 'paypal'
  account_name: string
  account_number?: string | null
  bank_name?: string | null
  mobile_provider?: string | null
  mobile_number?: string | null
  paypal_email?: string | null
  is_default: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
  supplier?: SupplierInfo
}

export default function PayoutAccountsPage() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<PayoutAccount[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<PayoutAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all')
  const [selectedAccount, setSelectedAccount] = useState<PayoutAccount | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Fetch payout accounts from API
  const fetchAccounts = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/payout-accounts', {
        cache: 'no-store',
        credentials: 'include'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch payout accounts')
      }
      const data = await res.json()
      setAccounts(data.accounts || [])
      setFilteredAccounts(data.accounts || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch payout accounts',
        variant: 'destructive'
      })
      setAccounts([])
      setFilteredAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  // Filter accounts based on search and filters
  useEffect(() => {
    let filtered = [...accounts]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(account => 
        account.account_name.toLowerCase().includes(term) ||
        account.supplier?.company_name?.toLowerCase().includes(term) ||
        account.supplier?.full_name?.toLowerCase().includes(term) ||
        account.supplier?.email?.toLowerCase().includes(term) ||
        account.bank_name?.toLowerCase().includes(term) ||
        account.account_number?.toLowerCase().includes(term) ||
        account.mobile_number?.toLowerCase().includes(term) ||
        account.paypal_email?.toLowerCase().includes(term)
      )
    }

    // Account type filter
    if (accountTypeFilter !== 'all') {
      filtered = filtered.filter(account => account.account_type === accountTypeFilter)
    }

    setFilteredAccounts(filtered)
  }, [searchTerm, accountTypeFilter, accounts])

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Banknote className="w-5 h-5" />
      case 'mobile_money':
        return <Smartphone className="w-5 h-5" />
      case 'paypal':
        return <CreditCard className="w-5 h-5" />
      default:
        return <DollarSign className="w-5 h-5" />
    }
  }

  const getAccountTypeBadge = (type: string) => {
    switch (type) {
      case 'bank':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Bank</Badge>
      case 'mobile_money':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">Mobile Money</Badge>
      case 'paypal':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">PayPal</Badge>
      default:
        return null
    }
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

  const handleViewDetails = (account: PayoutAccount) => {
    setSelectedAccount(account)
    setIsDialogOpen(true)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setAccountTypeFilter('all')
  }

  return (
    <div className={cn("p-4 md:p-6 lg:p-8 space-y-6", themeClasses.backgroundColor)}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl md:text-3xl font-bold", themeClasses.mainText)}>
            Payout Accounts
          </h1>
          <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
            View and verify supplier payout account information (Read-Only)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-sm", themeClasses.cardBorder)}>
            {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by account name, supplier, bank, or account number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn("pl-10", themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                />
              </div>
            </div>

            {/* Account Type Filter */}
            <div className="w-full md:w-48">
              <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                <SelectTrigger className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || accountTypeFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className={cn(themeClasses.cardBorder)}
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {isLoading ? (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className={cn(themeClasses.textNeutralSecondary)}>Loading payout accounts...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredAccounts.length === 0 ? (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className={cn("text-lg font-medium mb-2", themeClasses.mainText)}>
                No payout accounts found
              </p>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                {searchTerm || accountTypeFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No payout accounts have been created yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAccounts.map((account) => (
            <Card
              key={account.id}
              className={cn(
                "hover:shadow-md transition-shadow cursor-pointer",
                themeClasses.cardBg,
                themeClasses.cardBorder
              )}
              onClick={() => handleViewDetails(account)}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {getAccountTypeIcon(account.account_type)}
                      <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>
                        {account.account_name}
                      </h3>
                      {getAccountTypeBadge(account.account_type)}
                      {account.is_default && (
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                          Default
                        </Badge>
                      )}
                      {account.is_verified ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                          <XCircle className="w-3 h-3 mr-1" />
                          Unverified
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {/* Supplier Info */}
                      {account.supplier && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className={cn(themeClasses.textNeutralSecondary)}>
                            {account.supplier.company_name || account.supplier.full_name || 'Unknown'}
                          </span>
                          {!account.supplier.is_active && (
                            <Badge variant="outline" className="text-red-600 dark:text-red-400">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Account Details */}
                      {account.account_type === 'bank' && account.bank_name && (
                        <div className={cn("flex items-center gap-2", themeClasses.textNeutralSecondary)}>
                          <Building2 className="w-4 h-4" />
                          <span>{account.bank_name}</span>
                        </div>
                      )}

                      {account.account_type === 'mobile_money' && account.mobile_provider && (
                        <div className={cn("flex items-center gap-2", themeClasses.textNeutralSecondary)}>
                          <Smartphone className="w-4 h-4" />
                          <span>{account.mobile_provider}</span>
                        </div>
                      )}

                      {account.account_type === 'paypal' && account.paypal_email && (
                        <div className={cn("flex items-center gap-2", themeClasses.textNeutralSecondary)}>
                          <Mail className="w-4 h-4" />
                          <span>{account.paypal_email}</span>
                        </div>
                      )}

                      {/* Created Date */}
                      <div className={cn("flex items-center gap-2", themeClasses.textNeutralSecondary)}>
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDate(account.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewDetails(account)
                    }}
                    className={cn(themeClasses.cardBorder)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto", themeClasses.cardBg)}>
          <DialogHeader>
            <DialogTitle className={cn(themeClasses.mainText)}>Payout Account Details</DialogTitle>
            <DialogDescription>
              View complete payout account information (Read-Only)
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-6">
              {/* Account Type & Status */}
              <div className="flex items-center gap-2 flex-wrap">
                {getAccountTypeBadge(selectedAccount.account_type)}
                {selectedAccount.is_default && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                    Default Account
                  </Badge>
                )}
                {selectedAccount.is_verified ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                    <XCircle className="w-3 h-3 mr-1" />
                    Unverified
                  </Badge>
                )}
              </div>

              {/* Account Information */}
              <div className="space-y-4">
                <div>
                  <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Account Name</Label>
                  <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.account_name}</p>
                </div>

                {/* Bank Account Details */}
                {selectedAccount.account_type === 'bank' && (
                  <>
                    {selectedAccount.bank_name && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Bank Name</Label>
                        <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.bank_name}</p>
                      </div>
                    )}
                    {selectedAccount.account_number && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Account Number</Label>
                        <p className={cn("text-base mt-1 font-mono", themeClasses.mainText)}>{selectedAccount.account_number}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Mobile Money Details */}
                {selectedAccount.account_type === 'mobile_money' && (
                  <>
                    {selectedAccount.mobile_provider && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Mobile Provider</Label>
                        <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.mobile_provider}</p>
                      </div>
                    )}
                    {selectedAccount.mobile_number && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Mobile Number</Label>
                        <p className={cn("text-base mt-1 font-mono", themeClasses.mainText)}>{selectedAccount.mobile_number}</p>
                      </div>
                    )}
                  </>
                )}

                {/* PayPal Details */}
                {selectedAccount.account_type === 'paypal' && selectedAccount.paypal_email && (
                  <div>
                    <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>PayPal Email</Label>
                    <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.paypal_email}</p>
                  </div>
                )}
              </div>

              {/* Supplier Information */}
              {selectedAccount.supplier && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className={cn("font-semibold", themeClasses.mainText)}>Supplier Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedAccount.supplier.company_name && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Company Name</Label>
                        <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.supplier.company_name}</p>
                      </div>
                    )}
                    {selectedAccount.supplier.full_name && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Full Name</Label>
                        <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.supplier.full_name}</p>
                      </div>
                    )}
                    {selectedAccount.supplier.email && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Email</Label>
                        <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.supplier.email}</p>
                      </div>
                    )}
                    {selectedAccount.supplier.phone && (
                      <div>
                        <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Phone</Label>
                        <p className={cn("text-base mt-1", themeClasses.mainText)}>{selectedAccount.supplier.phone}</p>
                      </div>
                    )}
                    <div>
                      <Label className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Status</Label>
                      <div className={cn("text-base mt-1", themeClasses.mainText)}>
                        {selectedAccount.supplier.is_active ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 dark:text-red-400">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={cn(themeClasses.textNeutralSecondary)}>Created:</span>
                  <span className={cn(themeClasses.mainText)}>{formatDate(selectedAccount.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={cn(themeClasses.textNeutralSecondary)}>Last Updated:</span>
                  <span className={cn(themeClasses.mainText)}>{formatDate(selectedAccount.updated_at)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

