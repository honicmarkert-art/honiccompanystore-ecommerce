"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Save, User, Shield, Bell, Globe } from 'lucide-react'

interface UserSettings {
  rememberMe: boolean
  emailNotifications: boolean
  theme: 'light' | 'dark' | 'system'
}

export function UserSettings() {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<UserSettings>({
    rememberMe: true,
    emailNotifications: true,
    theme: 'system'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load user settings on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserSettings()
    }
  }, [isAuthenticated, user])

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings || {
          rememberMe: true,
          emailNotifications: true,
          theme: 'system'
        })
      }
    } catch (error) {
      console.error('Failed to load user settings:', error)
    }
  }

  const saveSettings = async () => {
    if (!isAuthenticated || !user) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ settings })
      })

      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Your preferences have been updated successfully.",
        })
        setHasChanges(false)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSettingChange = (key: keyof UserSettings, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  if (!isAuthenticated || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please sign in to access your settings.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Remember Me Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="remember-me" className="text-base">
                Remember Me
              </Label>
              <p className="text-sm text-muted-foreground">
                Stay logged in when you close your browser. If disabled, you'll need to sign in again after closing the browser.
              </p>
            </div>
            <Switch
              id="remember-me"
              checked={settings.rememberMe}
              onCheckedChange={(checked) => handleSettingChange('rememberMe', checked)}
            />
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-base">
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates about your orders and account activity.
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
            />
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="pt-4 border-t">
              <Button 
                onClick={saveSettings} 
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Email</Label>
              <p className="text-sm">{user.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Role</Label>
              <p className="text-sm capitalize">{user.role}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Name</Label>
              <p className="text-sm">{user.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <p className="text-sm">{user.isVerified ? 'Verified' : 'Unverified'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}














