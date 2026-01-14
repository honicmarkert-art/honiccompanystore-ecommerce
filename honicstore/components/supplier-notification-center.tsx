'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  ShoppingCart, 
  AlertTriangle, 
  Info,
  X,
  CheckCheck,
  Trash2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabaseClient } from '@/lib/supabase-client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Notification {
  id: string
  user_id: string
  type: 'account_activated' | 'account_deactivated' | 'order_received' | 'order_updated' | 'system' | 'info' | 'welcome' | 'waiting_for_review' | 'plan_expired'
  title: string
  message: string
  is_read: boolean
  read_at: string | null
  metadata: any
  created_at: string
  updated_at: string
}

interface SupplierNotificationCenterProps {
  className?: string
}

export function SupplierNotificationCenter({ className }: SupplierNotificationCenterProps) {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const deletedNotificationIdsRef = useRef<Set<string>>(new Set())
  const lastAccountStatusTriggerAtRef = useRef<number>(0)

  // Fetch notifications
  const fetchNotifications = useCallback(async (silent = false) => {
    const abortController = new AbortController()
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => abortController.abort(), 10000) // 10 second timeout
    
    try {
      if (!silent) {
        setLoading(true)
      }
      
      const response = await fetch('/api/notifications?limit=20', {
        credentials: 'include',
        signal: abortController.signal
      })
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
      // Check if response is ok before parsing
      if (!response.ok) {
        // Don't log 401/403 as errors (user might not be authenticated)
        if (response.status !== 401 && response.status !== 403) {
          }
        return
      }
      
      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return
      }
      
      const data = await response.json()

      if (data.success) {
        const newNotifications = (data.notifications || []).filter(
          (n: Notification) => !deletedNotificationIdsRef.current.has(n.id)
        )
        setNotifications(newNotifications)
        setUnreadCount(data.unreadCount || 0)
        
        // Check if there are any new account status change notifications
        // and trigger status refresh if needed. Throttle to avoid spamming.
        const now = Date.now()
        const recentAccountStatusNotifications = newNotifications.filter(
          (n: Notification) => 
            (n.type === 'account_activated' || n.type === 'account_deactivated') && 
            !n.is_read &&
            new Date(n.created_at).getTime() > lastAccountStatusTriggerAtRef.current
        )
        
        if (recentAccountStatusNotifications.length > 0 && now - lastAccountStatusTriggerAtRef.current >= 5000) {
          lastAccountStatusTriggerAtRef.current = now
          window.dispatchEvent(new CustomEvent('account-status-changed'))
        }
      }
    } catch (error: any) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
      // Ignore AbortError (timeout) and network errors silently for silent fetches
      if (silent && (error.name === 'AbortError' || error.message === 'Failed to fetch' || error.message?.includes('fetch'))) {
        return
      }
      
      // Only log non-network errors or errors during non-silent fetches
      // Error logging disabled for production cleanliness
      if (!silent && error.name !== 'AbortError' && error.message !== 'Failed to fetch' && !error.message?.includes('fetch')) {
        // Log error to monitoring service in production
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch notifications on mount and when popover opens
  useEffect(() => {
    fetchNotifications()
    
    // Set up polling as a fallback in case real-time doesn't work immediately
    // Poll every 30 seconds to avoid excessive network usage
    const pollInterval = setInterval(() => {
      fetchNotifications(true) // Silent fetch (no loading spinner)
    }, 30000)
    
    return () => {
      clearInterval(pollInterval)
    }
  }, [fetchNotifications])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // Listen for account status changes and other events that should trigger notification refresh
  useEffect(() => {
    const handleAccountStatusChange = () => {
      fetchNotifications(true)
    }
    
    const handleCompanyInfoUpdate = () => {
      fetchNotifications(true)
    }

    window.addEventListener('account-status-changed', handleAccountStatusChange)
    window.addEventListener('company-info-updated', handleCompanyInfoUpdate)

    return () => {
      window.removeEventListener('account-status-changed', handleAccountStatusChange)
      window.removeEventListener('company-info-updated', handleCompanyInfoUpdate)
    }
  }, [fetchNotifications])

  // Subscribe to real-time notification updates
  useEffect(() => {
    let isMounted = true
    let channel: RealtimeChannel | null = null

    const setupRealtime = async () => {
      if (!isMounted) return

      try {
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) return

        // Remove existing channel if any
        if (channel) {
          try {
            supabaseClient.removeChannel(channel)
          } catch (error) {
            }
        }

        channel = supabaseClient
          .channel(`supplier-notifications-realtime-${user.id}`, {
            config: {
              broadcast: { self: true },
              presence: { key: user.id }
            }
          })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications'
            },
            (payload) => {
              if (!isMounted) return
              const newNotification = payload.new as Notification
              // Filter by user_id in the callback (more reliable than filter parameter)
              if (newNotification.user_id === user.id) {
                // Immediately refresh notifications without loading spinner
                fetchNotifications(true)
                
                // If this is an account status change notification, trigger status refresh
                if (newNotification.type === 'account_activated' || newNotification.type === 'account_deactivated') {
                  window.dispatchEvent(new CustomEvent('account-status-changed'))
                }
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications'
            },
            (payload) => {
              if (!isMounted) return
              const updatedNotification = payload.new as Notification
              // Filter by user_id in the callback
              if (updatedNotification.user_id === user.id) {
                // Refresh notifications when one is updated (silent update)
                fetchNotifications(true)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'notifications'
            },
            (payload) => {
              if (!isMounted) return
              const deletedNotification = payload.old as Notification
              // Filter by user_id in the callback
              if (deletedNotification.user_id === user.id) {
                // Only refresh if we didn't just delete it ourselves
                if (!deletedNotificationIdsRef.current.has(deletedNotification.id)) {
                  // Remove from local state immediately
                  setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id))
                  if (!deletedNotification.is_read) {
                    setUnreadCount(prev => Math.max(0, prev - 1))
                  }
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              // Try to reconnect after a delay
              if (isMounted) {
                setTimeout(() => {
                  if (isMounted) {
                    setupRealtime()
                  }
                }, 3000)
              }
            }
          })

      } catch (error) {
        }
    }

    setupRealtime()

    return () => {
      isMounted = false
      if (channel) {
        try {
          supabaseClient.removeChannel(channel)
        } catch (error) {
          }
      }
    }
  }, [fetchNotifications])

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      // Find the notification before marking as read to check its type
      const notification = notifications.find(n => n.id === notificationId)
      const isAccountStatusNotification = notification?.type === 'account_activated' || notification?.type === 'account_deactivated'
      
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ is_read: true })
      })

      if (response.ok) {
        // Optimistically update UI
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        // Refetch to ensure consistency
        fetchNotifications()
        
        // If this is an account status notification, trigger status refresh
        if (isAccountStatusNotification) {
          window.dispatchEvent(new CustomEvent('account-status-changed'))
        }
      }
    } catch (error) {
      }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
        fetchNotifications()
      }
    } catch (error) {
      }
  }

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      // Mark as deleted to prevent it from reappearing (keep in set for entire session)
      deletedNotificationIdsRef.current.add(notificationId)
      
      // Optimistically remove from UI
      const notification = notifications.find(n => n.id === notificationId)
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        // If deletion failed, restore the notification
        deletedNotificationIdsRef.current.delete(notificationId)
        if (notification) {
          setNotifications(prev => [...prev, notification])
          if (!notification.is_read) {
            setUnreadCount(prev => prev + 1)
          }
        }
        throw new Error(data.error || 'Failed to delete notification')
      }
      
      // Keep in deleted set permanently for this session - don't remove it
      // This prevents the notification from reappearing if refetched
    } catch (error) {
      }
  }

  // Delete all read notifications
  const deleteAllRead = async () => {
    try {
      const readNotifications = notifications.filter(n => n.is_read)
      if (readNotifications.length === 0) {
        return
      }

      // Mark all as deleted to prevent them from reappearing (keep in set for entire session)
      readNotifications.forEach(n => {
        deletedNotificationIdsRef.current.add(n.id)
      })

      // Optimistically remove from UI
      setNotifications(prev => prev.filter(n => !n.is_read))

      // Delete all read notifications in parallel
      const deletePromises = readNotifications.map(notification =>
        fetch(`/api/notifications/${notification.id}`, {
          method: 'DELETE',
          credentials: 'include'
        })
      )

      const results = await Promise.all(deletePromises)
      const failedIds = readNotifications
        .filter((_, index) => !results[index].ok)
        .map(n => n.id)

      // Restore failed deletions
      if (failedIds.length > 0) {
        const failedNotifications = readNotifications.filter(n => failedIds.includes(n.id))
        setNotifications(prev => [...prev, ...failedNotifications])
        failedIds.forEach(id => deletedNotificationIdsRef.current.delete(id))
      }

      // Keep in deleted set permanently for this session - don't remove them
      // This prevents notifications from reappearing if refetched
    } catch (error) {
      }
  }

  // Get icon based on notification type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'account_activated':
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
      case 'account_deactivated':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
      case 'order_received':
      case 'order_updated':
        return <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      case 'welcome':
        return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      case 'waiting_for_review':
        return <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
      case 'plan_expired':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
      case 'system':
        return <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
      default:
        return <Info className="w-4 h-4 text-gray-600 dark:text-gray-400" />
    }
  }

  // Get background color based on notification type
  const getNotificationBg = (type: Notification['type'], isRead: boolean) => {
    if (isRead) {
      return 'bg-transparent'
    }
    switch (type) {
      case 'account_activated':
        return 'bg-green-50 dark:bg-green-900'
      case 'account_deactivated':
        return 'bg-red-50 dark:bg-red-900'
      case 'order_received':
      case 'order_updated':
        return 'bg-blue-50 dark:bg-blue-900'
      case 'welcome':
        return 'bg-blue-50 dark:bg-blue-900'
      case 'waiting_for_review':
        return 'bg-orange-50 dark:bg-orange-900'
      case 'plan_expired':
        return 'bg-red-50 dark:bg-red-900'
      default:
        return 'bg-gray-50 dark:bg-gray-900'
    }
  }

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    // If this is an account status change notification, trigger status refresh
    if (notification.type === 'account_activated' || notification.type === 'account_deactivated') {
      window.dispatchEvent(new CustomEvent('account-status-changed'))
    }

    // Navigate based on notification type or metadata
    if (notification.metadata?.link) {
      router.push(notification.metadata.link)
      setIsOpen(false)
    } else if (notification.type === 'order_received' || notification.type === 'order_updated') {
      router.push('/supplier/orders')
      setIsOpen(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("relative px-1.5 sm:px-2 lg:px-2.5 py-1.5 sm:py-2 h-7 sm:h-8 w-7 sm:w-8 lg:w-auto", themeClasses.mainText, themeClasses.buttonGhostHoverBg, className)}
        >
          <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 flex items-center justify-center p-0 bg-red-500 text-white text-[9px] sm:text-[10px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[calc(100vw-2rem)] sm:w-96 p-0", themeClasses.cardBg, themeClasses.cardBorder)} align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b" style={{ borderColor: 'inherit' }}>
          <h3 className={cn("font-semibold text-base sm:text-lg", themeClasses.mainText)}>Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className={cn("h-7 px-2 text-xs", themeClasses.buttonGhostHoverBg)}
                title="Mark all as read"
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            {notifications.some(n => n.is_read) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteAllRead}
                className={cn("h-7 px-2 text-xs", themeClasses.buttonGhostHoverBg)}
                title="Delete all read notifications"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Delete read</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className={cn("h-7 w-7", themeClasses.buttonGhostHoverBg)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500 mx-auto"></div>
              <p className={cn("text-xs sm:text-sm mt-2", themeClasses.textNeutralSecondary)}>Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 sm:p-8 text-center">
              <Bell className={cn("w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3", themeClasses.textNeutralSecondary)} />
              <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>No notifications</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'inherit' }}>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 sm:p-4 relative group",
                    !notification.is_read && "bg-opacity-50",
                    getNotificationBg(notification.type, notification.is_read)
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    notification.is_read ? "bg-gray-100 dark:bg-gray-800" : "bg-white dark:bg-gray-900"
                  )}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs sm:text-sm font-medium",
                          themeClasses.mainText,
                          !notification.is_read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        <p className={cn("text-[10px] sm:text-xs mt-1", themeClasses.textNeutralSecondary)}>
                          {notification.message}
                        </p>
                        <p className={cn("text-[10px] mt-1", themeClasses.textNeutralSecondary)}>
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={cn(
                    "flex items-start gap-1 transition-opacity",
                    notification.is_read ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification.id)
                        }}
                        title="Mark as read"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      title={notification.is_read ? "Delete read notification" : "Delete"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
