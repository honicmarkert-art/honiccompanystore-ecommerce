'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Expand, ImageIcon, Play, RotateCcw, X } from 'lucide-react'
import { isDirectVideoFile, isYouTubeUrl, toEmbedUrl } from './utils'
import { canOptimizeImage } from '@/lib/image-optimize'

type Mode = 'photos' | 'video' | '360'

type Props = {
  images: string[]
  alt: string
  video?: string | null
  view360?: string | null
  /** When this changes (e.g. a variant with its own image is picked), the gallery jumps to it. */
  focusImage?: string | null
  badges?: React.ReactNode
}

function GalleryImpl({ images, alt, video, view360, focusImage, badges }: Props) {
  const list = images.length ? images : ['/placeholder.svg']
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('photos')
  const [lightbox, setLightbox] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)
  /** True while a thumbnail or arrow is moving the phone strip, so scroll events don't snap back to image 1. */
  const stripLock = useRef(false)
  const zoomImgRef = useRef<HTMLDivElement>(null)
  const thumbColRef = useRef<HTMLDivElement>(null)
  const thumbRowRef = useRef<HTMLDivElement>(null)
  const lightboxRowRef = useRef<HTMLDivElement>(null)
  const [thumbEdges, setThumbEdges] = useState({ up: false, down: false })
  /** Many photos: phones get a thumbnail strip instead of a row of dots that would overflow. */
  const manyImages = list.length > 6

  // jump to a variant's image
  useEffect(() => {
    if (!focusImage) return
    const i = list.indexOf(focusImage)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps local state in sync with props/route changes
    if (i >= 0) { setIndex(i); setMode('photos') }
  }, [focusImage]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the phone swipe strip in sync with index (instant, and ignore the scroll event this causes)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const target = el.children[index] as HTMLElement | undefined
    if (!target || Math.abs(el.scrollLeft - target.offsetLeft) <= 4) return
    stripLock.current = true
    el.scrollTo({ left: target.offsetLeft, behavior: 'auto' })
    const release = window.setTimeout(() => { stripLock.current = false }, 80)
    return () => window.clearTimeout(release)
  }, [index])

  // keep the active thumbnail visible in every thumbnail list (scrolls the list only, never the page)
  useEffect(() => {
    const reveal = (box: HTMLDivElement | null, vertical: boolean) => {
      const item = box?.children[vertical ? index : index + (box === lightboxRowRef.current ? 1 : 0)] as HTMLElement | undefined
      if (!box || !item) return
      if (vertical) {
        const top = item.offsetTop
        if (top < box.scrollTop) box.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
        else if (top + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: top + item.offsetHeight - box.clientHeight + 8, behavior: 'smooth' })
      } else {
        const left = item.offsetLeft
        if (left < box.scrollLeft) box.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' })
        else if (left + item.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: left + item.offsetWidth - box.clientWidth + 8, behavior: 'smooth' })
      }
    }
    reveal(thumbColRef.current, true)
    reveal(thumbRowRef.current, false)
    reveal(lightboxRowRef.current, false)
  }, [index, lightbox])

  // show the up/down arrows on the desktop thumbnail column only when there is more to see
  const updateThumbEdges = useCallback(() => {
    const el = thumbColRef.current
    if (!el) return
    const up = el.scrollTop > 4
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 4
    setThumbEdges((p) => (p.up === up && p.down === down ? p : { up, down }))
  }, [])
  useEffect(() => {
    const el = thumbColRef.current
    if (!el) return
    const ro = new ResizeObserver(updateThumbEdges)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateThumbEdges, mode, list.length])
  const scrollThumbs = (d: number) => {
    const el = thumbColRef.current
    if (el) el.scrollBy({ top: d * el.clientHeight * 0.7, behavior: 'smooth' })
  }

  const onStripScroll = useCallback(() => {
    if (stripLock.current) return
    const el = stripRef.current
    if (!el || el.clientWidth < 1) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i < 0 || i >= list.length) return
    setIndex((prev) => (prev === i ? prev : i))
  }, [list.length])

  const go = useCallback((d: number) => setIndex((i) => (i + d + list.length) % list.length), [list.length])

  // Hover zoom: mutate the style directly so mouse moves never re-render React
  const onZoomMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = zoomImgRef.current
    if (!el) return
    const r = e.currentTarget.getBoundingClientRect()
    el.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`
    el.style.transform = 'scale(2)'
  }
  const onZoomLeave = () => {
    const el = zoomImgRef.current
    if (el) el.style.transform = 'scale(1)'
  }

  useEffect(() => {
    if (!lightbox) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [lightbox, go])

  const modes: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: 'photos', label: 'Photos', icon: <ImageIcon className="h-4 w-4" /> },
    ...(video ? [{ key: 'video' as Mode, label: 'Video', icon: <Play className="h-4 w-4" /> }] : []),
    ...(view360 ? [{ key: '360' as Mode, label: '360°', icon: <RotateCcw className="h-4 w-4" /> }] : []),
  ]

  const embedSrc = (url: string) => (isYouTubeUrl(url) ? toEmbedUrl(url) : url)

  const hasThumbCol = mode === 'photos' && list.length > 1
  return (
    // Desktop: the gallery fills the height its column gives it (so the seller card below can line up with the
    // buy box), never taller than square and never shorter than 320px. Phones keep the plain square image.
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:[container-type:inline-size]">
      <div className={`flex gap-3 lg:min-h-[320px] lg:flex-1 ${hasThumbCol ? 'lg:max-h-[calc(100cqw+40px)]' : 'lg:max-h-[calc(100cqw+136px)]'}`}>
        {/* Desktop thumbnails: a column exactly as tall as the main image; scrolls with arrows when there are many */}
        {hasThumbCol && (
          <div className="relative hidden w-[84px] shrink-0 self-stretch lg:block">
            <div
              ref={thumbColRef}
              onScroll={updateThumbEdges}
              className="absolute inset-0 flex flex-col gap-2.5 overflow-y-auto overscroll-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {list.map((src, i) => (
                <button
                  key={src + i}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => setIndex(i)}
                  aria-label={`Show image ${i + 1} of ${list.length}`}
                  aria-current={i === index}
                  className={`relative aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-white ring-2 transition ${i === index ? 'ring-orange-500' : 'ring-transparent hover:ring-neutral-300'}`}
                >
                  <Image src={src} alt="" fill sizes="84px" className="object-contain p-1" unoptimized={!canOptimizeImage(src)} />
                </button>
              ))}
            </div>
            {thumbEdges.up && (
              <button onClick={() => scrollThumbs(-1)} aria-label="Earlier images" className="absolute inset-x-0 top-0 z-10 flex h-10 items-start justify-center bg-gradient-to-b from-white via-white/80 to-transparent pt-1 dark:from-neutral-950 dark:via-neutral-950/80">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white shadow ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700"><ChevronUp className="h-4 w-4" /></span>
              </button>
            )}
            {thumbEdges.down && (
              <button onClick={() => scrollThumbs(1)} aria-label="More images" className="absolute inset-x-0 bottom-0 z-10 flex h-10 items-end justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1 dark:from-neutral-950 dark:via-neutral-950/80">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white shadow ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700"><ChevronDown className="h-4 w-4" /></span>
              </button>
            )}
          </div>
        )}

        <div className="relative min-w-0 flex-1 lg:flex lg:flex-col">
          <div className="relative aspect-square overflow-hidden rounded-3xl lg:aspect-auto lg:min-h-0 lg:flex-1 bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
            {mode === 'photos' && (
              <>
                {/* Phone/tablet: swipeable strip */}
                <div
                  ref={stripRef}
                  onScroll={onStripScroll}
                  className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
                >
                  {list.map((src, i) => (
                    <button key={src + i} onClick={() => setLightbox(true)} className="relative h-full w-full shrink-0 snap-center" aria-label="Open full screen">
                      <Image
                        src={src}
                        alt={i === 0 ? alt : `${alt} — image ${i + 1}`}
                        fill
                        priority={i === 0}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        sizes="(min-width: 1024px) 45vw, 100vw"
                        className="object-contain p-4"
                        unoptimized={!canOptimizeImage(src)}
                      />
                    </button>
                  ))}
                </div>

                {/* Desktop: hover-zoom main image */}
                <div
                  className="relative hidden h-full cursor-zoom-in overflow-hidden lg:block"
                  onMouseMove={onZoomMove}
                  onMouseLeave={onZoomLeave}
                  onClick={() => setLightbox(true)}
                >
                  <div ref={zoomImgRef} className="relative h-full w-full">
                    <Image
                      key={list[index]}
                      src={list[index]}
                      alt={alt}
                      fill
                      priority={index === 0}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      className="object-contain p-6"
                      unoptimized={!canOptimizeImage(list[index])}
                    />
                  </div>
                </div>

                {list.length > 1 && (
                  <>
                    <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md backdrop-blur hover:bg-white" aria-label="Previous image">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md backdrop-blur hover:bg-white" aria-label="Next image">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="absolute bottom-3 right-3 rounded-full bg-neutral-950/70 px-2.5 py-1 text-xs font-medium text-white lg:hidden">
                      {index + 1} / {list.length}
                    </span>
                  </>
                )}
                <button onClick={() => setLightbox(true)} className="absolute right-3 top-3 hidden rounded-full bg-white/90 p-2 shadow-md hover:bg-white lg:block" aria-label="Full screen">
                  <Expand className="h-4 w-4" />
                </button>
              </>
            )}

            {mode === 'video' && video && (
              isDirectVideoFile(video)
                ? <video className="h-full w-full bg-black object-contain" controls autoPlay playsInline poster={list[0]} src={video} />
                : <iframe src={`${embedSrc(video)}${embedSrc(video).includes('?') ? '&' : '?'}autoplay=1`} title={`${alt} video`} className="h-full w-full" allowFullScreen allow="autoplay; encrypted-media" />
            )}
            {mode === '360' && view360 && (
              <iframe src={embedSrc(view360)} title={`${alt} 360° view`} className="h-full w-full" allowFullScreen allow="autoplay; encrypted-media" />
            )}

            {badges && mode === 'photos' && <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">{badges}</div>}
          </div>

          {/* Phone: dots for a few photos, a scrollable thumbnail strip when there are many */}
          {mode === 'photos' && list.length > 1 && !manyImages && (
            <div className="mt-3 flex justify-center lg:hidden">
              {list.map((_, i) => (
                <button key={i} onClick={() => setIndex(i)} aria-label={`Image ${i + 1}`} className="-my-3 flex h-8 items-center px-2"><span className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-orange-500' : 'w-1.5 bg-neutral-300'}`} /></button>
              ))}
            </div>
          )}
          {mode === 'photos' && manyImages && (
            <div ref={thumbRowRef} className="relative mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-0.5 py-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
              {list.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setIndex(i)}
                  aria-label={`Image ${i + 1} of ${list.length}`}
                  aria-current={i === index}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white ring-2 transition ${i === index ? 'ring-orange-500' : 'opacity-70 ring-transparent'}`}
                >
                  <Image src={src} alt="" fill sizes="56px" className="object-contain p-1" unoptimized={!canOptimizeImage(src)} loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* Mode switch */}
          {modes.length > 1 && (
            <div className="mt-3 flex justify-center gap-2">
              {modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${mode === m.key ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'}`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-950/95" role="dialog" aria-modal="true" aria-label="Image viewer">
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm">{index + 1} / {list.length}</span>
            <button onClick={() => setLightbox(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close"><X className="h-6 w-6" /></button>
          </div>
          <div className="relative flex-1" onClick={() => setLightbox(false)}>
            <Image src={list[index]} alt={alt} fill sizes="100vw" className="object-contain p-4" unoptimized={!canOptimizeImage(list[index])} />
            {list.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); go(-1) }} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button>
                <button onClick={(e) => { e.stopPropagation(); go(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next image"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
          </div>
          {list.length > 1 && (
            <div ref={lightboxRowRef} className="relative flex gap-2 overflow-x-auto overscroll-x-contain p-4">
              {/* auto margins centre the row when it fits, but never cut off the first images when it doesn't */}
              <span aria-hidden className="ml-auto" />
              {list.map((src, i) => (
                <button key={src + i} onClick={() => setIndex(i)} className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white ring-2 ${i === index ? 'ring-orange-500' : 'ring-transparent opacity-60'}`} aria-label={`Image ${i + 1}`}>
                  <Image src={src} alt="" fill sizes="56px" className="object-contain p-1" unoptimized={!canOptimizeImage(src)} />
                </button>
              ))}
              <span aria-hidden className="mr-auto" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const Gallery = memo(GalleryImpl)
