import { ComingSoonPage } from '@/components/coming-soon-page'
import { Shield } from 'lucide-react'

export default function OrderProtectionPage() {
  return (
    <ComingSoonPage
      title="Order Protection"
      description="Secure transactions and buyer protection. Shop with confidence knowing your orders are protected by our comprehensive security and guarantee programs."
      icon={<Shield className="w-10 h-10 text-white" />}
      category="Feature"
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




