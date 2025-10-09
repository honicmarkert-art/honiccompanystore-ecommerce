import { ComingSoonPage } from '@/components/coming-soon-page'
import { Layers } from 'lucide-react'

export default function CategoriesPage() {
  return (
    <ComingSoonPage
      title="All Categories"
      description="Browse through thousands of products across all categories. Find exactly what you need with our comprehensive product catalog and advanced filtering options."
      icon={<Layers className="w-10 h-10 text-white" />}
      category="Feature"
      estimatedLaunch="Q2 2024"
      features={[
        "Comprehensive product categories",
        "Advanced search and filtering",
        "Product comparison tools",
        "Category-specific recommendations",
        "Bulk ordering capabilities",
        "Category management tools"
      ]}
    />
  )
}




