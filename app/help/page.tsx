import { ComingSoonPage } from '@/components/coming-soon-page'
import { HelpCircle } from 'lucide-react'

export default function HelpPage() {
  return (
    <ComingSoonPage
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
    />
  )
}




