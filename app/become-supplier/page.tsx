import { ComingSoonPage } from '@/components/coming-soon-page'
import { Users } from 'lucide-react'

export default function BecomeSupplierPage() {
  return (
    <ComingSoonPage
      title="Become Supplier/Seller"
      description="Join our marketplace as a supplier and start selling your products to customers worldwide. Expand your business reach with our global platform."
      icon={<Users className="w-10 h-10 text-white" />}
      category="Marketplace"
      estimatedLaunch="Q2 2024"
      features={[
        "Easy supplier registration process",
        "Global marketplace access",
        "Secure payment processing",
        "Order management tools",
        "Marketing and promotion support",
        "24/7 customer support"
      ]}
    />
  )
}




