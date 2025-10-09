import { ComingSoonPage } from '@/components/coming-soon-page'
import { CircuitBoard } from 'lucide-react'

export default function PcbPage() {
  return (
    <ComingSoonPage
      title="PCB Printing"
      description="Professional PCB design and printing services. From concept to production, we'll help you create high-quality printed circuit boards."
      icon={<CircuitBoard className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "Custom PCB design and layout",
        "Multi-layer PCB manufacturing",
        "Surface mount technology (SMT)",
        "Through-hole assembly",
        "Quality testing and inspection",
        "Bulk production capabilities"
      ]}
    />
  )
}




