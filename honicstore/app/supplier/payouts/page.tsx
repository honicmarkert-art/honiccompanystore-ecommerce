"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, CreditCard, Building2, Wallet, CheckCircle, X, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface PayoutAccount {
  id: string
  account_type: 'bank' | 'mobile_money' | 'paypal'
  account_name: string
  account_number?: string
  bank_name?: string
  mobile_provider?: string
  mobile_number?: string
  paypal_email?: string
  is_default: boolean
  is_verified: boolean
  created_at: string
}

export default function PayoutAccountsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<PayoutAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<PayoutAccount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyInfoComplete, setCompanyInfoComplete] = useState<boolean | null>(null)

  const [formData, setFormData] = useState({
    account_type: 'bank' as 'bank' | 'mobile_money' | 'paypal',
    account_name: '',
    account_number: '',
    bank_name: '',
    mobile_provider: '',
    mobile_number: '',
    paypal_email: '',
    is_default: false
  })

  useEffect(() => {
    fetchAccounts()
    checkCompanyInfo()
  }, [])

  const checkCompanyInfo = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          const profile = data.profile
          // Check if company info is complete
          const isComplete = !!(
            profile.company_name &&
            profile.company_name.trim() !== '' &&
            profile.office_number &&
            profile.office_number.trim() !== '' &&
            profile.region &&
            profile.region.trim() !== ''
          )
          setCompanyInfoComplete(isComplete)

          // Show notification if incomplete
          if (!isComplete) {
            toast({
              title: 'Complete Your Account Information',
              description: 'Please complete your business information to enable payouts. Go to Company Info to update your details.',
              duration: 8000,
              variant: 'default'
            })
          }
        } else {
          setCompanyInfoComplete(false)
        }
      }
    } catch (error) {
      console.error('Error checking company info:', error)
      setCompanyInfoComplete(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/supplier/payout-accounts')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch accounts')
      }

      setAccounts(data.accounts || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load payout accounts',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (account?: PayoutAccount) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        account_type: account.account_type,
        account_name: account.account_name,
        account_number: account.account_number || '',
        bank_name: account.bank_name || '',
        mobile_provider: account.mobile_provider || '',
        mobile_number: account.mobile_number || '',
        paypal_email: account.paypal_email || '',
        is_default: account.is_default
      })
    } else {
      setEditingAccount(null)
      setFormData({
        account_type: 'bank',
        account_name: '',
        account_number: '',
        bank_name: '',
        mobile_provider: '',
        mobile_number: '',
        paypal_email: '',
        is_default: false
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingAccount(null)
    setFormData({
      account_type: 'bank',
      account_name: '',
      account_number: '',
      bank_name: '',
      mobile_provider: '',
      mobile_number: '',
      paypal_email: '',
      is_default: false
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.account_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Account name is required',
        variant: 'destructive'
      })
      return
    }

    if (formData.account_type === 'bank') {
      if (!formData.account_number.trim() || !formData.bank_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Account number and bank name are required for bank accounts',
          variant: 'destructive'
        })
        return
      }
    } else if (formData.account_type === 'mobile_money') {
      if (!formData.mobile_provider.trim() || !formData.mobile_number.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Mobile provider and mobile number are required for mobile money accounts',
          variant: 'destructive'
        })
        return
      }
    } else if (formData.account_type === 'paypal') {
      if (!formData.paypal_email.trim()) {
        toast({
          title: 'Validation Error',
          description: 'PayPal email is required',
          variant: 'destructive'
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      const url = editingAccount
        ? `/api/supplier/payout-accounts/${editingAccount.id}`
        : '/api/supplier/payout-accounts'
      
      const method = editingAccount ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save account')
      }

      toast({
        title: 'Success',
        description: editingAccount ? 'Account updated successfully' : 'Account added successfully'
      })

      handleCloseDialog()
      fetchAccounts()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save account',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payout account?')) {
      return
    }

    try {
      const response = await fetch(`/api/supplier/payout-accounts/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast({
        title: 'Success',
        description: 'Account deleted successfully'
      })

      fetchAccounts()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account',
        variant: 'destructive'
      })
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/supplier/payout-accounts/${id}/set-default`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set default account')
      }

      toast({
        title: 'Success',
        description: 'Default account updated'
      })

      fetchAccounts()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set default account',
        variant: 'destructive'
      })
    }
  }

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Building2 className="w-5 h-5" />
      case 'mobile_money':
        return <Wallet className="w-5 h-5" />
      case 'paypal':
        return <CreditCard className="w-5 h-5" />
      default:
        return <CreditCard className="w-5 h-5" />
    }
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank':
        return 'Bank Account'
      case 'mobile_money':
        return 'Mobile Money'
      case 'paypal':
        return 'PayPal'
      default:
        return type
    }
  }

  if (loading) {
    return (
      <div className={cn("min-h-screen p-4 md:p-8", themeClasses.backgroundColor)}>
        <div className="max-w-6xl mx-auto">
          <div className={cn("text-center py-12", themeClasses.textNeutralSecondary)}>
            Loading payout accounts...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen p-4 md:p-8", themeClasses.backgroundColor)}>
      <div className="max-w-6xl mx-auto">
        {/* Warning Banner */}
        {companyInfoComplete === false && (
          <Card className={cn("mb-6 border-yellow-200 dark:border-yellow-800", themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className={cn("font-semibold mb-1", themeClasses.mainText)}>
                    Complete Your Account Information
                  </h3>
                  <p className={cn("text-sm mb-3", themeClasses.textNeutralSecondary)}>
                    To receive payouts, please complete your business information first. This includes your company name, office number, and region.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/supplier/company-info')}
                    className="border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                  >
                    Complete Account Info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
              Payout Accounts
            </h1>
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Manage your payout accounts for receiving earnings
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>

        {/* Information Text */}
        <div className={cn("mb-6 p-3 rounded-md border border-blue-200 dark:border-blue-800", themeClasses.cardBg)}>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              <strong className={cn(themeClasses.mainText)}>Note:</strong> Please enter correct account name and account number (or all required fields) to ensure successful payouts.
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardContent className="py-12 text-center">
              <Wallet className={cn("w-12 h-12 mx-auto mb-4", themeClasses.textNeutralSecondary)} />
              <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
                No Payout Accounts
              </h3>
              <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                Add a payout account to receive your earnings
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card
                key={account.id}
                className={cn(
                  "relative",
                  themeClasses.cardBg,
                  themeClasses.cardBorder,
                  account.is_default && "ring-2 ring-blue-500"
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getAccountIcon(account.account_type)}
                      <div>
                        <CardTitle className={cn("text-lg", themeClasses.mainText)}>
                          {account.account_name}
                        </CardTitle>
                        <CardDescription>
                          {getAccountTypeLabel(account.account_type)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.is_verified && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {account.is_default && (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn("space-y-2 text-sm", themeClasses.textNeutralSecondary)}>
                    {account.account_type === 'bank' && (
                      <>
                        <p><strong className={themeClasses.mainText}>Bank:</strong> {account.bank_name}</p>
                        <p><strong className={themeClasses.mainText}>Account:</strong> {account.account_number}</p>
                      </>
                    )}
                    {account.account_type === 'mobile_money' && (
                      <>
                        <p><strong className={themeClasses.mainText}>Provider:</strong> {account.mobile_provider}</p>
                        <p><strong className={themeClasses.mainText}>Number:</strong> {account.mobile_number}</p>
                      </>
                    )}
                    {account.account_type === 'paypal' && (
                      <p><strong className={themeClasses.mainText}>Email:</strong> {account.paypal_email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {!account.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(account.id)}
                        className="flex-1"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(account)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className={cn(themeClasses.cardBg, "max-w-2xl")}>
            <DialogHeader>
              <DialogTitle className={cn(themeClasses.mainText)}>
                {editingAccount ? 'Edit Payout Account' : 'Add Payout Account'}
              </DialogTitle>
              <DialogDescription>
                {editingAccount ? 'Update your payout account information' : 'Add a new payout account to receive your earnings'}
              </DialogDescription>
            </DialogHeader>
            
            {/* Information Banner */}
            {!editingAccount && (
              <div className={cn("p-3 rounded-md border border-blue-200 dark:border-blue-800", themeClasses.cardBg)}>
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                    <strong className={cn(themeClasses.mainText)}>Important:</strong> Please ensure you enter the correct account name, account number (or all required fields) as provided by your bank or payment provider. Incorrect information may delay or prevent payouts.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className={cn(themeClasses.mainText)}>Account Type *</Label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value as any })}
                  className={cn(
                    "w-full px-3 py-2 rounded-md border",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                  disabled={!!editingAccount}
                >
                  <option value="bank">Bank Account</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className={cn(themeClasses.mainText)}>Account Name *</Label>
                <Input
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g., John Doe"
                  className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                  required
                />
              </div>

              {formData.account_type === 'bank' && (
                <>
                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Bank Name *</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g., CRDB Bank"
                      className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Account Number *</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="e.g., 1234567890"
                      className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                      required
                    />
                  </div>
                </>
              )}

              {formData.account_type === 'mobile_money' && (
                <>
                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Mobile Provider *</Label>
                    <select
                      value={formData.mobile_provider}
                      onChange={(e) => setFormData({ ...formData, mobile_provider: e.target.value })}
                      className={cn(
                        "w-full px-3 py-2 rounded-md border",
                        themeClasses.cardBg,
                        themeClasses.cardBorder,
                        themeClasses.mainText
                      )}
                      required
                    >
                      <option value="">Select provider</option>
                      <option value="M-Pesa">M-Pesa</option>
                      <option value="Tigo Pesa">Tigo Pesa</option>
                      <option value="Airtel Money">Airtel Money</option>
                      <option value="Halotel">Halotel</option>
                      <option value="T-Pesa">T-Pesa</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className={cn(themeClasses.mainText)}>Mobile Number *</Label>
                    <Input
                      value={formData.mobile_number}
                      onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      placeholder="e.g., 0712345678"
                      className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                      required
                    />
                  </div>
                </>
              )}

              {formData.account_type === 'paypal' && (
                <div className="space-y-2">
                  <Label className={cn(themeClasses.mainText)}>PayPal Email *</Label>
                  <Input
                    type="email"
                    value={formData.paypal_email}
                    onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
                    placeholder="e.g., john@example.com"
                    className={cn(themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                    required
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_default" className={cn(themeClasses.mainText)}>
                  Set as default payout account
                </Label>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Saving...' : editingAccount ? 'Update Account' : 'Add Account'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                  className={cn(themeClasses.cardBorder)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

