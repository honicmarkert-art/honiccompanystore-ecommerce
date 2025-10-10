import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { SECURITY_CONFIG, UserSession } from './security-shared'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

let cachedAdminClient: SupabaseClient | null = null
function getAdmin(): SupabaseClient | null {
	if (!supabaseUrl || !supabaseServiceKey) return null
	if (!cachedAdminClient) {
		cachedAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		})
	}
	return cachedAdminClient
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export async function validateMiddlewareSession(request: NextRequest): Promise<UserSession | null> {
	try {
		const accessToken = request.cookies.get('sb-access-token')?.value
		if (!accessToken) return null

		const admin = getAdmin()
		if (!admin) return null
		const { data: { user }, error } = await admin.auth.getUser(accessToken)
		if (error || !user) return null

		const { data: profile } = await admin
			.from('profiles')
			.select('*')
			.eq('id', user.id)
			.single()

		return {
			id: user.id,
			email: user.email || '',
			role: profile?.is_admin ? 'admin' : 'user',
			isAuthenticated: true,
			profile
		}
	} catch (error) {
		console.error('Middleware session validation error:', error)
		return null
	}
}

export function checkRateLimit(identifier: string): boolean {
	const now = Date.now()
	const current = rateLimitStore.get(identifier)
	if (!current || current.resetTime < now) {
		rateLimitStore.set(identifier, { count: 1, resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW })
		return true
	}
	if (current.count >= SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS) return false
	current.count += 1
	return true
}

































