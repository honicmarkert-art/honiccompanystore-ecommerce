'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Check, ClipboardPaste, ImagePlus, Loader2, RotateCcw, ScanSearch, Search, Sparkles, Type, Upload, X, Zap } from 'lucide-react'
import { useCurrency } from '@/contexts/currency-context'

/**
 * Honic Lens — search by photo.
 *
 * Mount <LensRoot /> once (app layout). Anything can then open it:
 *   - openLens()            → empty dialog (upload / drop / paste / camera)
 *   - openLens(file)        → dialog that immediately searches with that image
 *   - pasting an image while focus is inside a [role="search"] or [data-lens] element
 *   - dropping an image on a [data-lens] element (e.g. a search bar)
 */

const EVENT = 'honic:lens'

export function openLens(file?: File | Blob | null) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { file: file || null } }))
}

type Match = 'exact' | 'similar' | 'related'
type Result = {
  id: number
  name: string
  slug?: string
  price: number
  original_price?: number
  originalPrice?: number
  image?: string | null
  rating?: number
  category?: string
  match?: Match
  inStock?: boolean
}
type Analysis = { name: string; brand: string; category: string; modelNumbers: string[]; keywords: string[]; description: string }
type Phase = 'idle' | 'reading' | 'matching' | 'refining' | 'done' | 'error'

const MATCH_STYLE: Record<Match, { label: string; className: string }> = {
  exact: { label: 'Exact match', className: 'bg-emerald-600 text-white' },
  similar: { label: 'Similar', className: 'bg-orange-500 text-white' },
  related: { label: 'Related', className: 'bg-neutral-800/80 text-white' },
}

type Method = 'fingerprint' | 'text' | 'ai'

// How the match was found — shown under "We see"
const METHOD_BADGE: Record<Method, { label: string; className: string; icon: React.ReactNode }> = {
  fingerprint: { label: 'Instant match', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', icon: <Zap className="h-3 w-3" /> },
  text: { label: 'Read from label', className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300', icon: <Type className="h-3 w-3" /> },
  ai: { label: 'AI match', className: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300', icon: <Sparkles className="h-3 w-3" /> },
}

const isImageFile = (f: File | Blob) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test((f as File).name || '')

/** Downscale to ≤1024px JPEG in the browser — uploads are ~10× smaller and Gemini answers faster. */
async function toDataUrl(file: File | Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff' // transparent PNGs → white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return null // e.g. HEIC on browsers that can't decode it — sent as-is instead
  }
}

const productHref = (p: Result) => `/products/${p.id}-${encodeURIComponent(p.slug || p.name)}`

export function LensRoot() {
  const router = useRouter()
  const { formatPrice } = useCurrency()

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState<Method | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const runId = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    runId.current++
    setPhase('idle')
    setResults([])
    setAnalysis(null)
    setQuery('')
    setMethod(null)
    setError('')
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null })
  }, [])

  const close = useCallback(() => { setOpen(false); reset() }, [reset])

  const search = useCallback(async (file: File | Blob) => {
    if (!isImageFile(file)) { setError('Please choose an image (JPG, PNG, WEBP or GIF).'); setPhase('error'); return }
    if (file.size > 20 * 1024 * 1024) { setError('That photo is too large (max 20 MB).'); setPhase('error'); return }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const id = ++runId.current

    setPreview((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(file) })
    setResults([])
    setAnalysis(null)
    setError('')
    setPhase('reading')

    // after a few seconds the AI is usually done reading and is matching products
    const t = setTimeout(() => { if (runId.current === id) setPhase((ph) => (ph === 'reading' ? 'matching' : ph)) }, 3500)
    try {
      const dataUrl = await toDataUrl(file)
      let res: Response
      // ndjson: the server sends early results first, then the re-ranked list
      const headers: Record<string, string> = { Accept: 'application/x-ndjson' }
      if (dataUrl) {
        res = await fetch('/api/image-search', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }), signal: ctrl.signal })
      } else {
        const fd = new FormData()
        fd.append('image', file, (file as File).name || 'photo')
        res = await fetch('/api/image-search', { method: 'POST', headers, body: fd, signal: ctrl.signal })
      }
      if (runId.current !== id) return

      const apply = (d: any, final: boolean) => {
        setResults(Array.isArray(d.products) ? d.products : [])
        setAnalysis(d.analysis || null)
        setQuery(d.query || '')
        setMethod(d.method === 'fingerprint' || d.method === 'text' || d.method === 'ai' ? d.method : null)
        setPhase(final ? 'done' : 'refining')
      }

      const isStream = (res.headers.get('content-type') || '').includes('ndjson')
      if (!isStream || !res.body) {
        const d = await res.json().catch(() => null)
        if (runId.current !== id) return
        if (!res.ok) throw new Error(d?.error || 'Photo search failed. Please try again.')
        apply(d, true)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let gotFinal = false
      for (;;) {
        const { done, value } = await reader.read()
        if (value) buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line || runId.current !== id) continue
          const msg = JSON.parse(line)
          if (msg.type === 'error') throw new Error(msg.error || 'Photo search failed. Please try again.')
          if (msg.type === 'partial') apply(msg, false)
          if (msg.type === 'final') { apply(msg, true); gotFinal = true }
        }
        if (done) break
      }
      // stream ended after early results only: keep them
      if (!gotFinal && runId.current === id) setPhase((ph) => (ph === 'refining' ? 'done' : ph))
    } catch (e) {
      if (ctrl.signal.aborted || runId.current !== id) return
      setError(e instanceof Error ? e.message : 'Photo search failed. Please try again.')
      setPhase('error')
    } finally {
      clearTimeout(t)
    }
  }, [])

  // open requests from anywhere
  useEffect(() => {
    const onOpen = (e: Event) => {
      const file = (e as CustomEvent<{ file: File | null }>).detail?.file
      setOpen(true)
      if (file) search(file)
    }
    window.addEventListener(EVENT, onOpen)
    return () => window.removeEventListener(EVENT, onOpen)
  }, [search])

  // paste: anywhere while the dialog is open, or inside a search bar / [data-lens]
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      const inSearch = !!target?.closest?.('[role="search"], [data-lens]')
      if (!open && !inSearch) return
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      setOpen(true)
      search(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, search])

  // drop an image on any [data-lens] element (search bars)
  useEffect(() => {
    const zone = (e: DragEvent) => (e.target as HTMLElement | null)?.closest?.('[data-lens]')
    const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const over = (e: DragEvent) => { if (!open && zone(e) && hasFile(e)) e.preventDefault() }
    const drop = (e: DragEvent) => {
      if (open || !zone(e)) return
      const file = Array.from(e.dataTransfer?.files || []).find(isImageFile)
      if (!file) return
      e.preventDefault()
      setOpen(true)
      search(file)
    }
    document.addEventListener('dragover', over)
    document.addEventListener('drop', drop)
    return () => { document.removeEventListener('dragover', over); document.removeEventListener('drop', drop) }
  }, [open, search])

  // Pre-load the product index on the server as soon as the dialog opens
  useEffect(() => {
    if (open) fetch('/api/image-search?warm=1').catch(() => {})
  }, [open])

  // Esc + lock page scroll
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [open, close])

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) { search(await item.getType(type)); return }
      }
      setError('No image on the clipboard. Copy an image first, or press Ctrl+V.')
      setPhase('error')
    } catch {
      setError('Press Ctrl+V (or long-press → Paste) to paste an image.')
      setPhase('error')
    }
  }

  const goSearch = (term: string) => {
    if (!term.trim()) return
    close()
    router.push(`/products?search=${encodeURIComponent(term.trim())}`)
  }

  if (!open) return null

  const busy = phase === 'reading' || phase === 'matching'
  const chips = analysis
    ? [...new Set([analysis.name, analysis.brand, ...analysis.modelNumbers, ...analysis.keywords.slice(0, 4)].filter(Boolean))].slice(0, 8)
    : []
  const exact = results.filter((r) => r.match === 'exact')
  const others = results.filter((r) => r.match !== 'exact')

  const pickFile = () => fileRef.current?.click()
  const takePhoto = () => cameraRef.current?.click()
  const another = () => { reset(); setTimeout(pickFile, 0) }

  /*
   * Layouts
   *   phone  (<640)    full-screen sheet; camera-first big buttons; drop zone hidden on touch screens
   *   tablet (640-1023) centered window; drop zone + 3-button row; results 3 columns under a photo strip
   *   desktop (≥1024)  wide window; drop zone left + actions/tips right; results with a sticky photo column
   */
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Search by photo">
      <div className="absolute inset-0 bg-neutral-950/60" onClick={close} />

      <div
        className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-neutral-950 sm:h-auto sm:max-h-[88vh] sm:max-w-2xl sm:rounded-3xl lg:max-h-[92vh] lg:max-w-4xl ${dragging ? 'ring-4 ring-inset ring-orange-400' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = Array.from(e.dataTransfer.files).find(isImageFile)
          if (file) search(file)
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-neutral-800 sm:px-6 sm:pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500 text-white"><ScanSearch className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate font-black leading-tight">Search by photo</h2>
              <p className="flex items-center gap-1 truncate text-[11px] text-neutral-500"><Sparkles className="h-3 w-3 shrink-0 text-orange-500" />AI finds the product in your picture</p>
            </div>
          </div>
          <button onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) search(f); e.target.value = '' }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) search(f); e.target.value = '' }} />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!preview ? (
            /* ================= Pick a photo ================= */
            <>
            {/* Phone + tablet */}
            <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6 lg:hidden">
              {/* Drop zone: a target only — clicking it does nothing. Hidden on touch screens (no drag & drop there). */}
              <div
                className={`flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors sm:py-14 [@media(pointer:coarse)]:hidden ${dragging ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-neutral-300 bg-neutral-50/60 dark:border-neutral-700 dark:bg-neutral-900/40'}`}
                aria-label="Drop a photo here"
              >
                <span className={`grid h-16 w-16 place-items-center rounded-2xl transition-transform ${dragging ? 'scale-110 bg-orange-500 text-white' : 'bg-orange-100 text-orange-600 dark:bg-orange-950/50'}`}><ImagePlus className="h-8 w-8" /></span>
                <p className="text-lg font-bold sm:text-xl">{dragging ? 'Release to search' : 'Drag & drop a photo here'}</p>
                <p className="text-sm text-neutral-500">
                  or paste a copied image with{' '}
                  <kbd className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-900">Ctrl</kbd> +{' '}
                  <kbd className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-900">V</kbd>
                </p>
              </div>

              {/* Phone hero (touch screens only) */}
              <div className="hidden flex-col items-center gap-2 pt-4 text-center [@media(pointer:coarse)]:flex">
                <span className="grid h-20 w-20 place-items-center rounded-3xl bg-orange-100 text-orange-600 dark:bg-orange-950/50"><ScanSearch className="h-10 w-10" /></span>
                <p className="text-xl font-black">Snap it. Find it.</p>
                <p className="max-w-xs text-sm text-neutral-500">Take a photo of a part or product, or use a picture you already have.</p>
              </div>

              {/* Actions + tips */}
              <div className="flex flex-col gap-4">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {/* Take photo: touch devices only (on desktop it would just open the file picker) */}
                  <ActionButton primary className="hidden [@media(pointer:coarse)]:flex" icon={<Camera className="h-5 w-5" />} label="Take photo" hint="Use your camera" onClick={takePhoto} />
                  <ActionButton primary className="[@media(pointer:coarse)]:hidden" icon={<Upload className="h-5 w-5" />} label="Upload photo" hint="JPG, PNG, WEBP · up to 20 MB" onClick={pickFile} />
                  <ActionButton className="hidden [@media(pointer:coarse)]:flex" icon={<Upload className="h-5 w-5" />} label="Choose from gallery" hint="Pick a saved picture" onClick={pickFile} />
                  <ActionButton icon={<ClipboardPaste className="h-5 w-5" />} label="Paste image" hint="From your clipboard" onClick={pasteFromClipboard} />
                </div>

                {phase === 'error' && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

                <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">For best results</p>
                  <ul className="grid gap-1.5 text-sm text-neutral-600 dark:text-neutral-300 sm:grid-cols-3">
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />One product, filling the frame</li>
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Labels and part numbers visible</li>
                    <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Screenshots from other shops work</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* PC: the earlier layout — wide drop zone, three buttons, tips. The drop zone is a target only (not clickable). */}
            <div className="hidden p-6 lg:block">
              <div
                aria-label="Drop a photo here"
                className={`flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors ${dragging ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-neutral-300 dark:border-neutral-700'}`}
              >
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50"><ImagePlus className="h-8 w-8" /></span>
                <span className="text-lg font-bold">{dragging ? 'Drop your photo here' : 'Drag a photo here'}</span>
                <span className="text-sm text-neutral-500">paste with <kbd className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs dark:border-neutral-700">Ctrl</kbd>+<kbd className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs dark:border-neutral-700">V</kbd> · or use <span className="font-semibold text-orange-600">Upload</span> below</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <button type="button" onClick={takePhoto} className="flex flex-col items-center gap-1.5 rounded-2xl bg-neutral-100 px-2 py-3 text-sm font-semibold hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                  <Camera className="h-5 w-5 text-orange-500" />Take photo
                </button>
                <button type="button" onClick={pickFile} className="flex flex-col items-center gap-1.5 rounded-2xl bg-neutral-100 px-2 py-3 text-sm font-semibold hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                  <Upload className="h-5 w-5 text-orange-500" />Upload
                </button>
                <button type="button" onClick={pasteFromClipboard} className="flex flex-col items-center gap-1.5 rounded-2xl bg-neutral-100 px-2 py-3 text-sm font-semibold hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                  <ClipboardPaste className="h-5 w-5 text-orange-500" />Paste image
                </button>
              </div>

              {phase === 'error' && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

              <ul className="mt-5 grid grid-cols-3 gap-2 text-xs text-neutral-500">
                <li className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Fill the frame with one product</li>
                <li className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Labels and part numbers help a lot</li>
                <li className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Screenshots from other shops work too</li>
              </ul>
            </div>
            </>
          ) : (
            /* ================= Searching / results ================= */
            <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:p-6">
              {/* Your photo: sticky strip on phone/tablet, sticky column on desktop */}
              <aside className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur-none dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 lg:top-0 lg:block lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800 sm:h-20 sm:w-20 lg:aspect-square lg:h-auto lg:w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Your photo" className="h-full w-full object-contain" />
                  {(busy || phase === 'refining') && <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-[lens-scan_1.6s_ease-in-out_infinite] bg-gradient-to-b from-orange-400/0 via-orange-400/30 to-orange-400/0" />}
                </div>
                <div className="min-w-0 flex-1 lg:mt-4">
                  {analysis ? (
                    <>
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        We see
                        {method && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] normal-case tracking-normal ${METHOD_BADGE[method].className}`}>
                            {METHOD_BADGE[method].icon}{METHOD_BADGE[method].label}
                          </span>
                        )}
                      </p>
                      <p className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">{analysis.name}</p>
                      {analysis.description && <p className="mt-1 hidden text-xs text-neutral-500 lg:line-clamp-4">{analysis.description}</p>}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-neutral-500">{phase === 'error' ? 'Search stopped' : 'Looking at your photo…'}</p>
                  )}
                  <button onClick={another} className="mt-1.5 hidden items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-orange-500 hover:text-orange-600 dark:border-neutral-700 sm:inline-flex lg:mt-4 lg:w-full lg:justify-center lg:py-2 lg:text-sm">
                    <RotateCcw className="h-3.5 w-3.5" />Another photo
                  </button>
                </div>
                {/* phone: compact icon button */}
                <button onClick={another} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neutral-300 dark:border-neutral-700 sm:hidden" aria-label="Another photo">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </aside>

              <section className="min-w-0 p-4 sm:p-6 lg:p-0">
                {busy && (
                  <div className="space-y-4">
                    <ol className="space-y-2 text-sm">
                      <Step done={phase === 'matching'} active={phase === 'reading'}>Reading your photo</Step>
                      <Step done={false} active={phase === 'matching'}>Finding matching products</Step>
                    </ol>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />)}
                    </div>
                  </div>
                )}

                {phase === 'error' && (
                  <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                    <div className="mt-3"><button onClick={another} className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white">Try another photo</button></div>
                  </div>
                )}

                {(phase === 'done' || phase === 'refining') && (
                  <>
                    {phase === 'refining' && (
                      <p className="mb-3 flex items-center gap-2 text-xs font-medium text-orange-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking the closest matches…</p>
                    )}
                    {chips.length > 0 && (
                      // phone: one swipeable row · larger screens: wrap
                      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                        {chips.map((c) => (
                          <button key={c} onClick={() => goSearch(c)} className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium hover:bg-orange-50 hover:text-orange-700 dark:bg-neutral-900">
                            <Search className="h-3 w-3 opacity-60" />{c}
                          </button>
                        ))}
                      </div>
                    )}

                    {results.length === 0 ? (
                      <div className="rounded-2xl bg-neutral-50 p-6 text-center dark:bg-neutral-900">
                        <p className="font-semibold">No matching products in the store yet.</p>
                        <p className="mt-1 text-sm text-neutral-500">Try a closer photo, or search by name.</p>
                        {query && <button onClick={() => goSearch(query)} className="mt-4 rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600">Search “{query}”</button>}
                      </div>
                    ) : (
                      <>
                        {exact.length > 0 && <ResultGroup title={exact.length === 1 ? 'Best match' : 'Best matches'} items={exact} formatPrice={formatPrice} onPick={close} />}
                        {others.length > 0 && <ResultGroup title={exact.length ? 'You may also like' : 'Closest matches'} items={others} formatPrice={formatPrice} onPick={close} />}
                        {query && (
                          <button onClick={() => goSearch(query)} className="mb-[env(safe-area-inset-bottom)] mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 py-3 text-sm font-semibold text-orange-600 hover:border-orange-400 hover:bg-orange-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
                            <Search className="h-4 w-4 shrink-0" /><span className="truncate">See all results for “{query}”</span>
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </div>

        {dragging && preview && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-orange-50/90 text-lg font-bold text-orange-700 dark:bg-orange-950/80">Drop to search with this photo</div>
        )}
      </div>
    </div>
  )
}

function ActionButton({ icon, label, hint, onClick, primary, className = '' }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void; primary?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors sm:flex-col sm:items-center sm:gap-1.5 sm:px-3 sm:text-center lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:text-left ${primary ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800'} ${className}`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${primary ? 'bg-white/20' : 'bg-white text-orange-500 dark:bg-neutral-800'}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className={`block truncate text-xs ${primary ? 'text-white/80' : 'text-neutral-500'}`}>{hint}</span>
      </span>
    </button>
  )
}

function Step({ done, active, children }: { done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${active ? 'font-semibold' : done ? 'text-neutral-500' : 'text-neutral-400'}`}>
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : <span className="h-4 w-4 rounded-full border-2 border-neutral-300" />}
      {children}
    </li>
  )
}

function ResultGroup({ title, items, formatPrice, onPick }: { title: string; items: Result[]; formatPrice: (n: number) => string; onPick: () => void }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {items.map((p) => {
          const orig = Number(p.original_price ?? p.originalPrice ?? 0)
          const m = MATCH_STYLE[p.match || 'related']
          return (
            <Link key={p.id} href={productHref(p)} onClick={onPick} className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800">
              <div className="relative aspect-square bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image && /^https?:\/\//.test(p.image) ? p.image : '/placeholder.svg'} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2" />
                <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${m.className}`}>{m.label}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="line-clamp-2 min-h-[2.25rem] text-[13px] leading-snug">{p.name}</p>
                <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-black">{formatPrice(p.price)}</span>
                  {orig > p.price && <span className="text-[11px] text-neutral-400 line-through">{formatPrice(orig)}</span>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
