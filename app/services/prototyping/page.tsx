import { ComingSoonPage } from '@/components/coming-soon-page'
import { Cpu } from 'lucide-react'

export default function PrototypingPage() {
  return (
    <ComingSoonPage
      title="Project Prototyping"
      description="Custom prototyping services for your innovative ideas. We'll help bring your concepts to life with professional prototyping solutions."
      icon={<Cpu className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "3D printing and rapid prototyping",
        "Custom electronics prototyping",
        "PCB design and manufacturing",
        "Prototype testing and validation",
        "Design consultation and optimization",
        "Small batch production runs"
      ]}
    />
  )
}




