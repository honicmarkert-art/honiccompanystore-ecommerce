import { ComingSoonPage } from '@/components/coming-soon-page'
import { Smartphone } from 'lucide-react'

export default function AppPage() {
  return (
    <ComingSoonPage
      title="App & Extension"
      description="Download our mobile app and browser extensions for a seamless shopping experience. Access our platform anywhere, anytime with our mobile and desktop tools."
      icon={<Smartphone className="w-10 h-10 text-white" />}
      category="Navigation"
      estimatedLaunch="Q3 2024"
      features={[
        "Mobile app for iOS and Android",
        "Browser extensions for Chrome and Firefox",
        "Offline browsing capabilities",
        "Push notifications for deals",
        "Quick order placement",
        "Barcode scanning for products"
      ]}
    />
  )
}




