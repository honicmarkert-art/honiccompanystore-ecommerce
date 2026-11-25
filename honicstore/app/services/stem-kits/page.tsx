"use client"

import Link from 'next/link'
import { GraduationCap, ArrowLeft } from 'lucide-react'
import { usePublicCompanyContext } from '@/contexts/public-company-context'

const kits = [
  "Complete STEM curriculum kits",
  "Hands-on learning projects",
  "Educational resources and guides",
  "Teacher training programs",
  "Student assessment tools",
  "Custom curriculum development",
]

export default function StemKitsPage() {
  const { companyName } = usePublicCompanyContext()

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center bg-orange-500 text-neutral-950">
            <GraduationCap className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{companyName || 'Honic Company Limited'}</p>
        </div>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">STEM Training Kits</h1>
        <p className="mt-3 text-base text-neutral-700">
          Educational STEM kits and training programs for students and educators in science, technology, engineering, and mathematics.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {kits.map((item) => (
            <li key={item} className="border border-neutral-200 px-4 py-3 text-sm font-semibold">
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contact" className="bg-orange-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-orange-600">
            Ask about a kit
          </Link>
          <Link href="/products" className="border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100">
            Shop products
          </Link>
        </div>
      </div>
    </main>
  )
}
