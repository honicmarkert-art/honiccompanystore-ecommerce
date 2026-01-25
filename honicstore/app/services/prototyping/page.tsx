import { Cpu } from 'lucide-react'
import { ComingSoonPageClient } from '@/components/coming-soon-page-client'
import { getCompanySettings } from '@/lib/company-settings-server'

// Force static generation with ISR (revalidate every 24 hours)
export const dynamic = 'force-static'
export const revalidate = 86400

export default async function PrototypingPage() {
  const companySettings = await getCompanySettings()
  
  return (
    <ComingSoonPageClient
      title="Project Prototyping"
      description="Custom prototyping services for your innovative ideas. We'll help bring your concepts to life with professional prototyping solutions."
      icon={<Cpu className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "3D printing and rapid prototyping",
        "Custom electronics prototyping",
        "PCB design and manufacturing",
        "Prototype testing and validation",
        "Design consultation and optimization",
        "Small batch production runs"
      ]}
      companyName={companySettings.companyName}
      companyColor={companySettings.companyColor}
    />
  )
}
