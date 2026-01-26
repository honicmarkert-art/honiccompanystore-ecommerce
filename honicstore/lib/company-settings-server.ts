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
  // Return defaults - no admin access to database
  return getDefaultSettings()
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
