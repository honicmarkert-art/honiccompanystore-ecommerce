import { Apple } from 'lucide-react'
import { cn } from '@/lib/utils'

function AndroidMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.523 15.341c-.551 0-.999-.449-.999-1s.448-1 .999-1 .999.448.999 1-.448 1-.999 1m-11.046 0c-.551 0-.999-.449-.999-1s.448-1 .999-1 .999.448.999 1-.448 1-.999 1m11.405-6.02 1.997-3.46a.416.416 0 00-.153-.567.416.416 0 00-.567.153l-2.022 3.503A9.67 9.67 0 0012 7.85a9.67 9.67 0 00-5.135 1.099L4.843 5.446a.416.416 0 00-.567-.153.416.416 0 00-.153.567l1.997 3.46A10.96 10.96 0 000 18.761h24a10.96 10.96 0 00-6.118-9.44" />
    </svg>
  )
}

const linkClass =
  'inline-flex flex-1 min-w-0 items-center justify-center gap-2 rounded-md border border-gray-600 bg-zinc-950/80 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:border-gray-500 hover:bg-zinc-900 sm:px-4 sm:text-sm'

export function StoreDownloadLinksRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex w-full flex-row flex-nowrap gap-2 sm:gap-3', className)}>
      <a
        href="https://apps.apple.com"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <Apple className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
        <span className="truncate">App Store</span>
      </a>
      <a
        href="https://play.google.com"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <AndroidMark className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="truncate">Google Play</span>
      </a>
    </div>
  )
}
