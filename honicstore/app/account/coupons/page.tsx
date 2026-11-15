'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Ticket } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Promotion = {
  id: string
  name: string
  code: string
  description: string | null
  discount_type: string
  discount_value: number
  min_purchase_amount: number | null
  end_date: string
}

function discountLabel(promotion: Promotion) {
  if (promotion.discount_type === 'percentage') return `${promotion.discount_value}% off`
  return `TZS ${Number(promotion.discount_value || 0).toLocaleString()} off`
}

export default function CouponsPage() {
  const { toast } = useToast()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/promotions', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setPromotions(data.promotions || []))
      .catch(() => setPromotions([]))
      .finally(() => setLoading(false))
  }, [])

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast({ title: 'Code copied', description: code })
    } catch {
      toast({ title: 'Could not copy the code', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Coupons</h1>
        <p className="text-sm text-muted-foreground">Active promotion codes you can enter at checkout.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading coupons...</p> : null}
      {!loading && promotions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No active coupons</p>
            <p className="mt-1 text-sm text-muted-foreground">When a promotion is running, its code will show here.</p>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {promotions.map((promotion) => (
          <Card key={promotion.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{promotion.name}</p>
                  <p className="font-mono text-lg">{promotion.code}</p>
                </div>
                <Badge variant="outline">{discountLabel(promotion)}</Badge>
              </div>
              {promotion.description ? <p className="text-sm text-muted-foreground">{promotion.description}</p> : null}
              <p className="text-xs text-muted-foreground">
                {promotion.min_purchase_amount ? `Minimum TZS ${Number(promotion.min_purchase_amount).toLocaleString()}. ` : ''}
                Valid until {new Date(promotion.end_date).toLocaleDateString()}
              </p>
              <Button variant="outline" size="sm" onClick={() => copyCode(promotion.code)}>Copy code</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
