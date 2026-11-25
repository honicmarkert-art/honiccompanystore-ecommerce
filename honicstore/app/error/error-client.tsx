"use client"

/** /error: where the server sends visitors after an unexpected problem. */
import Link from 'next/link'
import { AlertTriangle, Home, MessageCircle, RefreshCw } from 'lucide-react'
import { whatsappLink } from '@/lib/contact'
import { StatusScreen, primaryBtn, secondaryBtn } from '@/components/status-screen'

export default function ErrorPageClient() {
  return (
    <StatusScreen
      code="Server error"
      icon={<AlertTriangle className="h-8 w-8" />}
      title="Something went wrong on our side"
      text="Your account and orders are safe. Please try again in a moment."
    >
      <button onClick={() => window.location.reload()} className={primaryBtn}><RefreshCw className="h-4 w-4" /> Try again</button>
      <Link href="/" className={secondaryBtn}><Home className="h-4 w-4" /> Home</Link>
      <a href={whatsappLink('Hello Honic, I got a server error on the website')} target="_blank" rel="noopener noreferrer" className={secondaryBtn}><MessageCircle className="h-4 w-4" /> Tell us</a>
    </StatusScreen>
  )
}
