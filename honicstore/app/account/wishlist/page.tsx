"use client"

/** Wishlist: products the shopper hearted. */
import { useWishlist } from '@/hooks/use-wishlist'
import { useSavedLater } from '@/hooks/use-saved-later'
import { SavedProducts } from '@/components/account/saved-products'

export default function WishlistPage() {
  const { items, loading, remove } = useWishlist()
  const saved = useSavedLater()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Wishlist</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {items.length ? `${items.length} product${items.length === 1 ? '' : 's'} you like. Prices and stock are live.` : 'Products you like, in one place.'}
        </p>
      </div>
      <SavedProducts
        kind="wishlist"
        entries={items}
        loading={loading}
        remove={remove}
        moveTo={async (id) => { await saved.add(id); await remove(id) }}
      />
    </div>
  )
}
