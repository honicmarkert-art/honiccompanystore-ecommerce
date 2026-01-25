import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import ErrorPageClient from './error-client'

// Force static generation for error page
export const dynamic = 'force-static'

export default function ErrorPage() {
  return <ErrorPageClient />
}




