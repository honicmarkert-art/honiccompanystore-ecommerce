import { redirect } from 'next/navigation'

export default function FeaturedPage() {
  redirect('/')
}

  return (
    <ComingSoonPage
      title="Featured Selections"
      description="Discover our handpicked collection of premium products and services. Curated selections from top suppliers and innovative solutions."
      icon={<Star className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q2 2024"
      features={[
        "Curated product collections",
        "Trending and popular items",
        "Seasonal specials",
        "Editor's picks",
        "New arrivals showcase",
        "Exclusive deals and offers"
      ]}
    />
  )
}




