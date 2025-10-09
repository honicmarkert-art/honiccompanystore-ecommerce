import { ComingSoonPage } from '@/components/coming-soon-page'
import { ShoppingBag } from 'lucide-react'

export default function BuyerCentralPage() {
  return (
    <ComingSoonPage
      title="Buyer Central"
      description="Your central hub for managing purchases, tracking orders, and accessing buyer tools. Streamline your procurement process with our comprehensive buyer platform."
      icon={<ShoppingBag className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q2 2024"
      features={[
        "Order management dashboard",
        "Purchase history tracking",
        "Supplier relationship tools",
        "Budget and expense tracking",
        "Approval workflows",
        "Reporting and analytics"
      ]}
    />
  )
}




