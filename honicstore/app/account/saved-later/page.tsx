"use client"

/** Saved for later: items moved out of the cart (or from the wishlist) to buy another time. */
import { useSavedLater } from '@/hooks/use-saved-later'
import { useWishlist } from '@/hooks/use-wishlist'
import { SavedProducts } from '@/components/account/saved-products'

export default function SavedLaterPage() {
  const { items, loading, remove } = useSavedLater()
  const wishlist = useWishlist()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Saved for later</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {items.length ? `${items.length} item${items.length === 1 ? '' : 's'} waiting. Add them to your cart when you are ready.` : 'Items you set aside from your cart.'}
        </p>
      </div>
      <SavedProducts
        kind="saved"
        entries={items}
        loading={loading}
        remove={remove}
        moveTo={async (id) => { await wishlist.add(id); await remove(id) }}
      />
    </div>
  )
}
