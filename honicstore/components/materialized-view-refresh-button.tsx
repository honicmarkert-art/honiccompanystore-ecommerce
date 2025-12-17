"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface RefreshButtonProps {
  onRefresh?: () => void
  className?: string
}

export function MaterializedViewRefreshButton({ onRefresh, className }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      
      const response = await fetch('/api/products/refresh-materialized-view', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        setLastRefresh(new Date())
        toast({
          title: "✅ Materialized View Refreshed",
          description: "Product data has been updated successfully.",
          duration: 3000,
        })
        
        // Call the optional callback
        if (onRefresh) {
          onRefresh()
        }
      } else {
        throw new Error(data.error || 'Failed to refresh materialized view')
      }
    } catch (error) {
      console.error('Refresh error:', error)
      toast({
        title: "❌ Refresh Failed",
        description: error instanceof Error ? error.message : 'Failed to refresh materialized view',
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Button
        onClick={handleRefresh}
        disabled={isRefreshing}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {isRefreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
      </Button>
      
      {lastRefresh && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>Last refreshed: {lastRefresh.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  )
}



