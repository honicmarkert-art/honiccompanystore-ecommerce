import { NextRequest, NextResponse } from 'next/server'
import { validateAuth, getUserAndRole } from '@/lib/auth-server'
import { getRateLimitBackendStatus } from '@/lib/enhanced-rate-limit'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { user, error: authError } = await validateAuth(request)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { role } = await getUserAndRole(user.id)
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = await getRateLimitBackendStatus()
  return NextResponse.json({
    ok: status.healthy,
    backend: status.backend,
    configured: status.configured,
    reason: status.reason ?? null,
  })
}
