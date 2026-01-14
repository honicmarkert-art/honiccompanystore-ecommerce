import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Export function to clear cache (used by admin routes)
export function clearSupplierPlansCache() {
  cache.delete('supplier-plans')
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting (public endpoint, but still limit to prevent abuse)
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier-plans',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    const cacheKey = 'supplier-plans'
    const cached = cache.get(cacheKey)
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'HIT'
        }
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch all active plans with their features
    const { data: plans, error: plansError } = await supabase
      .from('supplier_plans')
      .select(`
        *,
        supplier_plan_features (
          id,
          feature_name,
          feature_description,
          is_included,
          display_order
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (plansError) {
      return NextResponse.json(
        { error: 'Failed to fetch supplier plans' },
        { status: 500 }
      )
    }

    // Transform the data to include sorted features with deduplication
    const transformedPlans = (plans || []).map((plan: any) => {
      // Deduplicate features by feature_name
      const seenFeatures = new Set<string>()
      const uniqueFeatures = (plan.supplier_plan_features || [])
        .filter((feature: any) => {
          if (!feature.is_included) return false
          // Check if we've seen this feature name before
          if (seenFeatures.has(feature.feature_name)) {
            return false
          }
          seenFeatures.add(feature.feature_name)
          return true
        })
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((feature: any) => ({
          name: feature.feature_name,
          description: feature.feature_description
        }))
      
      return {
        ...plan,
        features: uniqueFeatures
      }
    })

    const responseData = {
      success: true,
      plans: transformedPlans
    }

    // Cache the response
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    })

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

