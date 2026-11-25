/** Instant Marketplace skeleton while the catalog page loads. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f6f6f7] dark:bg-neutral-950" aria-busy="true" aria-label="Loading Marketplace">
      <div className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/85 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-orange-200" />
          <div className="h-11 flex-1 animate-pulse rounded-full bg-neutral-200/80 dark:bg-neutral-800" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200/80 dark:bg-neutral-800" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-white dark:bg-neutral-900" />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white p-2 dark:bg-neutral-900">
              <div className="aspect-square animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
              <div className="mt-3 h-3 w-4/5 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
