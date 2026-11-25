'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Loader2, MessageSquarePlus, Star, ThumbsUp, User } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { supabase } from '@/lib/supabase'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { validateRating, validateReviewComment } from '@/lib/input-validation'
import { isUsableImage, type ProductDetail, type Review } from './utils'
import { canOptimizeImage } from '@/lib/image-optimize'

type Tab = 'description' | 'specs' | 'reviews'

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} ${i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 dark:text-neutral-600'}`} />
      ))}
    </span>
  )
}

function ProductTabsImpl({ product }: { product: ProductDetail }) {
  const [tab, setTab] = useState<Tab>('description')
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [allSpecs, setAllSpecs] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const { isAuthenticated } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()

  const loadReviews = useCallback(async () => {
    try {
      const r = await fetch(`/api/products/${product.id}/reviews`)
      const d = await r.json()
      setReviews(Array.isArray(d?.reviews) ? d.reviews : [])
    } catch {
      setReviews([])
    }
  }, [product.id])

  // Load reviews once the page is idle — never blocks first paint
  useEffect(() => {
    const w = window as any
    const id = w.requestIdleCallback ? w.requestIdleCallback(loadReviews, { timeout: 2000 }) : setTimeout(loadReviews, 300)
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id))
  }, [loadReviews])

  const specs = Object.entries(product.specifications || {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  const shownSpecs = allSpecs ? specs : specs.slice(0, 8)
  const specImages = (product.specificationImages || [])
    .map((s: any) => (typeof s === 'string' ? s : s?.imageUrl || s?.url))
    .filter(isUsableImage)
  const description = product.description?.trim() || ''
  const longDesc = description.length > 600
  const reviewCount = reviews?.length ?? product.reviews ?? 0
  const avgRating = reviews && reviews.length ? reviews.reduce((n, r) => n + (Number(r.rating) || 0), 0) / reviews.length : Number(product.rating) || 0

  const markHelpful = async (review: Review) => {
    if (!isAuthenticated) { openAuthModal(); return }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { openAuthModal(); return }
      const r = await fetch(`/api/products/${product.id}/reviews/${review.id}/helpful`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (r.ok) loadReviews()
    } catch { /* ignore */ }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'specs', label: `Specifications${specs.length ? ` (${specs.length})` : ''}` },
    { key: 'reviews', label: `Reviews (${reviewCount})` },
  ]

  return (
    <section id="details" className="scroll-mt-20">
      <div className="sticky top-14 z-20 -mx-4 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950 sm:top-16 lg:static lg:mx-0 lg:bg-transparent lg:px-0">
        <div role="tablist" className="flex gap-6 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`relative shrink-0 py-3.5 text-sm font-semibold transition-colors sm:text-base ${tab === t.key ? 'text-neutral-950 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
            >
              {t.label}
              <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-orange-500 transition-opacity ${tab === t.key ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="py-6">
        {tab === 'description' && (
          description ? (
            <div>
              <div className={`relative whitespace-pre-line text-[15px] leading-7 text-neutral-700 dark:text-neutral-300 ${longDesc && !expandedDesc ? 'max-h-72 overflow-hidden' : ''}`}>
                {description}
                {longDesc && !expandedDesc && <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-neutral-950" />}
              </div>
              {longDesc && (
                <button onClick={() => setExpandedDesc((v) => !v)} className="mt-3 flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline">
                  {expandedDesc ? 'Show less' : 'Read more'} <ChevronDown className={`h-4 w-4 transition-transform ${expandedDesc ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No description has been added for this product yet.</p>
          )
        )}

        {tab === 'specs' && (
          <div className="space-y-6">
            {specs.length ? (
              <div className="overflow-hidden rounded-2xl ring-1 ring-neutral-200 dark:ring-neutral-800">
                <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {shownSpecs.map(([k, v], i) => (
                    <div key={k} className={`grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(160px,35%)_1fr] sm:gap-4 ${i % 2 ? 'bg-neutral-50 dark:bg-neutral-900/50' : ''}`}>
                      <dt className="font-medium text-neutral-500">{k}</dt>
                      <dd className="text-neutral-900 dark:text-neutral-100">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No specifications listed.</p>
            )}
            {specs.length > 8 && (
              <button onClick={() => setAllSpecs((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline">
                {allSpecs ? 'Show fewer' : `Show all ${specs.length}`} <ChevronDown className={`h-4 w-4 transition-transform ${allSpecs ? 'rotate-180' : ''}`} />
              </button>
            )}
            {specImages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specImages.map((src: string, i: number) => (
                  <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
                    <Image src={src} alt={`${product.name} specification ${i + 1}`} fill sizes="(min-width:640px) 33vw, 50vw" className="object-contain p-2" loading="lazy" unoptimized={!canOptimizeImage(src)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <div className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
              {reviewCount > 0 ? (
                <>
                  <div className="text-4xl font-black">{avgRating.toFixed(1)}</div>
                  <Stars value={avgRating} size="h-5 w-5" />
                  <p className="mt-1 text-sm text-neutral-500">{reviewCount} review{reviewCount === 1 ? '' : 's'} from verified buyers</p>
                </>
              ) : (
                <>
                  <div className="text-lg font-black">No reviews yet</div>
                  <p className="mt-1 text-sm text-neutral-500">Reviews come from shoppers who bought and received this product.</p>
                </>
              )}
              <Button onClick={() => (isAuthenticated ? setReviewOpen(true) : openAuthModal('login'))} className="mt-4 w-full rounded-xl">
                <MessageSquarePlus className="mr-2 h-4 w-4" /> Write a review
              </Button>
            </div>
            <div>
              {reviews === null ? (
                <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />)}</div>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
                  No reviews yet. Be the first to share your experience.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {reviews.map((review) => (
                    <li key={review.id} className="py-5 first:pt-0">
                      <div className="flex items-center gap-3">
                        <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                          {isUsableImage(review.userAvatar)
                            ? <Image src={review.userAvatar} alt="" fill sizes="40px" className="object-cover" unoptimized />
                            : <User className="h-5 w-5 text-neutral-400" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{review.userName}</p>
                          <div className="flex items-center gap-2">
                            <Stars value={review.rating} size="h-3.5 w-3.5" />
                            <span className="text-xs text-neutral-500">{new Date(review.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      {review.comment && <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{review.comment}</p>}
                      {review.images && review.images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {review.images.filter(isUsableImage).map((img, idx) => (
                            <span key={idx} className="relative h-20 w-20 overflow-hidden rounded-xl">
                              <Image src={img} alt={`Review image ${idx + 1}`} fill sizes="80px" className="object-cover" loading="lazy" unoptimized={!canOptimizeImage(img)} />
                            </span>
                          ))}
                        </div>
                      )}
                      <button onClick={() => markHelpful(review)} className="mt-3 flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-orange-50 hover:text-orange-600 dark:bg-neutral-800 dark:text-neutral-300">
                        <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({review.helpful ?? 0})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} product={product} onSaved={loadReviews} />
    </section>
  )
}

function ReviewDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; product: ProductDetail; onSaved: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { user, isAuthenticated } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()

  const reset = () => { setRating(0); setComment('') }

  const submit = async () => {
    if (!validateRating(rating)) {
      toast({ title: 'Invalid Rating', description: 'Please select a valid rating (1-5 stars)', variant: 'destructive' })
      return
    }
    const commentValidation = validateReviewComment(comment)
    if (!commentValidation.valid) {
      toast({ title: 'Invalid Comment', description: commentValidation.error || 'Please enter a valid comment', variant: 'destructive' })
      return
    }
    if (!isAuthenticated) {
      toast({ title: 'Authentication Required', description: 'Please log in to submit a review.', variant: 'destructive' })
      openAuthModal('login')
      return
    }
    setSubmitting(true)
    try {
      // Saved straight to the product (verified buyers only; the server checks the purchase)
      const response = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: commentValidation.sanitized || '' }),
      })
      const data = await response.json().catch(() => null)
      if (response.ok) {
        onOpenChange(false)
        reset()
        onSaved()
        toast({ title: 'Thank you!', description: 'Your review is now on the product page.' })
      } else {
        toast({ title: 'Could not post your review', description: data?.error || data?.message || 'Please try again.', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Could not submit review', description: getFriendlyErrorMessage(error, 'Please try again.'), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
          <DialogDescription>Share your experience with {product.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Your rating</Label>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} type="button" onClick={() => setRating(i + 1)} aria-label={`${i + 1} star${i ? 's' : ''}`} className="rounded p-0.5">
                  <Star className={`h-8 w-8 transition-colors ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 hover:text-amber-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="review-comment">Your review</Label>
            <textarea
              id="review-comment"
              className="mt-2 min-h-[120px] w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-neutral-700"
              placeholder="What did you like? How are you using it?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={submit} disabled={submitting || rating === 0}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : 'Submit review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const ProductTabs = memo(ProductTabsImpl)
