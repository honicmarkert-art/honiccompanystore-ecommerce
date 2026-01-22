"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DiscoverPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to product list page
    router.replace('/products')
  }, [router])
  
  return null
}