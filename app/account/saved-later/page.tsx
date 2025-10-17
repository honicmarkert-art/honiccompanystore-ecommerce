"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Trash2, Eye, Share2, Star } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useSavedLater } from '@/hooks/use-saved-later'
import { useProductsByIds } from '@/hooks/use-products-by-ids'
import { useCart } from '@/hooks/use-cart'
import { useRouter } from 'next/navigation'

export default function SavedLaterPage() {
	const { items, loading, remove } = useSavedLater()
	const { addItem } = useCart()
	const router = useRouter()
	
	// Get product IDs from saved-later entries - memoize to prevent infinite re-renders
	const productIds = useMemo(() => items.map(entry => entry.productId), [items])
	const { products, loading: productsLoading } = useProductsByIds(productIds)
	
	// Create saved-later items with full product data - memoize to prevent infinite re-renders
	const savedLaterItems = useMemo(() => {
		return products.map(product => {
			const savedEntry = items.find(entry => entry.productId === product.id)
			return {
				...product,
				addedDate: savedEntry ? new Date(savedEntry.addedAt) : new Date()
			}
		})
	}, [products, items])

const handleAddToCart = (product: any) => {
		const qty = 1
		const price = product.price
		addItem(product.id, qty, undefined, {}, price)
	}

	const handleRemove = async (productId: number) => {
		await remove(productId)
	}

	const handleViewProduct = (productId: number) => {
		router.push(`/products/${productId}`)
	}

	const getDiscountPercentage = (originalPrice: number, currentPrice: number) => {
		return Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
	}

	return (
		<div className="container mx-auto px-4 pt-1 pb-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold -mt-2">Saved for Later</h1>
				<p className="text-muted-foreground">
					{savedLaterItems.length} items saved for later
				</p>
			</div>

			{loading || productsLoading ? (
				<div className="flex items-center justify-center h-64">
					<div className="text-lg">Loading saved items...</div>
				</div>
			) : savedLaterItems.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<p className="mb-4">No items saved for later.</p>
						<Link href="/products"><Button>Browse Products</Button></Link>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 gap-1 px-1 sm:px-2 lg:px-3">
					{savedLaterItems.map((product) => (
						<Card 
							key={product.id} 
							className="flex flex-col overflow-hidden rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
							style={{ contentVisibility: 'auto', containIntrinsicSize: '320px 420px' }}
						>
							<Link 
								href={`/products/${product.id}`} 
								className="block relative aspect-square overflow-hidden" 
							>
								<Image
									src={product.image}
									alt={product.name}
									fill
									className="object-cover transition-transform duration-300 hover:scale-105"
									sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 20vw"
								/>
								{/* Discount Badge */}
								{product.originalPrice && product.originalPrice > product.price && (
									<div className="absolute top-0 right-0 sm:top-0 sm:right-1.5 z-10">
										<span className="bg-black/60 text-white text-[8px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-none shadow-sm sm:shadow-md">
											{getDiscountPercentage(product.originalPrice, product.price).toFixed(0)}% OFF
										</span>
									</div>
								)}
								{/* Out of Stock Badge */}
								{!product.inStock && (
									<div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10">
										<span className="bg-red-500 text-white text-[8px] sm:text-[10px] px-0.5 sm:px-1 py-0.5 rounded-none shadow-sm sm:shadow-md">
											Out of Stock
										</span>
									</div>
								)}
								{/* Remove Button */}
								<div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-10">
									<Button
										variant="ghost"
										size="sm"
										onClick={(e) => {
											e.preventDefault()
											handleRemove(product.id)
										}}
										className="bg-white/80 hover:bg-white p-1 h-6 w-6"
									>
										<Trash2 className="w-3 h-3 text-red-600" />
									</Button>
								</div>
							</Link>
							<CardContent className="p-1 flex-1 flex flex-col justify-between">
								<Link href={`/products/${product.id}`} className="block">
									<h3 className="text-xs font-semibold sm:text-sm lg:text-base hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
										{product.name}
									</h3>
								</Link>
								{/* Rating */}
								<div className="flex items-center gap-1 text-[10px] mt-0.5 sm:text-xs text-gray-500 dark:text-gray-400">
									{Array.from({ length: 5 }).map((_, i) => (
										<Star
											key={i}
											className={`w-3 h-3 ${
												i < Math.floor(product.rating)
													? "fill-yellow-400 text-yellow-400"
													: "text-gray-300 dark:text-gray-600"
											}`}
										/>
									))}
									<span>({product.reviews})</span>
								</div>
								{/* Price */}
								<div className="flex flex-wrap items-baseline gap-x-2 mt-0.5">
									<div className="text-sm font-bold sm:text-base lg:text-lg">
										TZS {product.price.toFixed(0)}
									</div>
									{product.originalPrice && product.originalPrice > product.price && (
										<div className="text-xs text-gray-500 dark:text-gray-400 line-through">
											TZS {product.originalPrice.toFixed(0)}
										</div>
									)}
								</div>
								{/* Action Buttons */}
								<div className="flex gap-1 mt-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleViewProduct(product.id)}
										className="flex-1 text-xs h-7"
									>
										<Eye className="w-3 h-3 mr-1" />
										View
									</Button>
									<Button
										size="sm"
										disabled={!product.inStock}
										onClick={() => handleAddToCart(product)}
										className="flex-1 text-xs h-7"
									>
										<ShoppingCart className="w-3 h-3 mr-1" />
										Add
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}


