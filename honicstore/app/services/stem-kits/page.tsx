import { GraduationCap } from 'lucide-react'
import { ComingSoonPageClient } from '@/components/coming-soon-page-client'
import { getCompanySettings } from '@/lib/company-settings-server'

// Force static generation with ISR (revalidate every 24 hours)
export const dynamic = 'force-static'
export const revalidate = 86400

export default async function StemKitsPage() {
  const companySettings = await getCompanySettings()
  
  return (
    <ComingSoonPageClient
      title="STEM Training Kits"
      description="Educational STEM kits and training programs. Comprehensive learning solutions for students and educators in science, technology, engineering, and mathematics."
      icon={<GraduationCap className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "Complete STEM curriculum kits",
        "Hands-on learning projects",
        "Educational resources and guides",
        "Teacher training programs",
        "Student assessment tools",
        "Custom curriculum development"
      ]}
      companyName={companySettings.companyName}
      companyColor={companySettings.companyColor}
    />
  )
}
