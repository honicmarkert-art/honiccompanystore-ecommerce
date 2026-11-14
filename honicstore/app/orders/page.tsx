"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useCurrency } from "@/contexts/currency-context"
import { useTheme } from "@/hooks/use-theme"
import { readLocalOrders, type LocalOrder } from "@/lib/local-orders"
import { cn } from "@/lib/utils"

export default function LocalOrdersPage() {
  const { isAuthenticated } = useAuth()
  const { formatPrice } = useCurrency()
  const { themeClasses } = useTheme()
  const [orders, setOrders] = useState<LocalOrder[]>([])

  useEffect(() => {
    setOrders(readLocalOrders())
  }, [])

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className={cn("text-2xl font-semibold", themeClasses.mainText)}>Orders on this computer</h1>
          <p className={cn("mt-1 text-sm", themeClasses.mainText)}>
            These receipts stay in this browser. An account is optional if you want history on other devices.
          </p>
        </div>
        {isAuthenticated && (
          <Button asChild variant="outline">
            <Link href="/account/orders">Open account order history</Link>
          </Button>
        )}
        {orders.length === 0 ? (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardContent className="py-8 text-center">
              <p className={themeClasses.mainText}>No orders are saved on this computer yet.</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.referenceId} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardHeader>
                <CardTitle className={cn("text-base", themeClasses.mainText)}>{order.referenceId}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className={themeClasses.mainText}>Status: {order.status}</p>
                <p className={themeClasses.mainText}>Total: {formatPrice(order.total)}</p>
                <p className={themeClasses.mainText}>{order.items.length} item(s)</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/checkout/success?orderReference=${encodeURIComponent(order.referenceId)}`}>Open order</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
