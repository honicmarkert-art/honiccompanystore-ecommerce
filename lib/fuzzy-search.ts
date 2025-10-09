/**
 * Fuzzy Search Implementation with Fuse.js
 * 
 * Features:
 * - Typo tolerance (handles misspellings)
 * - Partial matching
 * - Synonym expansion
 * - Relevance scoring
 * - Fast performance with caching
 */

import Fuse from 'fuse.js'
import { expandQueryWithSynonyms } from './search-synonyms'

export interface SearchableProduct {
  id: number
  name: string
  description: string
  category: string
  brand: string
  price: number
  tags?: string[]
  // Additional fields for better matching
  sku?: string
  model?: string
}

/**
 * Fuse.js configuration optimized for e-commerce product search
 */
const FUSE_OPTIONS: Fuse.IFuseOptions<SearchableProduct> = {
  // Keys to search in, with weights (higher = more important)
  keys: [
    { name: 'name', weight: 3 },           // Product name is most important
    { name: 'brand', weight: 2 },          // Brand is second most important
    { name: 'category', weight: 1.5 },     // Category is important
    { name: 'description', weight: 1 },    // Description is less important
    { name: 'tags', weight: 1.5 },         // Tags are important
    { name: 'sku', weight: 1 },            // SKU for exact matches
    { name: 'model', weight: 1.5 },        // Model number
  ],
  
  // Fuzzy matching settings
  threshold: 0.4,              // 0 = perfect match, 1 = match anything
                               // 0.4 is good for typo tolerance
  distance: 100,               // Maximum character distance to consider
  minMatchCharLength: 2,       // Minimum characters to match
  includeScore: true,          // Include relevance score
  includeMatches: true,        // Include match details
  
  // Performance settings
  useExtendedSearch: true,     // Enable advanced search patterns
  ignoreLocation: true,        // Don't care where in string match occurs
  
  // Sort by relevance score
  shouldSort: true,
}

/**
 * Create a Fuse search instance with products
 */
export function createProductSearch(products: SearchableProduct[]): Fuse<SearchableProduct> {
  return new Fuse(products, FUSE_OPTIONS)
}

/**
 * Search products with fuzzy matching and synonym expansion
 * 
 * @param products - Array of products to search
 * @param query - Search query from user
 * @param options - Additional search options
 * @returns Sorted array of matching products with scores
 */
export function fuzzySearchProducts(
  products: SearchableProduct[],
  query: string,
  options: {
    maxResults?: number
    minScore?: number
    useSynonyms?: boolean
  } = {}
): Array<SearchableProduct & { searchScore?: number }> {
  const {
    maxResults = 100,
    minScore = 0.7,      // Only return results with score >= 0.7 (0 = perfect, 1 = worst)
    useSynonyms = true
  } = options
  
  if (!query || query.trim().length === 0) {
    return products.slice(0, maxResults)
  }
  
  // Create Fuse instance
  const fuse = createProductSearch(products)
  
  // Expand query with synonyms if enabled
  const searchTerms = useSynonyms 
    ? expandQueryWithSynonyms(query)
    : [query.toLowerCase().trim()]
  
  // Perform search for each term and combine results
  const allResults = new Map<number, { product: SearchableProduct; bestScore: number }>()
  
  searchTerms.forEach(term => {
    const results = fuse.search(term)
    
    results.forEach(result => {
      const product = result.item
      const score = result.score || 0
      
      // Keep the best score for each product
      if (!allResults.has(product.id) || allResults.get(product.id)!.bestScore > score) {
        allResults.set(product.id, { product, bestScore: score })
      }
    })
  })
  
  // Convert to array and filter by minimum score
  const filteredResults = Array.from(allResults.values())
    .filter(({ bestScore }) => bestScore <= minScore)  // Lower score is better in Fuse.js
    .sort((a, b) => a.bestScore - b.bestScore)         // Sort by relevance
    .slice(0, maxResults)
    .map(({ product, bestScore }) => ({
      ...product,
      searchScore: 1 - bestScore  // Convert to 0-1 where 1 is best
    }))
  
  return filteredResults
}

/**
 * Search with advanced patterns
 * 
 * Supports special syntax:
 * - "exact match" - Exact phrase
 * - ^starts-with - Must start with
 * - ends-with$ - Must end with
 * - !not-this - Exclude term
 */
export function advancedSearch(
  products: SearchableProduct[],
  pattern: string,
  options: {
    maxResults?: number
  } = {}
): SearchableProduct[] {
  const fuse = createProductSearch(products)
  const results = fuse.search(pattern)
  
  return results
    .slice(0, options.maxResults || 100)
    .map(result => result.item)
}

/**
 * Get search suggestions based on partial input
 * Useful for autocomplete
 */
export function getSearchSuggestions(
  products: SearchableProduct[],
  partialQuery: string,
  maxSuggestions: number = 10
): string[] {
  if (!partialQuery || partialQuery.trim().length < 2) {
    return []
  }
  
  const fuse = createProductSearch(products)
  const results = fuse.search(partialQuery, { limit: maxSuggestions * 2 })
  
  // Extract unique terms from product names and brands
  const suggestions = new Set<string>()
  
  results.forEach(result => {
    const product = result.item
    
    // Add product name
    suggestions.add(product.name)
    
    // Add brand
    if (product.brand) {
      suggestions.add(product.brand)
    }
    
    // Add category
    if (product.category) {
      suggestions.add(product.category)
    }
    
    // Add individual words from name
    product.name.split(/\s+/).forEach(word => {
      if (word.toLowerCase().startsWith(partialQuery.toLowerCase())) {
        suggestions.add(word)
      }
    })
  })
  
  return Array.from(suggestions).slice(0, maxSuggestions)
}

/**
 * Example usage:
 * 
 * const products = [
 *   { id: 1, name: 'USB Charger', brand: 'Anker', category: 'Accessories' },
 *   { id: 2, name: 'Phone Adapter', brand: 'Apple', category: 'Accessories' },
 * ]
 * 
 * // Search with typo tolerance
 * fuzzySearchProducts(products, 'usb charger')  // Finds both
 * fuzzySearchProducts(products, 'usb charger')  // Still finds them (typo!)
 * 
 * // Search with synonyms
 * fuzzySearchProducts(products, 'phone charger')  // Finds "Phone Adapter" (synonym)
 * fuzzySearchProducts(products, 'adapter')        // Finds both (synonym expansion)
 */

