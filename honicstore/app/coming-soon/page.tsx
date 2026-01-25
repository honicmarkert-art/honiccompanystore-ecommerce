import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getCompanySettings } from '@/lib/company-settings-server'
import { cn } from '@/lib/utils'

// Force static generation with ISR (revalidate every 24 hours)
export const dynamic = 'force-static'
export const revalidate = 86400

export default async function ComingSoonPage() {
  const companySettings = await getCompanySettings()

  return (
    <div className={cn("h-screen flex items-center justify-center relative bg-white dark:bg-gray-900")}>
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
        <span className={cn("text-xl font-bold text-gray-900 dark:text-white")}>
          {companySettings.companyName}
        </span>
      </Link>

      {/* Main Content */}
      <div className="text-center">
        <h1 className={cn("text-6xl font-bold text-gray-900 dark:text-white")}>
          Coming Soon
        </h1>
      </div>
    </div>
  )
}

