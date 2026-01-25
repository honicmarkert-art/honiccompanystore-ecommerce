import { CircuitBoard } from 'lucide-react'
import { ComingSoonPageClient } from '@/components/coming-soon-page-client'
import { getCompanySettings } from '@/lib/company-settings-server'

// Force static generation with ISR (revalidate every 24 hours)
export const dynamic = 'force-static'
export const revalidate = 86400

export default async function PcbPage() {
  const companySettings = await getCompanySettings()
  
  return (
    <ComingSoonPageClient
      title="PCB Printing"
      description="Professional PCB design and printing services. From concept to production, we'll help you create high-quality printed circuit boards."
      icon={<CircuitBoard className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "Custom PCB design and layout",
        "Multi-layer PCB manufacturing",
        "Surface mount technology (SMT)",
        "Through-hole assembly",
        "Quality testing and inspection",
        "Bulk production capabilities"
      ]}
      companyName={companySettings.companyName}
      companyColor={companySettings.companyColor}
    />
  )
}
