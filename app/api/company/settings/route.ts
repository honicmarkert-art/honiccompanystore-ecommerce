import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'

const companySettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
  companyTagline: z.string().min(1, 'Company tagline is required'),
  companyLogo: z.string().min(1, 'Company logo is required'),
  websiteUrl: z.string().url('Invalid website URL format').optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean()
  }).optional(),
  apiKeys: z.object({
    googleMaps: z.string().optional(),
    dpoPayment: z.string().optional(),
    stripe: z.string().optional()
  }).optional(),
  security: z.object({
    twoFactorAuth: z.boolean(),
    sessionTimeout: z.number(),
    passwordPolicy: z.string()
  }).optional(),
  performance: z.object({
    cacheEnabled: z.boolean(),
    imageOptimization: z.boolean(),
    cdnEnabled: z.boolean()
  }).optional()
})

export async function GET(request: NextRequest) {
  try {
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
      console.error('Error fetching company settings:', settingsError)
      // Return default settings if no settings exist or table doesn't exist
      return NextResponse.json({
        companyName: 'honiccompanystore',
        companyColor: '#3B82F6',
        companyTagline: 'technology, innovation',
        companyLogo: '/placeholder-logo.png',
        websiteUrl: 'https://honic-co.com',
        contactEmail: 'contact@honic-co.com',
        contactPhone: '+255 123 456 789',
        address: 'Dar es Salaam, Tanzania',
        currency: 'TZS',
        timezone: 'Africa/Dar_es_Salaam',
        language: 'en',
        theme: 'system',
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        apiKeys: {
          googleMaps: 'KNsu7C7EvTn1CgWdh03Af_3NGjs',
          dpoPayment: 'your-dpo-api-key',
          stripe: 'your-stripe-api-key'
        },
        security: {
          twoFactorAuth: false,
          sessionTimeout: 30,
          passwordPolicy: 'strong'
        },
        performance: {
          cacheEnabled: true,
          imageOptimization: true,
          cdnEnabled: false
        }
      })
    }

    // Map database fields to API response format
    const mappedSettings = {
      companyName: settings.company_name || 'honiccompanystore',
      companyColor: settings.company_color || '#3B82F6',
      companyTagline: settings.company_tagline || 'technology, innovation',
      companyLogo: settings.company_logo || '/placeholder-logo.png',
      websiteUrl: settings.website_url || 'https://honic-co.com',
      contactEmail: settings.contact_email || 'contact@honic-co.com',
      contactPhone: settings.contact_phone || '+255 123 456 789',
      address: settings.address || 'Dar es Salaam, Tanzania',
      currency: settings.currency || 'TZS',
      timezone: settings.timezone || 'Africa/Dar_es_Salaam',
      language: settings.language || 'en',
      theme: settings.theme || 'system',
      notifications: settings.notifications || {
        email: true,
        sms: false,
        push: true
      },
      apiKeys: settings.api_keys || {
        googleMaps: 'KNsu7C7EvTn1CgWdh03Af_3NGjs',
        dpoPayment: 'your-dpo-api-key',
        stripe: 'your-stripe-api-key'
      },
      security: settings.security || {
        twoFactorAuth: false,
        sessionTimeout: 30,
        passwordPolicy: 'strong'
      },
      performance: settings.performance || {
        cacheEnabled: true,
        imageOptimization: true,
        cdnEnabled: false
      }
    }

    return NextResponse.json(mappedSettings)

  } catch (error) {
    console.error('Error in company settings GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = companySettingsSchema.parse(body)
    
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

    // Map API fields to database fields
    const dbData: any = {
      company_name: validatedData.companyName,
      company_color: validatedData.companyColor,
      company_tagline: validatedData.companyTagline,
      company_logo: validatedData.companyLogo,
      updated_at: new Date().toISOString()
    }

    // Add optional fields if they exist
    if (validatedData.websiteUrl) dbData.website_url = validatedData.websiteUrl
    if (validatedData.contactEmail) dbData.contact_email = validatedData.contactEmail
    if (validatedData.contactPhone) dbData.contact_phone = validatedData.contactPhone
    if (validatedData.address) dbData.address = validatedData.address
    if (validatedData.currency) dbData.currency = validatedData.currency
    if (validatedData.timezone) dbData.timezone = validatedData.timezone
    if (validatedData.language) dbData.language = validatedData.language
    if (validatedData.theme) dbData.theme = validatedData.theme
    if (validatedData.notifications) dbData.notifications = validatedData.notifications
    if (validatedData.apiKeys) dbData.api_keys = validatedData.apiKeys
    if (validatedData.security) dbData.security = validatedData.security
    if (validatedData.performance) dbData.performance = validatedData.performance

    // Try to update existing record first
    const { data: existingData, error: selectError } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('id', 1)
      .single()

    let updateError
    if (selectError || !existingData) {
      // No existing record, try to insert
      const { error: insertError } = await supabase
        .from('admin_settings')
        .insert({ id: 1, ...dbData })
      
      updateError = insertError
    } else {
      // Update existing record
      const { error: upsertError } = await supabase
        .from('admin_settings')
        .update(dbData)
        .eq('id', 1)
      
      updateError = upsertError
    }

    if (updateError) {
      console.error('Error updating company settings:', updateError)
      return NextResponse.json(
        { error: 'Failed to update company settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Company settings updated successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid company settings data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error in company settings POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
