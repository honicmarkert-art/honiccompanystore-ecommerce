'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MessageCircle } from 'lucide-react'

type Notice = {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export default function MessagesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || data.success === false) {
        setError(data.error || 'Could not load messages')
        setNotices([])
      } else {
        setNotices(data.notifications || [])
      }
    } catch {
      setError('Could not load messages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
    if (response.ok) {
      setNotices((current) => current.map((notice) => notice.id === id ? { ...notice, is_read: true } : notice))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">Order and account notices sent to you.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading messages...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && notices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No messages</p>
            <p className="mt-1 text-sm text-muted-foreground">Notices about your orders and account will appear here.</p>
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-3">
        {notices.map((notice) => (
          <Card key={notice.id} className={notice.is_read ? '' : 'border-yellow-500'}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{notice.title}</p>
                <p className="shrink-0 text-xs text-muted-foreground">{new Date(notice.created_at).toLocaleString()}</p>
              </div>
              <p className="text-sm">{notice.message}</p>
              {!notice.is_read ? (
                <Button variant="outline" size="sm" onClick={() => markRead(notice.id)}>Mark as read</Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
