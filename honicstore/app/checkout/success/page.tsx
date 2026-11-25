"use client"

/** Payment result (paid / waiting / failed / expired). All three checkout result URLs show the same page. */
import { Suspense } from 'react'
import { PaymentResult } from '../_components/payment-result'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaymentResult />
    </Suspense>
  )
}
