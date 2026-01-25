import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { validateAdminAccess } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'

// Comprehensive validation schema for all admin settings
const adminSettingsSchema = z.object({
  // Company Branding
  companyName: z.string().min(1, 'Company name is required').optional(),
  companyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  companyTagline: z.string().min(1, 'Company tagline is required').optional(),
  companyLogo: z.string().min(1, 'Company logo is required').optional(),
  mainHeadline: z.string().min(1, 'Main headline is required').optional(),
  heroBackgroundImage: z.string().optional(),
  heroTaglineAlignment: z.enum(['left', 'center', 'right']).optional(),
  
  // Service Images (now supports multiple images)
  serviceRetailImages: z.array(z.string()).optional(),
  servicePrototypingImages: z.array(z.string()).optional(),
  servicePcbImages: z.array(z.string()).optional(),
  serviceAiImages: z.array(z.string()).optional(),
  serviceStemImages: z.array(z.string()).optional(),
  serviceHomeImages: z.array(z.string()).optional(),
  serviceImageRotationTime: z.number().min(3).max(30).optional(),
  
  // Legacy single image support (for backward compatibility)
  serviceRetailImage: z.string().optional(),
  servicePrototypingImage: z.string().optional(),
  servicePcbImage: z.string().optional(),
  serviceAiImage: z.string().optional(),
  serviceStemImage: z.string().optional(),
  
  // Contact Information
  websiteUrl: z.string().url('Invalid website URL format').optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  
  // Localization
  currency: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  
  // Theme Settings
  theme: z.enum(['light', 'dark', 'system']).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  
  // Navigation Settings
  navTranslucent: z.boolean().optional(),
  navOpacity: z.number().min(0).max(1).optional(),
  navTheme: z.enum(['auto', 'light', 'dark']).optional(),
  
  // Footer Settings
  footerTheme: z.enum(['light', 'dark', 'auto']).optional(),
  footerColumns: z.number().min(1).max(6).optional(),
  
  // Product Display Settings
  productsPerRowMobile: z.number().min(1).max(6).optional(),
  productsPerRowTablet: z.number().min(1).max(8).optional(),
  productsPerRowDesktop: z.number().min(1).max(12).optional(),
  productCardSpacing: z.number().min(0).max(20).optional(),
  productCardRadius: z.number().min(0).max(2).optional(),
  
  // Cart Settings
  cartCompactMode: z.boolean().optional(),
  cartItemSpacing: z.number().min(0).max(20).optional(),
  showClearCartButton: z.boolean().optional(),
  showSaveForLater: z.boolean().optional(),
  
  // Mobile Settings
  mobileNavHeight: z.string().optional(),
  mobileFontSize: z.string().optional(),
  mobileCategoryIconsSmall: z.boolean().optional(),
  mobileFooterColumns: z.number().min(1).max(6).optional(),
  
  // JSON Settings
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    orderUpdates: z.boolean(),
    promotional: z.boolean(),
    securityAlerts: z.boolean()
  }).optional(),
  
  // SECURITY: API keys are never returned to client. Only boolean flags indicating if keys are configured.
  apiKeys: z.object({
    googleMaps: z.string().optional(), // Only public key can be returned
    // Server-side keys are never exposed - only boolean flags
    dpoPaymentConfigured: z.boolean().optional(),
    stripeConfigured: z.boolean().optional(),
    emailServiceConfigured: z.boolean().optional(),
    smsServiceConfigured: z.boolean().optional()
  }).optional(),
  
  security: z.object({
    twoFactorAuth: z.boolean(),
    sessionTimeout: z.number(),
    passwordPolicy: z.string(),
    loginAttempts: z.number(),
    lockoutDuration: z.number()
  }).optional(),
  
  performance: z.object({
    cacheEnabled: z.boolean(),
    imageOptimization: z.boolean(),
    cdnEnabled: z.boolean(),
    lazyLoading: z.boolean(),
    preloadCritical: z.boolean()
  }).optional(),
  
  seo: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    metaKeywords: z.string(),
    ogImage: z.string(),
    favicon: z.string()
  }).optional(),
  
  socialLinks: z.object({
    facebook: z.string(),
    instagram: z.string(),
    youtube: z.string()
  }).optional(),
  
  paymentSettings: z.object({
    defaultCurrency: z.string(),
    supportedCurrencies: z.array(z.string()),
    paymentMethods: z.array(z.string()),
    shippingCost: z.number()
  }).optional(),
  
  businessHours: z.object({
    monday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    tuesday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    wednesday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    thursday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    friday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    saturday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    sunday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() })
  }).optional()
})

// SECURITY: Helper function to return only boolean flags for API keys (never actual keys)
function getApiKeysStatus() {
  return {
    googleMaps: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '', // Only public key can be returned
    // Server-side keys are never exposed - only boolean flags
    dpoPaymentConfigured: !!process.env.DPO_PAYMENT_API_KEY,
    stripeConfigured: !!process.env.STRIPE_API_KEY,
    emailServiceConfigured: !!process.env.EMAIL_SERVICE_API_KEY,
    smsServiceConfigured: !!process.env.SMS_SERVICE_API_KEY
  }
}

export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_settings_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/settings',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Check cache
      const cacheKey = 'admin_settings_all'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=300' // 5 minutes cache
          }
        })
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        // Don't try to read the response body - it will be consumed by the return
        // Just log the status code and return the error response
        const errorMessage = authError.status === 403 
          ? 'Admin privileges required' 
          : authError.status === 401 
          ? 'Authentication required'
          : 'Admin authentication failed'
        
        // Only log non-403 errors (403 is expected for non-admin users)
        if (authError.status !== 403) {
          logError(new Error(errorMessage), {
            userId: user?.id,
            action: 'admin_settings_get',
            metadata: {
              endpoint: '/api/admin/settings',
              authErrorStatus: authError.status,
              authErrorStatusText: authError.statusText
            }
          })
        }
        return authError
      }

      // Create Supabase client
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              // This will be handled by the response
            },
            remove(name: string, options: any) {
              // This will be handled by the response
            },
          },
        }
      )

      // Get admin settings from admin_settings table
      
      const { data: settings, error: settingsError } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (settingsError) {
        logError(settingsError, {
          userId: user?.id,
          action: 'admin_settings_get',
          metadata: {
            endpoint: '/api/admin/settings'
          }
        })
        // Return default settings if no settings exist or table doesn't exist
        const defaultSettings = {
          companyName: 'honiccompanystore',
          companyColor: '#3B82F6',
          companyTagline: 'technology, innovation',
          companyLogo: '/android-chrome-512x512.png',
          mainHeadline: 'The leading B2B ecommerce platform for global trade',
          heroBackgroundImage: '',
          heroTaglineAlignment: 'left',
          serviceRetailImage: '',
          servicePrototypingImage: '',
          servicePcbImage: '',
          serviceAiImage: '',
          serviceStemImage: '',
          websiteUrl: process.env.NEXT_PUBLIC_WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://honic-co.com',
          contactEmail: process.env.CONTACT_EMAIL || 'contact@honic-co.com',
          contactPhone: '+255 123 456 789',
          address: 'Dar es Salaam, Tanzania',
          currency: 'TZS',
          timezone: 'Africa/Dar_es_Salaam',
          language: 'en',
          theme: 'system',
          primaryColor: '#3B82F6',
          secondaryColor: '#6B7280',
          accentColor: '#F59E0B',
          navTranslucent: true,
          navOpacity: 0.95,
          navTheme: 'auto',
          footerTheme: 'dark',
          footerColumns: 5,
          productsPerRowMobile: 3,
          productsPerRowTablet: 4,
          productsPerRowDesktop: 5,
          productCardSpacing: 4,
          productCardRadius: 0.5,
          cartCompactMode: true,
          cartItemSpacing: 0,
          showClearCartButton: false,
          showSaveForLater: true,
          mobileNavHeight: 'h-4',
          mobileFontSize: 'text-xs',
          mobileCategoryIconsSmall: true,
          mobileFooterColumns: 3,
          notifications: {
            email: true,
            sms: false,
            push: true,
            orderUpdates: true,
            promotional: false,
            securityAlerts: true
          },
          apiKeys: getApiKeysStatus(),
          security: {
            twoFactorAuth: false,
            sessionTimeout: 30,
            passwordPolicy: 'strong',
            loginAttempts: 5,
            lockoutDuration: 15
          },
          performance: {
            cacheEnabled: true,
            imageOptimization: true,
            cdnEnabled: false,
            lazyLoading: true,
            preloadCritical: true
          },
          seo: {
            metaTitle: 'honiccompanystore - Shopping',
            metaDescription: 'Your trusted source for technology and innovation',
            metaKeywords: 'technology, innovation, electronics, arduino',
            ogImage: '/og-image.png',
            favicon: '/favicon.ico'
          },
          socialLinks: {
            facebook: '',
            instagram: '',
            youtube: ''
          },
          paymentSettings: {
            defaultCurrency: 'TZS',
            supportedCurrencies: ['TZS', 'USD', 'EUR'],
            paymentMethods: ['card', 'mobile_money', 'bank_transfer'],
            shippingCost: 5000
          },
          businessHours: {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '09:00', close: '16:00', closed: false },
            sunday: { open: '10:00', close: '14:00', closed: false }
          }
        }

        // Cache default settings
        setCachedData(cacheKey, defaultSettings, 300000)

        return NextResponse.json(defaultSettings, {
          headers: {
            'X-Cache': 'MISS',
            'Cache-Control': 'private, max-age=300'
          }
        })
      }

      // Map database fields to API response format (see mappedSettings below)
      
      const mappedSettings = {
        companyName: settings.company_name || 'honiccompanystore',
        companyColor: settings.company_color || '#3B82F6',
        companyTagline: settings.company_tagline || 'technology, innovation',
        companyLogo: settings.company_logo || '/android-chrome-512x512.png',
        mainHeadline: settings.main_headline || 'The leading B2B ecommerce platform for global trade',
        heroBackgroundImage: settings.hero_background_image || '',
        heroTaglineAlignment: settings.hero_tagline_alignment || 'left',
        serviceRetailImages: settings.service_retail_images || [],
        servicePrototypingImages: settings.service_prototyping_images || [],
        servicePcbImages: settings.service_pcb_images || [],
        serviceAiImages: settings.service_ai_images || [],
        serviceStemImages: settings.service_stem_images || [],
        serviceHomeImages: settings.service_home_images || [],
        serviceImageRotationTime: settings.service_image_rotation_time || 5,
        // Legacy single image support
        serviceRetailImage: settings.service_retail_image || '',
        servicePrototypingImage: settings.service_prototyping_image || '',
        servicePcbImage: settings.service_pcb_image || '',
        serviceAiImage: settings.service_ai_image || '',
        serviceStemImage: settings.service_stem_image || '',
        websiteUrl: settings.website_url || process.env.NEXT_PUBLIC_WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://honic-co.com',
        contactEmail: settings.contact_email || 'contact@honic-co.com',
        contactPhone: settings.contact_phone || '+255 123 456 789',
        address: settings.address || 'Dar es Salaam, Tanzania',
        currency: settings.currency || 'TZS',
        timezone: settings.timezone || 'Africa/Dar_es_Salaam',
        language: settings.language || 'en',
        theme: settings.theme || 'system',
        primaryColor: settings.primary_color || '#3B82F6',
        secondaryColor: settings.secondary_color || '#6B7280',
        accentColor: settings.accent_color || '#F59E0B',
        navTranslucent: settings.nav_translucent ?? true,
        navOpacity: settings.nav_opacity || 0.95,
        navTheme: settings.nav_theme || 'auto',
        footerTheme: settings.footer_theme || 'dark',
        footerColumns: settings.footer_columns || 5,
        productsPerRowMobile: settings.products_per_row_mobile || 3,
        productsPerRowTablet: settings.products_per_row_tablet || 4,
        productsPerRowDesktop: settings.products_per_row_desktop || 5,
        productCardSpacing: settings.product_card_spacing || 4,
        productCardRadius: settings.product_card_radius || 0.5,
        cartCompactMode: settings.cart_compact_mode ?? true,
        cartItemSpacing: settings.cart_item_spacing || 0,
        showClearCartButton: settings.show_clear_cart_button ?? false,
        showSaveForLater: settings.show_save_for_later ?? true,
        mobileNavHeight: settings.mobile_nav_height || 'h-4',
        mobileFontSize: settings.mobile_font_size || 'text-xs',
        mobileCategoryIconsSmall: settings.mobile_category_icons_small ?? true,
        mobileFooterColumns: settings.mobile_footer_columns || 3,
        notifications: settings.notifications || {
          email: true,
          sms: false,
          push: true,
          orderUpdates: true,
          promotional: false,
          securityAlerts: true
        },
        // SECURITY: Never return actual API keys. Only return status flags.
        // If settings.api_keys exists, merge with current status but never expose actual keys
        apiKeys: settings.api_keys ? {
          ...getApiKeysStatus(),
          // Preserve googleMaps if it was set in database (it's public anyway)
          googleMaps: (settings.api_keys as any)?.googleMaps || getApiKeysStatus().googleMaps
        } : getApiKeysStatus(),
        security: settings.security || {
          twoFactorAuth: false,
          sessionTimeout: 30,
          passwordPolicy: 'strong',
          loginAttempts: 5,
          lockoutDuration: 15
        },
        performance: settings.performance || {
          cacheEnabled: true,
          imageOptimization: true,
          cdnEnabled: false,
          lazyLoading: true,
          preloadCritical: true
        },
        seo: settings.seo || {
          metaTitle: 'honiccompanystore - Shopping',
          metaDescription: 'Your trusted source for technology and innovation',
          metaKeywords: 'technology, innovation, electronics, arduino',
          ogImage: '/og-image.png',
          favicon: '/favicon.ico'
        },
        socialLinks: settings.social_links || {
          facebook: '',
          instagram: '',
          youtube: ''
        },
        paymentSettings: settings.payment_settings || {
          defaultCurrency: 'TZS',
          supportedCurrencies: ['TZS', 'USD', 'EUR'],
          paymentMethods: ['card', 'mobile_money', 'bank_transfer'],
          shippingCost: 5000
        },
        businessHours: settings.business_hours || {
          monday: { open: '09:00', close: '18:00', closed: false },
          tuesday: { open: '09:00', close: '18:00', closed: false },
          wednesday: { open: '09:00', close: '18:00', closed: false },
          thursday: { open: '09:00', close: '18:00', closed: false },
          friday: { open: '09:00', close: '18:00', closed: false },
          saturday: { open: '09:00', close: '16:00', closed: false },
          sunday: { open: '10:00', close: '14:00', closed: false }
        }
      }
      // debug removed
      
      // Cache response (5 minutes TTL)
      setCachedData(cacheKey, mappedSettings, 300000)

      return NextResponse.json(mappedSettings, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=300'
        }
      })

    } catch (error) {
      logError(error, {
        action: 'admin_settings_get',
        metadata: {
          endpoint: '/api/admin/settings'
        }
      })
      
      const message = String((error as any)?.message || '')
      const isNetworkFailure =
        message.includes('ENOTFOUND') ||
        message.includes('fetch failed') ||
        message.includes('getaddrinfo')

      if (isNetworkFailure) {
        // Serve the same safe defaults as above when Supabase is unreachable
        return NextResponse.json({
          companyName: 'honiccompanystore',
          companyColor: '#3B82F6',
          companyTagline: 'technology, innovation',
          companyLogo: '/android-chrome-512x512.png',
          mainHeadline: 'The leading B2B ecommerce platform for global trade',
          heroBackgroundImage: '',
          heroTaglineAlignment: 'left',
          serviceRetailImage: '',
          servicePrototypingImage: '',
          servicePcbImage: '',
          serviceAiImage: '',
          serviceStemImage: '',
          websiteUrl: process.env.NEXT_PUBLIC_WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://honic-co.com',
          contactEmail: process.env.CONTACT_EMAIL || 'contact@honic-co.com',
          contactPhone: '+255 123 456 789',
          address: 'Dar es Salaam, Tanzania',
          currency: 'TZS',
          timezone: 'Africa/Dar_es_Salaam',
          language: 'en',
          theme: 'system',
          primaryColor: '#3B82F6',
          secondaryColor: '#6B7280',
          accentColor: '#F59E0B',
          navTranslucent: true,
          navOpacity: 0.95,
          navTheme: 'auto',
          footerTheme: 'dark',
          footerColumns: 5,
          productsPerRowMobile: 3,
          productsPerRowTablet: 4,
          productsPerRowDesktop: 5,
          productCardSpacing: 4,
          productCardRadius: 0.5,
          cartCompactMode: true,
          cartItemSpacing: 0,
          showClearCartButton: false,
          showSaveForLater: true,
          mobileNavHeight: 'h-4',
          mobileFontSize: 'text-xs',
          mobileCategoryIconsSmall: true,
          mobileFooterColumns: 3,
          notifications: {
            email: true,
            sms: false,
            push: true,
            orderUpdates: true,
            promotional: false,
            securityAlerts: true
          },
          apiKeys: getApiKeysStatus(),
          security: {
            twoFactorAuth: false,
            sessionTimeout: 30,
            passwordPolicy: 'strong',
            loginAttempts: 5,
            lockoutDuration: 15
          },
          performance: {
            cacheEnabled: true,
            imageOptimization: true,
            cdnEnabled: false,
            lazyLoading: true,
            preloadCritical: true
          },
          seo: {
            metaTitle: 'honiccompanystore - Shopping',
            metaDescription: 'Your trusted source for technology and innovation',
            metaKeywords: 'technology, innovation, electronics, arduino',
            ogImage: '/og-image.png',
            favicon: '/favicon.ico'
          },
          socialLinks: {
            facebook: '',
            instagram: '',
            youtube: ''
          },
          paymentSettings: {
            defaultCurrency: 'TZS',
            supportedCurrencies: ['TZS', 'USD', 'EUR'],
            paymentMethods: ['card', 'mobile_money', 'bank_transfer'],
            shippingCost: 5000
          },
          businessHours: {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '09:00', close: '16:00', closed: false },
            sunday: { open: '10:00', close: '14:00', closed: false }
          }
        })
      }

      return createErrorResponse(error, 500)
    }
  })
}

export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_settings_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/settings',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        // Don't try to read the response body - it will be consumed by the return
        // Just log the status code and return the error response
        const errorMessage = authError.status === 403 
          ? 'Admin privileges required' 
          : authError.status === 401 
          ? 'Authentication required'
          : 'Admin authentication failed'
        
        // Only log non-403 errors (403 is expected for non-admin users)
        if (authError.status !== 403) {
          logError(new Error(errorMessage), {
            userId: user?.id,
            action: 'admin_settings_post',
            metadata: {
              endpoint: '/api/admin/settings',
              authErrorStatus: authError.status,
              authErrorStatusText: authError.statusText
            }
          })
        }
        return authError
      }

      const body = await request.json()
    
    // Validate input
    let validatedData
    try {
      logger.log('📤 Received settings update:', JSON.stringify(body, null, 2))
      validatedData = adminSettingsSchema.parse(body)
      logger.log('✅ Validation passed')
    } catch (validationError) {
      logger.error('Validation error:', validationError)
      logger.error('Request body:', JSON.stringify(body, null, 2))
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationError instanceof Error ? validationError.message : 'Unknown validation error',
        requestBody: body
      }, { status: 400 })
    }
    
    // Create Supabase client with service role for admin operations
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // This will be handled by the response
          },
          remove(name: string, options: any) {
            // This will be handled by the response
          },
        },
      }
    )

    // Map API fields to database fields
    const dbData: any = {
      updated_at: new Date().toISOString()
    }

    // Map all possible fields
    if (validatedData.companyName !== undefined) dbData.company_name = validatedData.companyName
    if (validatedData.companyColor !== undefined) dbData.company_color = validatedData.companyColor
    if (validatedData.companyTagline !== undefined) dbData.company_tagline = validatedData.companyTagline
    if (validatedData.companyLogo !== undefined) dbData.company_logo = validatedData.companyLogo
    
    // Handle new columns gracefully (temporary fix until database is updated)
    if (validatedData.mainHeadline !== undefined) {
      try {
        dbData.main_headline = validatedData.mainHeadline
      } catch (error) {
        logger.log('⚠️ main_headline column not available, skipping update')
      }
    }
    if (validatedData.heroBackgroundImage !== undefined) {
      try {
        
        dbData.hero_background_image = validatedData.heroBackgroundImage
      } catch (error) {
        logger.log('⚠️ hero_background_image column not available, skipping update')
      }
    }
    // Hero tagline alignment - ENABLED AFTER SQL MIGRATION
    if (validatedData.heroTaglineAlignment !== undefined) {
      dbData.hero_tagline_alignment = validatedData.heroTaglineAlignment
    }
    // Service Images - Multiple images support
    try {
      if (validatedData.serviceRetailImages !== undefined) {
        dbData.service_retail_images = validatedData.serviceRetailImages
      }
      if (validatedData.servicePrototypingImages !== undefined) {
        dbData.service_prototyping_images = validatedData.servicePrototypingImages
      }
      if (validatedData.servicePcbImages !== undefined) {
        dbData.service_pcb_images = validatedData.servicePcbImages
      }
      if (validatedData.serviceAiImages !== undefined) {
        dbData.service_ai_images = validatedData.serviceAiImages
      }
      if (validatedData.serviceStemImages !== undefined) {
        dbData.service_stem_images = validatedData.serviceStemImages
      }
      if (validatedData.serviceHomeImages !== undefined) {
        dbData.service_home_images = validatedData.serviceHomeImages
      }
      if (validatedData.serviceImageRotationTime !== undefined) {
        dbData.service_image_rotation_time = validatedData.serviceImageRotationTime
      }
      
      // Legacy single image support (backward compatibility)
      if (validatedData.serviceRetailImage !== undefined) {
        dbData.service_retail_image = validatedData.serviceRetailImage
      }
      if (validatedData.servicePrototypingImage !== undefined) {
        dbData.service_prototyping_image = validatedData.servicePrototypingImage
      }
      if (validatedData.servicePcbImage !== undefined) {
        dbData.service_pcb_image = validatedData.servicePcbImage
      }
      if (validatedData.serviceAiImage !== undefined) {
        dbData.service_ai_image = validatedData.serviceAiImage
      }
      if (validatedData.serviceStemImage !== undefined) {
        dbData.service_stem_image = validatedData.serviceStemImage
      }
    } catch (error) {
      logger.log('⚠️ Service image columns may not exist in database, continuing without them')
    }
    if (validatedData.websiteUrl !== undefined) dbData.website_url = validatedData.websiteUrl
    if (validatedData.contactEmail !== undefined) dbData.contact_email = validatedData.contactEmail
    if (validatedData.contactPhone !== undefined) dbData.contact_phone = validatedData.contactPhone
    if (validatedData.address !== undefined) dbData.address = validatedData.address
    if (validatedData.currency !== undefined) dbData.currency = validatedData.currency
    if (validatedData.timezone !== undefined) dbData.timezone = validatedData.timezone
    if (validatedData.language !== undefined) dbData.language = validatedData.language
    if (validatedData.theme !== undefined) dbData.theme = validatedData.theme
    if (validatedData.primaryColor !== undefined) dbData.primary_color = validatedData.primaryColor
    if (validatedData.secondaryColor !== undefined) dbData.secondary_color = validatedData.secondaryColor
    if (validatedData.accentColor !== undefined) dbData.accent_color = validatedData.accentColor
    if (validatedData.navTranslucent !== undefined) dbData.nav_translucent = validatedData.navTranslucent
    if (validatedData.navOpacity !== undefined) dbData.nav_opacity = validatedData.navOpacity
    if (validatedData.navTheme !== undefined) dbData.nav_theme = validatedData.navTheme
    if (validatedData.footerTheme !== undefined) dbData.footer_theme = validatedData.footerTheme
    if (validatedData.footerColumns !== undefined) dbData.footer_columns = validatedData.footerColumns
    if (validatedData.productsPerRowMobile !== undefined) dbData.products_per_row_mobile = validatedData.productsPerRowMobile
    if (validatedData.productsPerRowTablet !== undefined) dbData.products_per_row_tablet = validatedData.productsPerRowTablet
    if (validatedData.productsPerRowDesktop !== undefined) dbData.products_per_row_desktop = validatedData.productsPerRowDesktop
    if (validatedData.productCardSpacing !== undefined) dbData.product_card_spacing = validatedData.productCardSpacing
    if (validatedData.productCardRadius !== undefined) dbData.product_card_radius = validatedData.productCardRadius
    if (validatedData.cartCompactMode !== undefined) dbData.cart_compact_mode = validatedData.cartCompactMode
    if (validatedData.cartItemSpacing !== undefined) dbData.cart_item_spacing = validatedData.cartItemSpacing
    if (validatedData.showClearCartButton !== undefined) dbData.show_clear_cart_button = validatedData.showClearCartButton
    if (validatedData.showSaveForLater !== undefined) dbData.show_save_for_later = validatedData.showSaveForLater
    if (validatedData.mobileNavHeight !== undefined) dbData.mobile_nav_height = validatedData.mobileNavHeight
    if (validatedData.mobileFontSize !== undefined) dbData.mobile_font_size = validatedData.mobileFontSize
    if (validatedData.mobileCategoryIconsSmall !== undefined) dbData.mobile_category_icons_small = validatedData.mobileCategoryIconsSmall
    if (validatedData.mobileFooterColumns !== undefined) dbData.mobile_footer_columns = validatedData.mobileFooterColumns
    if (validatedData.notifications !== undefined) dbData.notifications = validatedData.notifications
    // SECURITY: Only allow updating public API keys (googleMaps) and boolean flags
    // Never allow saving server-side API keys (DPO, Stripe, Email, SMS)
    if (validatedData.apiKeys !== undefined) {
      const safeApiKeys: any = {}
      // Only allow updating googleMaps (public key)
      if ((validatedData.apiKeys as any)?.googleMaps !== undefined) {
        safeApiKeys.googleMaps = (validatedData.apiKeys as any).googleMaps
      }
      // Preserve boolean flags but never allow setting them to true if keys don't exist
      // These are read-only and determined by environment variables
      const currentStatus = getApiKeysStatus()
      safeApiKeys.dpoPaymentConfigured = currentStatus.dpoPaymentConfigured
      safeApiKeys.stripeConfigured = currentStatus.stripeConfigured
      safeApiKeys.emailServiceConfigured = currentStatus.emailServiceConfigured
      safeApiKeys.smsServiceConfigured = currentStatus.smsServiceConfigured
      dbData.api_keys = safeApiKeys
    }
    if (validatedData.security !== undefined) dbData.security = validatedData.security
    if (validatedData.performance !== undefined) dbData.performance = validatedData.performance
    if (validatedData.seo !== undefined) dbData.seo = validatedData.seo
    if (validatedData.socialLinks !== undefined) dbData.social_links = validatedData.socialLinks
    if (validatedData.paymentSettings !== undefined) dbData.payment_settings = validatedData.paymentSettings
    if (validatedData.businessHours !== undefined) dbData.business_hours = validatedData.businessHours

    // Try to update existing record first
    const { data: existingData, error: selectError } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('id', 1)
      .single()

    logger.log('💾 Database data to save:', JSON.stringify(dbData, null, 2))
    let updateError
    if (selectError || !existingData) {
      logger.log('📝 Inserting new record')
      // No existing record, try to insert
      const { error: insertError } = await supabase
        .from('admin_settings')
        .insert({ id: 1, ...dbData })
      
      updateError = insertError
    } else {
      logger.log('🔄 Updating existing record')
      // Update existing record
      const { error: upsertError } = await supabase
        .from('admin_settings')
        .update(dbData)
        .eq('id', 1)
      
      updateError = upsertError
    }

      if (updateError) {
        logError(updateError, {
          userId: user?.id,
          action: 'admin_settings_post',
          metadata: {
            endpoint: '/api/admin/settings'
          }
        })
        return createErrorResponse(updateError, 500)
      }

    

    // Re-select to verify persistence and return the final stored value
    const { data: verifyRow, error: verifyError } = await supabase
      .from('admin_settings')
      .select('hero_background_image, updated_at')
      .eq('id', 1)
      .single()

    if (verifyError) {
      logger.warn('Verification select failed:', verifyError)
    } else {
      
      if (dbData.hero_background_image && verifyRow?.hero_background_image !== dbData.hero_background_image) {
        logger.warn('Mismatch after update:', {
          attempted: dbData.hero_background_image,
          stored: verifyRow?.hero_background_image
        })
      }
    }

      // Clear cache
      setCachedData('admin_settings_all', null, 0)

      // Log admin action
      logSecurityEvent('ADMIN_SETTINGS_UPDATED', {
        userId: user?.id,
        endpoint: '/api/admin/settings'
      }, request)

      return NextResponse.json({
        success: true,
        message: 'Admin settings updated successfully',
        heroBackgroundImage: verifyRow?.hero_background_image ?? dbData.hero_background_image
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid admin settings data', details: error.errors },
          { status: 400 }
        )
      }

      logError(error, {
        action: 'admin_settings_post',
        metadata: {
          endpoint: '/api/admin/settings'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
