"use client"

// Force dynamic rendering
export const dynamic = 'force-dynamic'


import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OldAdminRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home page immediately
    router.replace('/')
  }, [router])

  return null
}
