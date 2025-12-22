"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { getAuthToken } from '@/lib/auth-utils'
import { ProtectedRoute } from '@/components/protected-route'
import { Mail, Bell, ShoppingBag, Tag, MessageCircle } from 'lucide-react'

interface EmailPreferences {
  orderUpdates: boolean
  promotionalEmails: boolean
  productRecommendations: boolean
  priceAlerts: boolean
  supportMessages: boolean
  newsletter: boolean
}

function EmailPreferencesPageContent() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<EmailPreferences>({
    orderUpdates: true,
    promotionalEmails: true,
    productRecommendations: true,
    priceAlerts: false,
    supportMessages: true,
    newsletter: false
  })

  useEffect(() => {
    const loadPreferences = async () => {
      setLoading(true)
      try {
        const token = await getAuthToken()
        if (!token) {
          setLoading(false)
          return
        }
        const res = await fetch('/api/user/email-preferences', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const json = await res.json()
          if (json?.preferences) {
            setPreferences(json.preferences)
          }
        }
      } catch (error) {
        // Error loading email preferences
      } finally {
        setLoading(false)
      }
    }
    loadPreferences()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const token = await getAuthToken()
      if (!token) {
        toast({
          title: 'Not authenticated',
          description: 'Please login again',
          variant: 'destructive'
        })
        return
      }
      const res = await fetch('/api/user/email-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ preferences })
      })
      const json = await res.json()
      if (res.ok) {
        toast({
          title: 'Preferences saved',
          description: 'Your email preferences have been updated.'
        })
      } else {
        toast({
          title: 'Failed to save',
          description: json?.error || 'Try again',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not save preferences',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (key: keyof EmailPreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading preferences...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Email Preferences</h1>
        <p className="text-muted-foreground">
          Manage how and when you receive emails from us
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Order & Transaction Emails
          </CardTitle>
          <CardDescription>
            Important updates about your orders and transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="orderUpdates" className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Order Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications about order status, shipping, and delivery
              </p>
            </div>
            <Switch
              id="orderUpdates"
              checked={preferences.orderUpdates}
              onCheckedChange={(checked) => updatePreference('orderUpdates', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Marketing & Promotions
          </CardTitle>
          <CardDescription>
            Special offers, deals, and product recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="promotionalEmails" className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Promotional Emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about special offers, discounts, and sales
              </p>
            </div>
            <Switch
              id="promotionalEmails"
              checked={preferences.promotionalEmails}
              onCheckedChange={(checked) => updatePreference('promotionalEmails', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="productRecommendations" className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Product Recommendations
              </Label>
              <p className="text-sm text-muted-foreground">
                Personalized product suggestions based on your interests
              </p>
            </div>
            <Switch
              id="productRecommendations"
              checked={preferences.productRecommendations}
              onCheckedChange={(checked) => updatePreference('productRecommendations', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="priceAlerts" className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Price Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when prices drop on items you're watching
              </p>
            </div>
            <Switch
              id="priceAlerts"
              checked={preferences.priceAlerts}
              onCheckedChange={(checked) => updatePreference('priceAlerts', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="newsletter" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Newsletter
              </Label>
              <p className="text-sm text-muted-foreground">
                Weekly digest with the latest news and updates
              </p>
            </div>
            <Switch
              id="newsletter"
              checked={preferences.newsletter}
              onCheckedChange={(checked) => updatePreference('newsletter', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Support & Communication
          </CardTitle>
          <CardDescription>
            Customer support and account-related communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="supportMessages" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Support Messages
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive responses to your support requests and inquiries
              </p>
            </div>
            <Switch
              id="supportMessages"
              checked={preferences.supportMessages}
              onCheckedChange={(checked) => updatePreference('supportMessages', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  )
}

export default function EmailPreferencesPage() {
  return (
    <ProtectedRoute>
      <EmailPreferencesPageContent />
    </ProtectedRoute>
  )
}

