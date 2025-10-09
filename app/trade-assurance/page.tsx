import { ComingSoonPage } from '@/components/coming-soon-page'
import { FileText } from 'lucide-react'

export default function TradeAssurancePage() {
  return (
    <ComingSoonPage
      title="Trade Assurance"
      description="Quality guaranteed with trade assurance. Our comprehensive trade assurance program ensures quality, delivery, and satisfaction for all your transactions."
      icon={<FileText className="w-10 h-10 text-white" />}
      category="Feature"
      estimatedLaunch="Q2 2024"
      features={[
        "Quality guarantee programs",
        "Delivery assurance",
        "Satisfaction guarantee",
        "Trade dispute resolution",
        "Supplier verification",
        "Performance monitoring"
      ]}
    />
  )
}




