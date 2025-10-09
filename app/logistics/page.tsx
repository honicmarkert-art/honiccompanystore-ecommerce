import { ComingSoonPage } from '@/components/coming-soon-page'
import { Truck } from 'lucide-react'

export default function LogisticsPage() {
  return (
    <ComingSoonPage
      title="Logistics Solutions"
      description="Global shipping and logistics services. Reliable delivery solutions to get your products where they need to go, when they need to be there."
      icon={<Truck className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q2 2024"
      features={[
        "Global shipping network",
        "Express delivery options",
        "Tracking and monitoring",
        "Customs clearance support",
        "Warehouse management",
        "Last-mile delivery solutions"
      ]}
    />
  )
}