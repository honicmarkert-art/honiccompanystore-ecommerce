/**
 * Simple full-page message (404, no access, something went wrong). Self-contained on purpose: it is
 * also used when a page crashes, so it must not depend on the header, data or auth.
 */
import Link from 'next/link'

export function StatusScreen({ code, icon, title, text, children, footnote }: {
  code?: string
  icon: React.ReactNode
  title: string
  text: React.ReactNode
  children?: React.ReactNode
  footnote?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Honic home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-lg font-black text-white">H</span>
          <span className="text-lg font-black tracking-tight">Honic</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
        <div className="w-full max-w-lg rounded-3xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200 sm:px-10 dark:bg-neutral-900 dark:ring-neutral-800">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/40">{icon}</span>
          {code && <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">{code}</p>}
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-300">{text}</div>
          {children && <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">{children}</div>}
          {footnote && <div className="mt-6 border-t border-neutral-100 pt-4 text-xs text-neutral-500 dark:border-neutral-800">{footnote}</div>}
        </div>
      </main>
    </div>
  )
}

export const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600'
export const secondaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700'
