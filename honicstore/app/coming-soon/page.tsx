"use client"

import { useTheme } from '@/hooks/use-theme'
import { usePublicCompanyContext } from '@/contexts/public-company-context'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ComingSoonPage() {
  const { themeClasses } = useTheme()
  const { companyName } = usePublicCompanyContext()

  return (
    <div className={cn("h-screen flex items-center justify-center relative", themeClasses.mainBg)}>
      {/* Back Button */}
      <Link href="/" className="absolute top-4 left-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
      </Link>

      {/* Company Name */}
      <Link href="/" className="absolute top-4 right-4">
        <span className={cn("text-xl font-bold", themeClasses.mainText)}>
          {companyName}
        </span>
      </Link>

      {/* Main Content */}
      <div className="text-center">
        <h1 className={cn("text-6xl font-bold", themeClasses.mainText)}>
          Coming Soon
        </h1>
      </div>
    </div>
  )
}

