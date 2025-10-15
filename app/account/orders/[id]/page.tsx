"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { UserRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, ArrowLeft } from 'lucide-react'

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/orders/my/${params.id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        setOrder(json.order)
      } catch {
        setOrder(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  return (
    <UserRoute>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {order?.status === 'shipped' && (
            <Button variant="outline" size="sm"><Truck className="w-4 h-4 mr-2" /> Track</Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order {order?.reference || params.id}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading...</div>
            ) : !order ? (
              <div>Order not found.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <div className="font-medium">{order.status}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Placed</div>
                    <div className="font-medium">{new Date(order.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="font-medium">{order.currency || 'TZS'} {Number(order.total || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Items</div>
                  <div className="space-y-2">
                    {(order.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between border rounded p-2">
                        <div className="flex items-center gap-3">
                          <img src={it.image || '/placeholder.svg'} alt={it.name} className="w-10 h-10 object-contain" />
                          <div>
                            <div className="font-medium">{it.name}</div>
                            <div className="text-sm text-gray-500">Qty {it.quantity} × {it.price}</div>
                          </div>
                        </div>
                        <div className="font-medium">{(it.quantity * it.price).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UserRoute>
  )
}


