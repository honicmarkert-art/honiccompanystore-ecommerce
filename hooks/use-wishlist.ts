"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"

export interface WishlistEntry {
	productId: number
	addedAt: string
}

const LOCAL_KEY = "wishlist_items_v1"

export function useWishlist() {
	const { isAuthenticated } = useAuth()
	const [items, setItems] = useState<WishlistEntry[]>([])
	const [loading, setLoading] = useState<boolean>(false)
	const [error, setError] = useState<string | null>(null)

	const loadLocal = useCallback(() => {
		try {
			const raw = localStorage.getItem(LOCAL_KEY)
			if (!raw) return []
			const parsed = JSON.parse(raw)
			return Array.isArray(parsed) ? parsed as WishlistEntry[] : []
		} catch {
			return []
		}
	}, [])

	const saveLocal = useCallback((next: WishlistEntry[]) => {
		try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch {}
	}, [])

	const fetchRemote = useCallback(async (): Promise<WishlistEntry[] | null> => {
		try {
			const res = await fetch('/api/user/wishlist', { cache: 'no-store' })
			if (!res.ok) return null
			const data = await res.json()
			return (data?.items || []) as WishlistEntry[]
		} catch {
			return null
		}
	}, [])

	const syncFromSource = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			if (isAuthenticated) {
				const res = await fetch('/api/user/wishlist', { cache: 'no-store' })
				if (res.ok) {
					const data = await res.json()
					const remote = (data?.items || []) as WishlistEntry[]
					setItems(remote)
					return
				}
			}
			// Load from localStorage
			try {
				const raw = localStorage.getItem(LOCAL_KEY)
				if (raw) {
					const parsed = JSON.parse(raw)
					const local = Array.isArray(parsed) ? parsed as WishlistEntry[] : []
					setItems(local)
				} else {
					setItems([])
				}
			} catch {
				setItems([])
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load wishlist')
		} finally {
			setLoading(false)
		}
	}, [isAuthenticated])

	useEffect(() => {
		syncFromSource()
	}, [syncFromSource])

	const add = useCallback(async (productId: number) => {
		const now = new Date().toISOString()
		const next = [{ productId, addedAt: now }, ...items.filter(i => i.productId !== productId)]
		setItems(next)
		if (isAuthenticated) {
			try { await fetch('/api/user/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) }) } catch {}
		} else {
			saveLocal(next)
		}
	}, [items, isAuthenticated, saveLocal])

	const remove = useCallback(async (productId: number) => {
		const next = items.filter(i => i.productId !== productId)
		setItems(next)
		if (isAuthenticated) {
			try { await fetch(`/api/user/wishlist?productId=${productId}`, { method: 'DELETE' }) } catch {}
		} else {
			saveLocal(next)
		}
	}, [items, isAuthenticated, saveLocal])

	const has = useCallback((productId: number) => items.some(i => i.productId === productId), [items])

	return {
		items,
		loading,
		error,
		add,
		remove,
		has,
		reload: syncFromSource,
	}
}


