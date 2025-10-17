"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"

export interface SavedLaterEntry {
	productId: number
	addedAt: string
}

const LOCAL_KEY = "saved_later_items_v1"

export function useSavedLater() {
	const { isAuthenticated } = useAuth()
	const [items, setItems] = useState<SavedLaterEntry[]>([])
	const [loading, setLoading] = useState(false)

	const loadLocal = useCallback(() => {
		try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
	}, [])

	const saveLocal = useCallback((next: SavedLaterEntry[]) => {
		try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch {}
	}, [])

	const fetchRemote = useCallback(async (): Promise<SavedLaterEntry[] | null> => {
		try {
			const res = await fetch('/api/user/saved-later', { cache: 'no-store' })
			if (!res.ok) return null
			const data = await res.json()
			return data?.items || []
		} catch {
			return null
		}
	}, [])

	useEffect(() => {
		(async () => {
			setLoading(true)
			if (isAuthenticated) {
				try {
					const res = await fetch('/api/user/saved-later', { cache: 'no-store' })
					if (res.ok) {
						const data = await res.json()
						const remote = data?.items || []
						setItems(remote)
						setLoading(false)
						return
					}
				} catch {}
			}
			// Load from localStorage
			try {
				const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
				setItems(local)
			} catch {
				setItems([])
			}
			setLoading(false)
		})()
	}, [isAuthenticated])

	const add = useCallback(async (productId: number) => {
		const now = new Date().toISOString()
		const next = [{ productId, addedAt: now }, ...items.filter(i => i.productId !== productId)]
		setItems(next)
		if (isAuthenticated) { try { await fetch('/api/user/saved-later', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) }) } catch {} }
		else { saveLocal(next) }
	}, [items, isAuthenticated, saveLocal])

	const remove = useCallback(async (productId: number) => {
		const next = items.filter(i => i.productId !== productId)
		setItems(next)
		if (isAuthenticated) { try { await fetch(`/api/user/saved-later?productId=${productId}`, { method: 'DELETE' }) } catch {} }
		else { saveLocal(next) }
	}, [items, isAuthenticated, saveLocal])

	const has = useCallback((productId: number) => items.some(i => i.productId === productId), [items])

	return { items, loading, add, remove, has }
}


