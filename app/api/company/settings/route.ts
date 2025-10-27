import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 30 // Max 30 requests per minute per IP
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const key = ip
  const current = requestCounts.get(key)
  
  if (!current || now > current.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (current.count >= RATE_LIMIT) {
    return false
  }
  
  current.count++
  return true
}

// GET - Fetch public company settings (no authentication required)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.' 
      }, { 
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      })
    }

    // Fetch only public company settings
    const { data, error } = await supabase
      .from('admin_settings')
      .select(`
        company_name,
        company_color,
        company_logo,
        main_headline,
        hero_background_image,
        hero_tagline_alignment,
        service_retail_images,
        service_prototyping_images,
        service_pcb_images,
        service_ai_images,
        service_stem_images,
        service_home_images,
        service_image_rotation_time,
        service_retail_image,
        service_prototyping_image,
        service_pcb_image,
        service_ai_image,
        service_stem_image,
        website_url,
        contact_email,
        contact_phone,
        address,
        currency,
        timezone,
        language,
        theme,
        primary_color,
        secondary_color,
        accent_color
      `)
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.log('Error fetching public company settings:', error)
      return NextResponse.json({ error: 'Failed to fetch company settings' }, { status: 500 })
    }

    // Return public settings with defaults
    const publicSettings = {
      companyName: data?.company_name || 'Your Company',
      companyColor: data?.company_color || '#3B82F6',
      companyLogo: data?.company_logo || '/android-chrome-512x512.png',
      mainHeadline: data?.main_headline || 'Welcome to Our Store',
      heroBackgroundImage: data?.hero_background_image || '',
      heroTaglineAlignment: data?.hero_tagline_alignment || 'center',
      serviceRetailImages: data?.service_retail_images || [],
      servicePrototypingImages: data?.service_prototyping_images || [],
      servicePcbImages: data?.service_pcb_images || [],
      serviceAiImages: data?.service_ai_images || [],
      serviceStemImages: data?.service_stem_images || [],
      serviceHomeImages: data?.service_home_images || [],
      serviceImageRotationTime: data?.service_image_rotation_time || 10,
      // Legacy single image support
      serviceRetailImage: data?.service_retail_image || '',
      servicePrototypingImage: data?.service_prototyping_image || '',
      servicePcbImage: data?.service_pcb_image || '',
      serviceAiImage: data?.service_ai_image || '',
      serviceStemImage: data?.service_stem_image || '',
      // Contact info
      websiteUrl: data?.website_url || '',
      contactEmail: data?.contact_email || '',
      contactPhone: data?.contact_phone || '',
      address: data?.address || '',
      // Localization
      currency: data?.currency || 'TZS',
      timezone: data?.timezone || 'Africa/Dar_es_Salaam',
      language: data?.language || 'en',
      // Theme
      theme: data?.theme || 'light',
      primaryColor: data?.primary_color || '#3B82F6',
      secondaryColor: data?.secondary_color || '#64748B',
      accentColor: data?.accent_color || '#F59E0B'
    }

    // Set appropriate cache headers
    return NextResponse.json(publicSettings, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Public-Settings': 'true'
      }
    })

  } catch (error) {
    logger.log('Error in public company settings API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}