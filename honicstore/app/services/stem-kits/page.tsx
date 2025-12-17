'use client'

import { GraduationCap } from 'lucide-react'
import { ComingSoonPage } from '@/components/coming-soon-page'

export default function StemKitsPage() {
  return (
    <ComingSoonPage
      title="STEM Training Kits"
      description="Educational STEM kits and training programs. Comprehensive learning solutions for students and educators in science, technology, engineering, and mathematics."
      icon={<GraduationCap className="w-10 h-10 text-white" />}
      category="Service"
      estimatedLaunch="Q2 2024"
      features={[
        "Complete STEM curriculum kits",
        "Hands-on learning projects",
        "Educational resources and guides",
        "Teacher training programs",
        "Student assessment tools",
        "Custom curriculum development"
      ]}
    />
  )
}
