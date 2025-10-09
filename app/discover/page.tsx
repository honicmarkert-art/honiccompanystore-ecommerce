import { ComingSoonPage } from '@/components/coming-soon-page'
import { Eye } from 'lucide-react'

export default function DiscoverPage() {
  return (
    <ComingSoonPage
      title="Discovery"
      description="Explore and discover new products, suppliers, and opportunities. Our discovery platform helps you find exactly what you're looking for."
      icon={<Eye className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q2 2024"
      features={[
        "Advanced search and filtering",
        "Product discovery algorithms",
        "Supplier recommendation engine",
        "Trending products and categories",
        "Personalized recommendations",
        "Market insights and analytics"
      ]}
    />
  )
}