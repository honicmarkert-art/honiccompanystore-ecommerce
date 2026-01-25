import { getSupabaseClient } from './supabase-server'

export interface CompanySettings {
  companyName: string
  companyColor: string
  companyLogo: string
  companyTagline?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
}

/**
 * Fetch company settings server-side for static generation
 * Used in static pages that need company information
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('admin_settings')
      .select('company_name, company_color, company_logo, company_tagline, contact_email, contact_phone, address')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // Return defaults if error (except "not found" which is handled below)
      return getDefaultSettings()
    }

    return {
      companyName: data?.company_name || 'Honic',
      companyColor: data?.company_color || '#3B82F6',
      companyLogo: data?.company_logo || '/android-chrome-512x512.png',
      companyTagline: data?.company_tagline || '',
      contactEmail: data?.contact_email || '',
      contactPhone: data?.contact_phone || '',
      address: data?.address || ''
    }
  } catch (error) {
    // Return defaults on any error
    return getDefaultSettings()
  }
}

function getDefaultSettings(): CompanySettings {
  return {
    companyName: 'Honic',
    companyColor: '#3B82F6',
    companyLogo: '/android-chrome-512x512.png',
    companyTagline: '',
    contactEmail: '',
    contactPhone: '',
    address: ''
  }
}
