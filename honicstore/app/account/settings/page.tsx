"use client"

/**
 * Account settings: profile photo, name and phone, password, and how to delete the account.
 * Uses the cookie session (or bearer token) via /api/user/profile; photos go to the user's own
 * avatars folder through /api/media/upload (context "avatar").
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, KeyRound, Loader2, Mail, Trash2, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { getAuthToken } from '@/lib/auth-utils'
import { supabaseClient } from '@/lib/supabase-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmailPreferencesForm } from '@/components/email-preferences-form'

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'
const field = 'w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-stone-50 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900'
const card = 'rounded-2xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6 dark:bg-neutral-900 dark:ring-neutral-800'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken().catch(() => null)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AccountSettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatar, setAvatar] = useState('')
  const [pwd1, setPwd1] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const isGoogle = (user as { app_metadata?: { provider?: string } } | null)?.app_metadata?.provider === 'google'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user/profile', { headers: await authHeaders(), credentials: 'include' })
        const json = await res.json()
        if (!cancelled && res.ok && json?.profile) {
          setFullName(json.profile.full_name || '')
          setPhone(json.profile.phone || '')
          setAvatar(json.profile.avatar || '')
        }
      } catch { /* keep the empty form */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const putProfile = async (body: Record<string, string>) => {
    const res = await fetch('/api/user/profile', {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error || 'Could not save. Please try again.')
    return json
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await putProfile({ full_name: fullName.trim(), phone: phone.trim() })
      toast({ title: 'Saved', description: 'Your details are updated.' })
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast({ title: 'Choose a JPG, PNG or WebP photo', variant: 'destructive' }); return }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'Photo too large', description: 'Use a photo under 5 MB.', variant: 'destructive' }); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('context', 'avatar')
      const up = await fetch('/api/media/upload', { method: 'POST', body: form, credentials: 'include', headers: await authHeaders() })
      const data = await up.json().catch(() => null)
      if (!up.ok || !data?.url) throw new Error(data?.error || 'Upload failed')
      await putProfile({ avatar_url: data.url })
      setAvatar(data.url)
      toast({ title: 'Photo updated' })
    } catch (err) {
      toast({ title: 'Could not update photo', description: err instanceof Error ? err.message : 'Please try another image.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError(null)
    if (pwd1.length < 8) return setPwdError('Use at least 8 characters.')
    if (pwd1 !== pwd2) return setPwdError('The two passwords do not match.')
    setChangingPwd(true)
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: pwd1 })
      if (error) throw error
      setPwd1(''); setPwd2('')
      toast({ title: 'Password changed' })
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Could not change the password.')
    } finally {
      setChangingPwd(false)
    }
  }

  const name = fullName || user?.name || user?.email?.split('@')[0] || ''
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Your profile, password and account.</p>
      </div>

      {/* profile */}
      <form onSubmit={saveProfile} className={card}>
        <h2 className="flex items-center gap-2 font-bold"><User className="h-5 w-5 text-orange-600" /> Profile</h2>
        <div className="mt-5 flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-orange-100">
            <AvatarImage src={avatar || undefined} alt="" />
            <AvatarFallback className="bg-orange-500 text-xl font-bold text-white">{initials || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 disabled:opacity-60 dark:bg-neutral-800">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {avatar ? 'Change photo' : 'Add photo'}
            </button>
            <p className="mt-1 text-xs text-neutral-500">JPG, PNG or WebP, up to 5 MB.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} maxLength={100} autoComplete="name" className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} inputMode="tel" autoComplete="tel" placeholder="0712 345 678" maxLength={20} className={field} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 flex items-center gap-1.5 font-semibold"><Mail className="h-4 w-4 text-neutral-400" /> Email</span>
            <input value={user?.email || ''} disabled className={field} />
            <span className="mt-1 block text-xs text-neutral-500">To change your email, <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Change my account email')}`} className="font-semibold text-orange-600 hover:underline">message us</a> from this address.</span>
          </label>
        </div>
        <button disabled={saving || loading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </form>

      {/* password */}
      <form onSubmit={changePassword} className={card}>
        <h2 className="flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5 text-orange-600" /> Password</h2>
        {isGoogle && <p className="mt-2 text-sm text-neutral-500">You sign in with Google. You can also set a password here to sign in with your email.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">New password</span>
            <input type="password" value={pwd1} onChange={(e) => setPwd1(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Confirm new password</span>
            <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" className={field} />
          </label>
        </div>
        {pwdError && <p role="alert" className="mt-3 text-sm text-red-600">{pwdError}</p>}
        <button disabled={changingPwd || !pwd1} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950">
          {changingPwd && <Loader2 className="h-4 w-4 animate-spin" />} Change password
        </button>
      </form>

      {/* emails */}
      <section className={card}>
        <h2 className="flex items-center gap-2 font-bold"><Mail className="h-5 w-5 text-orange-600" /> Emails</h2>
        <p className="mb-4 mt-1 text-sm text-neutral-500">Choose which optional emails you get. Offers and news need a one-click email confirmation.</p>
        <EmailPreferencesForm compact />
      </section>

      {/* delete */}
      <section className={card}>
        <h2 className="flex items-center gap-2 font-bold"><Trash2 className="h-5 w-5 text-red-600" /> Delete account</h2>
        <p className="mt-2 text-sm text-neutral-500">
          We delete your account and personal data when you ask. Order and invoice records are kept only as long as the law requires.
        </p>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Please delete my account')}&body=${encodeURIComponent('Please delete my Honic account for this email address.')}`} className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 dark:ring-red-900 dark:hover:bg-red-950/30">
          Ask us to delete my account
        </a>
      </section>
    </div>
  )
}
