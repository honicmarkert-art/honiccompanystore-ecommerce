'use client'

/** Shown when a page crashes. Logs the error, offers "try again" and home. Self-contained (no header). */
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, MessageCircle, RefreshCw } from 'lucide-react'
import { logError } from '@/lib/error-handler'
import { whatsappLink } from '@/lib/contact'
import { StatusScreen, primaryBtn, secondaryBtn } from '@/components/status-screen'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logError(error, { action: 'error_boundary', metadata: { digest: error.digest, stack: error.stack, name: error.name } })
  }, [error])

  return (
    <StatusScreen
      code="Something went wrong"
      icon={<AlertTriangle className="h-8 w-8" />}
      title="This page didn't load"
      text={<>It&apos;s on our side, not yours. Try again; if it keeps happening, tell us and we&apos;ll fix it.</>}
      footnote={error.digest ? <>Error reference: <span className="font-mono">{error.digest}</span></> : undefined}
    >
      <button onClick={() => reset()} className={primaryBtn}><RefreshCw className="h-4 w-4" /> Try again</button>
      <Link href="/" className={secondaryBtn}><Home className="h-4 w-4" /> Home</Link>
      <a href={whatsappLink(`Hello Honic, a page did not load${error.digest ? ` (ref ${error.digest})` : ''}`)} target="_blank" rel="noopener noreferrer" className={secondaryBtn}><MessageCircle className="h-4 w-4" /> Tell us</a>
    </StatusScreen>
  )
}
