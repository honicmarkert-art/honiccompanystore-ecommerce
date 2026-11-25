/** Instant skeleton shown the moment a product link is clicked (mirrors the detail page layout). */
export default function Loading() {
  const bar = 'animate-pulse rounded-full bg-neutral-200/80 dark:bg-neutral-800'
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950" aria-busy="true" aria-label="Loading product">
      <div className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/85 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-orange-200" />
          <div className={`${bar} h-4 w-20`} />
          <div className={`${bar} ml-auto hidden h-10 w-full max-w-xl sm:block`} />
          <div className={`${bar} h-9 w-9`} />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className={`${bar} my-4 h-3 w-64`} />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <div className="aspect-square w-full animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 w-16 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />)}
            </div>
          </div>
          <div className="space-y-4 pt-2">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-7 w-11/12`} />
            <div className={`${bar} h-7 w-2/3`} />
            <div className={`${bar} h-10 w-40`} />
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => <div key={i} className={`${bar} h-8 w-24`} />)}
            </div>
            <div className="h-px bg-neutral-100 dark:bg-neutral-800" />
            <div className="flex gap-3">
              <div className={`${bar} h-12 w-32`} />
              <div className="h-12 flex-1 animate-pulse rounded-2xl bg-orange-200/70" />
            </div>
            <div className="h-12 w-full animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
