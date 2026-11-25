import {
  Bot, Boxes, Cable, CircuitBoard, Cpu, Gamepad2, GraduationCap, Laptop, Lightbulb, Monitor, Package,
  Phone, Plug, Radar, Shirt, Sofa, Trophy, Wrench, Zap, type LucideIcon,
} from 'lucide-react'

/** Icon per category slug (falls back to a box). */
const ICONS: Record<string, LucideIcon> = {
  sensors: Radar,
  accessories: Boxes,
  tools: Wrench,
  'connectors-cables': Cable,
  'power-supply': Plug,
  microcontrollers: Cpu,
  'motors-actuators': Zap,
  'diodes-transistors': Lightbulb,
  'resistors-capacitors': CircuitBoard,
  robotics: Bot,
  'development-boards': CircuitBoard,
  'integrated-circuits': Cpu,
  'project-kits': Package,
  'starter-kits': Package,
  'educational-materials': GraduationCap,
  'diy-electronic-components': CircuitBoard,
  'computer-office': Laptop,
  'home-electronic-devices': Monitor,
  'phones--telecom': Phone,
  'clothes-and-shoes': Shirt,
  'fashion-and-jewelry': Shirt,
  games: Gamepad2,
  furnitures: Sofa,
  'sport-and-entertainment': Trophy,
  'tools--industries': Wrench,
  'school-items': GraduationCap,
}

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] || Package
  return <Icon className={className} aria-hidden="true" />
}
