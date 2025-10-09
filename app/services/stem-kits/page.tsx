import { ComingSoonPage } from '@/components/coming-soon-page'
import { Building2 } from 'lucide-react'

export default function StemKitsPage() {
  return (
    <ComingSoonPage
      title="STEM Training Kits"
      description="Educational kits for learning and teaching. Comprehensive STEM resources designed to enhance learning experiences for students and educators."
      icon={<Building2 className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "Arduino and Raspberry Pi kits",
        "Electronics learning modules",
        "Programming tutorials and guides",
        "Project-based learning materials",
        "Teacher training resources",
        "Curriculum integration support"
      ]}
    />
  )
}




