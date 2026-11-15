'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, Trash2 } from 'lucide-react'

type AlertRow = {
  id: string
  product_id: number
  target_price: number
  current_price: number | null
  is_active: boolean
  email_sent: boolean
  products: {
    id: number
    name: string
    image: string | null
    price: number
    slug: string | null
  } | null
}

function money(value: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`
}

export default function PriceAlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/user/price-alerts', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Could not load price alerts')
        setAlerts([])
      } else {
        setAlerts(data.alerts || [])
      }
    } catch {
      setError('Could not load price alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    const response = await fetch(`/api/user/price-alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) setAlerts((current) => current.filter((alert) => alert.id !== id))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Price alerts</h1>
        <p className="text-sm text-muted-foreground">We email you when a saved product reaches your target price.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading price alerts...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && alerts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No price alerts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Open a product and set a target price.</p>
            <Button asChild className="mt-4" variant="outline"><Link href="/products">Browse products</Link></Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-3">
        {alerts.map((alert) => {
          const product = alert.products
          const href = `/products/${product?.slug || alert.product_id}`
          const livePrice = Number(product?.price ?? alert.current_price ?? 0)
          return (
            <Card key={alert.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={href} className="font-semibold hover:underline">{product?.name || 'Product'}</Link>
                  <p className="text-sm text-muted-foreground">Current {money(livePrice)} · Target {money(Number(alert.target_price))}</p>
                  {alert.email_sent ? <p className="text-xs text-green-700">Alert already sent</p> : null}
                </div>
                <Button variant="outline" size="sm" onClick={() => remove(alert.id)} aria-label="Remove price alert">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
