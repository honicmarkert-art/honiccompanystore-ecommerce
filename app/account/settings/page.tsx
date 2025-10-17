"use client"

import { useEffect, useState } from 'react'
import { UserRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase-auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'

export default function AccountSettingsPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pwd1, setPwd1] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        if (!token) { setLoading(false); return }
        const res = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (res.ok && json?.profile) {
          setFullName(json.profile.full_name || '')
          setPhone(json.profile.phone || '')
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const saveProfile = async () => {
    try {
      setSaving(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) { setSaving(false); return }
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: fullName, phone })
      })
      const json = await res.json()
      if (res.ok) {
        await supabase.auth.updateUser({ data: { full_name: fullName, phone } })
        toast({ title: 'Saved', description: 'Profile updated.' })
      } else {
        toast({ title: 'Failed', description: json?.error || 'Try again', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Could not save profile', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (!pwd1 || pwd1.length < 8 || pwd1 !== pwd2) {
      toast({ title: 'Invalid password', description: 'Ensure passwords match and are 8+ chars', variant: 'destructive' })
      return
    }
    try {
      setChangingPwd(true)
      const { error } = await supabase.auth.updateUser({ password: pwd1 })
      if (error) throw error
      setPwd1(''); setPwd2('')
      toast({ title: 'Password updated' })
    } catch {
      toast({ title: 'Failed to update password', variant: 'destructive' })
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <UserRoute>
      {/* Top nav like products list + back button */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/products')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg font-semibold">Account Settings</h1>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          <Link href="/">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/account">Account</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 dark:text-gray-100">Settings</span>
        </div>
      </div>

      {/* Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" value={fullName} onChange={(e)=>setFullName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e)=>setPhone(e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="pwd1">New Password</Label>
              <Input 
                id="pwd1" 
                type="password" 
                placeholder="At least 8 characters" 
                value={pwd1} 
                onChange={(e)=>setPwd1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    changePassword()
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pwd2">Confirm Password</Label>
              <Input 
                id="pwd2" 
                type="password" 
                value={pwd2} 
                onChange={(e)=>setPwd2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    changePassword()
                  }
                }}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={changePassword} disabled={changingPwd}>{changingPwd ? 'Updating...' : 'Change Password'}</Button>
          </div>
        </CardContent>
      </Card>
    </UserRoute>
  )
}



