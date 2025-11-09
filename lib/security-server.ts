import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { SECURITY_CONFIG, UserSession } from './security-shared'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

let cachedAdminClient: SupabaseClient | null = null
export function supabaseAdmin(): SupabaseClient | null {
	if (!supabaseUrl || !supabaseServiceKey) return null
	// Clear cache to force recreation with new headers
	cachedAdminClient = null
	if (!cachedAdminClient) {
		cachedAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
			auth: { autoRefreshToken: false, persistSession: false },
			global: {
				headers: {
					'apikey': supabaseServiceKey,
					'Authorization': `Bearer ${supabaseServiceKey}`
				},
				fetch: (url, options = {}) => {
					// Add custom fetch configuration to handle Node.js HTTPS issues
					return fetch(url, {
						...options,
						keepalive: true,
						headers: {
							...options.headers,
							'apikey': supabaseServiceKey,
							'Authorization': `Bearer ${supabaseServiceKey}`,
							'User-Agent': 'aliexpress-clone/1.0',
							'Accept': 'application/json',
							'Connection': 'keep-alive'
						}
					})
				}
			}
		})
	}
	return cachedAdminClient
}

// In-memory rate limiter store (replace with Redis in prod)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export async function validateServerSession(_request: NextRequest): Promise<UserSession | null> {
	try {
		console.log('🔍 [DEBUG] validateServerSession: Starting validation...')
		
		const cookieStore = await cookies()
		
		// Try to get access token - check both possible cookie names
		let accessToken = cookieStore.get('sb-access-token')?.value
		
			// If not found, try extracting from the full auth token cookie
			if (!accessToken) {
				// Derive cookie name from Supabase URL
				const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
				const projectRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
				const authCookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
				const authTokenCookie = cookieStore.get(authCookieName)?.value
				
				if (authTokenCookie) {
					try {
						// Check if it starts with 'base64-' and extract the actual base64 string
						let base64String = authTokenCookie
						if (authTokenCookie.startsWith('base64-')) {
							base64String = authTokenCookie.substring(7) // Remove 'base64-' prefix
						}
						
						// Decode from Base64
						const decoded = Buffer.from(base64String, 'base64').toString('utf-8')
						const parsed = JSON.parse(decoded)
						accessToken = parsed.access_token
						console.log('✅ Successfully extracted access token from auth token cookie')
					} catch (e) {
						console.log('❌ Could not extract access token:', e)
					}
				}
			}
		
		console.log('🔍 [DEBUG] validateServerSession: Access token found:', !!accessToken)
		
		if (!accessToken) {
			console.log('❌ [DEBUG] validateServerSession: No access token found')
			return null
		}

		// Use regular Supabase client for user authentication (not admin client)
		const { createClient } = await import('@supabase/supabase-js')
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
		const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		
		if (!supabaseUrl || !supabaseAnonKey) {
			console.log('❌ [DEBUG] validateServerSession: Missing Supabase env vars')
			return null
		}
		
		const supabase = createClient(supabaseUrl, supabaseAnonKey)
		console.log('🔍 [DEBUG] validateServerSession: Regular client created:', !!supabase)
		
		console.log('🔍 [DEBUG] validateServerSession: Getting user from token...')
		const { data: { user }, error } = await supabase.auth.getUser(accessToken)
		console.log('🔍 [DEBUG] validateServerSession: User validation result:', {
			hasUser: !!user,
			userId: user?.id,
			userEmail: user?.email,
			error: error?.message
		})
		
		if (error || !user) {
			console.log('❌ [DEBUG] validateServerSession: User validation failed:', error?.message)
			return null
		}

		// Use admin client only for profile fetch (database operations)
		const admin = supabaseAdmin()
		console.log('🔍 [DEBUG] validateServerSession: Admin client for profile:', !!admin)
		if (!admin) {
			console.log('❌ [DEBUG] validateServerSession: Failed to create admin client for profile')
			return null
		}

		console.log('🔍 [DEBUG] validateServerSession: Fetching profile...')
		const { data: profile, error: profileError } = await admin
			.from('profiles')
			.select('*')
			.eq('id', user.id)
			.single()
			
		// Handle case where profile is returned as array instead of single object
		const profileData = Array.isArray(profile) ? profile[0] : profile
		
		console.log('🔍 [DEBUG] validateServerSession: Profile fetch result:', {
			hasProfile: !!profileData,
			profileId: profileData?.id,
			isAdmin: profileData?.is_admin,
			profileError: profileError?.message,
			fullProfile: profileData
		})

		const result: UserSession = {
			id: user.id,
			email: user.email || '',
			role: profileData?.is_admin ? 'admin' : 'user',
			isAuthenticated: true,
			profile: profileData
		}
		
		console.log('✅ [DEBUG] validateServerSession: Session validated successfully:', {
			userId: result.id,
			email: result.email,
			role: result.role,
			isAdmin: profileData?.is_admin
		})
		
		return result
	} catch (error) {
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

































