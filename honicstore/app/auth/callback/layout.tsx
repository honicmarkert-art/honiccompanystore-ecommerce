// Layout for auth callback page
// Force dynamic rendering to prevent static generation issues with useSearchParams
export const dynamic = 'force-dynamic'

export default function CallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

