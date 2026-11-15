'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePaymentStatuses } from '@/hooks/use-payment-statuses'
import { getAuthToken } from '@/lib/auth-utils'
import { MapPin, Wallet } from 'lucide-react'

type SavedAddress = {
  id: string
  type: string
  full_name: string
  address: string
  city: string | null
  postal_code: string | null
  country: string | null
  phone: string | null
  email: string | null
  is_default: boolean
}

export default function PaymentPage() {
  const router = useRouter()
  const { paymentStatuses, loading, error } = usePaymentStatuses()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [addressError, setAddressError] = useState('')

  useEffect(() => {
    const load = async () => {
      const token = await getAuthToken()
      if (!token) return
      try {
        const response = await fetch('/api/user/addresses', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await response.json()
        if (!response.ok) {
          setAddressError(data.error || 'Could not load addresses')
          return
        }
        setAddresses(data.addresses || [])
      } catch {
        setAddressError('Could not load addresses')
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment</h1>
        <p className="text-sm text-muted-foreground">Payments are taken by mobile money at checkout. Saved cards are not stored here.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" /> Payment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading payments...</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && paymentStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : null}
          {paymentStatuses.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 border p-3">
              <div>
                <p className="font-medium">Order {payment.order_number}</p>
                <p className="text-sm text-muted-foreground">
                  TZS {Number(payment.amount || 0).toLocaleString()} · {new Date(payment.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{payment.payment_status}</Badge>
                <Button variant="outline" size="sm" onClick={() => router.push(`/account/orders/${payment.order_number}`)}>View</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" /> Saved addresses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {addressError ? <p className="text-sm text-red-600">{addressError}</p> : null}
          {!addressError && addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved addresses. Checkout stores the address you enter with an order.</p>
          ) : null}
          {addresses.map((address) => (
            <div key={address.id} className="border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{address.full_name}</p>
                <Badge variant="outline">{address.type}{address.is_default ? ' · default' : ''}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {address.address}{address.city ? `, ${address.city}` : ''}{address.country ? `, ${address.country}` : ''}
              </p>
              {address.phone ? <p className="text-sm text-muted-foreground">{address.phone}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
