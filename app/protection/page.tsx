import { ComingSoonPage } from '@/components/coming-soon-page'
import { Shield } from 'lucide-react'

export default function ProtectionPage() {
  return (
    <ComingSoonPage
      title="Order Protections"
      description="Comprehensive order protection and buyer assurance programs. Shop with confidence knowing your transactions are secure and protected."
      icon={<Shield className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q2 2024"
      features={[
        "Buyer protection guarantee",
        "Secure payment processing",
        "Dispute resolution system",
        "Quality assurance programs",
        "Refund and return policies",
        "Insurance coverage options"
      ]}
    />
  )
}




