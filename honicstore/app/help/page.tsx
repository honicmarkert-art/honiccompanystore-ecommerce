import { HelpCircle } from 'lucide-react'
import { ComingSoonPageClient } from '@/components/coming-soon-page-client'
import { getCompanySettings } from '@/lib/company-settings-server'

// Force static generation with ISR (revalidate every 24 hours)
export const dynamic = 'force-static'
export const revalidate = 86400

export default async function HelpPage() {
  const companySettings = await getCompanySettings()
  
  return (
    <ComingSoonPageClient
      title="Help Center"
      description="Comprehensive help and support resources. Find answers to your questions and get the assistance you need to make the most of our platform."
      icon={<HelpCircle className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q2 2024"
      features={[
        "Knowledge base and FAQs",
        "Video tutorials and guides",
        "Live chat support",
        "Community forums",
        "Technical documentation",
        "24/7 customer support"
      ]}
      companyName={companySettings.companyName}
      companyColor={companySettings.companyColor}
    />
  )
}
