"use client"

import { UserRoute } from '@/components/protected-route'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface SavedItem {
  id: number
  productId: number
  name?: string
  price?: number
  image?: string
}

export default function SavedForLaterPage() {
  const [items, setItems] = useState<SavedItem[]>([])
  const { toast } = useToast()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('saved_for_later')
      if (raw) setItems(JSON.parse(raw))
    } catch {}
  }, [])

  const restoreToCart = (productId: number) => {
    // Let existing cart add flow handle actual add; for now just remove from local saved
    const next = items.filter(i => i.productId !== productId)
    setItems(next)
    try { localStorage.setItem('saved_for_later', JSON.stringify(next)) } catch {}
    toast({ title: 'Moved to cart' })
  }

  const removeItem = (productId: number) => {
    const next = items.filter(i => i.productId !== productId)
    setItems(next)
    try { localStorage.setItem('saved_for_later', JSON.stringify(next)) } catch {}
  }

  const clearAll = () => {
    setItems([])
    try { localStorage.removeItem('saved_for_later') } catch {}
  }

  return (
    <UserRoute>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Saved For Later</CardTitle>
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>Clear All</Button>
          )}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No items saved for later. <Link href="/products" className="text-orange-600">Continue shopping</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.productId} className="flex items-center justify-between border rounded p-3">
                  <div className="flex items-center gap-3">
                    <img src={item.image || '/placeholder.svg'} alt={item.name || ''} className="w-12 h-12 object-contain" />
                    <div>
                      <div className="font-medium">{item.name || `Product #${item.productId}`}</div>
                      {item.price ? <div className="text-sm text-gray-500">TZS {item.price.toLocaleString()}</div> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => restoreToCart(item.productId)}>Move to Cart</Button>
                    <Button size="sm" variant="outline" onClick={() => removeItem(item.productId)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </UserRoute>
  )
}


