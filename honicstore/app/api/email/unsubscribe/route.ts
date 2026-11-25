import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { normEmail, verifyEmailToken } from '@/lib/email-links'
import { OPTIONAL_CATEGORIES, setPreferences, unsubscribeMarketing, type OptionalCategory } from '@/lib/email-consent'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One-click unsubscribe (RFC 8058), used by the List-Unsubscribe header in every optional email:
 *   POST /api/email/unsubscribe?e=&t=&c=   (mail apps send "List-Unsubscribe=One-Click")
 *   GET  same URL -> opens the preference page (never changes anything on a GET)
 */
function read(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const email = normEmail(sp.get('e') || '')
  const token = sp.get('t') || ''
  const c = (sp.get('c') || 'marketing') as OptionalCategory
  return { email, token, category: OPTIONAL_CATEGORIES.includes(c) ? c : 'marketing' as OptionalCategory }
}

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return new NextResponse('Too many requests', { status: 429 })
  const { email, token, category } = read(request)
  if (!verifyEmailToken('prefs', email, token)) return new NextResponse('Invalid link', { status: 400 })
  try {
    if (category === 'marketing') await unsubscribeMarketing(email)
    else await setPreferences(email, { [category]: false })
    return new NextResponse('Unsubscribed', { status: 200 })
  } catch (error) {
    logger.error('One-click unsubscribe failed:', error)
    return new NextResponse('Could not unsubscribe right now', { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { email, token, category } = read(request)
  const url = new URL('/email-preferences', request.nextUrl.origin)
  url.searchParams.set('e', email); url.searchParams.set('t', token); url.searchParams.set('c', category)
  return NextResponse.redirect(url)
}
