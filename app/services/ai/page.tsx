import { ComingSoonPage } from '@/components/coming-soon-page'
import { Bot } from 'lucide-react'

export default function AiPage() {
  return (
    <ComingSoonPage
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
    />
  )
}




