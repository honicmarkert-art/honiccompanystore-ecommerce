/** Server helper: is the caller a signed-in admin? (profiles.is_admin, checked with the service client) */
import type { NextRequest } from 'next/server'
import { validateAuth } from '@/lib/auth-server'
import { getSupabaseClient } from '@/lib/supabase-server'

export async function requireAdmin(request: NextRequest): Promise<{ userId: string } | null> {
  const { user } = await validateAuth(request).catch(() => ({ user: null }))
  if (!user) return null
  const { data } = await getSupabaseClient().from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return data?.is_admin ? { userId: user.id } : null
}
