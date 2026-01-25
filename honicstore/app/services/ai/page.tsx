import { Bot } from 'lucide-react'
import { ComingSoonPageClient } from '@/components/coming-soon-page-client'
import { getCompanySettings } from '@/lib/company-settings-server'

// Force static generation with ISR (revalidate every 24 hours)
export const dynamic = 'force-static'
export const revalidate = 86400

export default async function AiPage() {
  const companySettings = await getCompanySettings()
  
  return (
    <ComingSoonPageClient
      title="AI Consultancy"
      description="AI-powered project guidance and support. Get expert advice on integrating artificial intelligence into your projects and business solutions."
      icon={<Bot className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q3 2024"
      features={[
        "AI project consultation and planning",
        "Machine learning model development",
        "AI integration services",
        "Data analysis and insights",
        "Custom AI solutions",
        "Training and support"
      ]}
      companyName={companySettings.companyName}
      companyColor={companySettings.companyColor}
    />
  )
}
