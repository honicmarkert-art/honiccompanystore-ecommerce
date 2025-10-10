export default function TestPage() {
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">SIEM Dashboard Test Page</h1>
      <p>If you can see this, the siem-dashboard routing is working!</p>
    </div>
  )
}
