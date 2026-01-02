/**
 * Robust Fuzzy Search Implementation
 * 
 * Combines multiple fuzzy matching algorithms:
 * - Levenshtein distance for accurate typo detection
 * - Fuse.js for advanced fuzzy matching
 * - Custom character-by-character matching
 * - Synonym expansion
 * - Multi-field search (name, brand, model, SKU, specs, variants)
 */

import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import { expandQueryWithSynonyms } from './search-synonyms'
import { searchCache } from './search-cache'

export interface RobustSearchableProduct {
  id: number
  name: string
  description: string
  category: string
  brand: string
  price: number
  tags?: string[]
  sku?: string
  model?: string
  specifications?: Record<string, any>
  variants?: Array<{
    variant_name?: string
    sku?: string
    model?: string
  }>
}

/**
 * Calculate Levenshtein distance between two strings
 * More accurate than simple character-by-character comparison
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  
  // Create matrix
  const matrix: number[][] = []
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  
  return matrix[len1][len2]
}

/**
 * Calculate similarity score (0-1) between two strings
 * 1 = identical, 0 = completely different
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1
  if (str1.length === 0 || str2.length === 0) return 0
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase())
  const maxLen = Math.max(str1.length, str2.length)
  return 1 - (distance / maxLen)
}

/**
 * Extract all searchable text from a product
 */
export function extractSearchableText(product: RobustSearchableProduct): string {
  const parts: string[] = []
  
  // Core fields
  if (product.name) parts.push(product.name)
  if (product.brand) parts.push(product.brand)
  if (product.category) parts.push(product.category)
  if (product.description) parts.push(product.description)
  if (product.model) parts.push(product.model)
  if (product.sku) parts.push(product.sku)
  
  // Tags
  if (product.tags && Array.isArray(product.tags)) {
    parts.push(...product.tags)
  }
  
  // Specifications (keys and values)
  if (product.specifications && typeof product.specifications === 'object') {
    Object.entries(product.specifications).forEach(([key, value]) => {
      parts.push(key)
      if (typeof value === 'string') {
        parts.push(value)
      } else if (typeof value === 'object' && value !== null) {
        parts.push(JSON.stringify(value))
      }
    })
  }
  
  // Variants
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach(variant => {
      if (variant.variant_name) parts.push(variant.variant_name)
      if (variant.sku) parts.push(variant.sku)
      if (variant.model) parts.push(variant.model)
    })
  }
  
  return parts.join(' ').toLowerCase()
}

/**
 * Enhanced Fuse.js configuration with all product fields
 */
const ROBUST_FUSE_OPTIONS: IFuseOptions<RobustSearchableProduct> = {
  keys: [
    { name: 'name', weight: 4 },              // Highest priority
    { name: 'brand', weight: 3 },              // Very high priority
    { name: 'model', weight: 2.5 },           // High priority
    { name: 'sku', weight: 2 },               // High priority for exact matches
    { name: 'category', weight: 2 },           // High priority
    { name: 'description', weight: 1 },        // Lower priority
    { name: 'tags', weight: 1.5 },            // Medium priority
  ],
  
  // More aggressive fuzzy matching
  threshold: 0.6,              // 0 = perfect match, 1 = match anything (0.6 = more lenient for typos)
  distance: 200,               // Increased distance for better typo tolerance
  minMatchCharLength: 2,       // Minimum characters to match
  includeScore: true,          // Include relevance score
  includeMatches: true,        // Include match details
  
  // Performance settings
  useExtendedSearch: true,     // Enable advanced search patterns
  ignoreLocation: true,        // Don't care where in string match occurs
  findAllMatches: true,        // Find all matches, not just first
  
  // Sort by relevance score
  shouldSort: true,
}

/**
 * Create Fuse search instance with robust configuration
 */
export function createRobustProductSearch(
  products: RobustSearchableProduct[]
): Fuse<RobustSearchableProduct> {
  return new Fuse(products, ROBUST_FUSE_OPTIONS)
}

/**
 * Multi-method fuzzy search combining:
 * 1. Exact matches (highest priority)
 * 2. Fuse.js fuzzy matching
 * 3. Levenshtein distance matching
 * 4. Custom character-by-character matching
 * 5. Synonym expansion
 */
export function robustFuzzySearch(
  products: RobustSearchableProduct[],
  query: string,
  options: {
    maxResults?: number
    minScore?: number
    useSynonyms?: boolean
    useLevenshtein?: boolean
    useFuse?: boolean
    useCache?: boolean
  } = {}
): Array<RobustSearchableProduct & { searchScore: number; matchType: string }> {
  const {
    maxResults = 100,
    minScore = 0.3,      // Lower threshold for more results
    useSynonyms = true,
    useLevenshtein = true,
    useFuse = true,
    useCache = true,
  } = options
  
  if (!query || query.trim().length === 0) {
    return products.slice(0, maxResults).map(p => ({
      ...p,
      searchScore: 1,
      matchType: 'no-query'
    }))
  }
  
  const normalizedQuery = query.toLowerCase().trim()
  
  // Check cache first (if enabled)
  if (useCache) {
    const cached = searchCache.get<Array<RobustSearchableProduct & { searchScore: number; matchType: string }>>(
      normalizedQuery,
      options
    )
    if (cached) {
      return cached
    }
  }
  
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
  
  // Generate variations for concatenated words (e.g., "lodicell" → "lodi cell", "load cell")
  const generateWordVariations = (word: string): string[] => {
    const variations = new Set<string>([word])
    
    // If word is long enough (6+ chars), try splitting it
    // This helps catch typos like "lodicell" → "load cell"
    if (word.length >= 6) {
      // Try splitting at various positions
      for (let i = 3; i <= word.length - 3; i++) {
        const part1 = word.substring(0, i)
        const part2 = word.substring(i)
        if (part1.length >= 3 && part2.length >= 3) {
          variations.add(`${part1} ${part2}`)
        }
      }
      
      // Try common word boundaries (4 chars is common for first word)
      if (word.length >= 7) {
        variations.add(`${word.substring(0, 4)} ${word.substring(4)}`)
        variations.add(`${word.substring(0, 5)} ${word.substring(5)}`)
      }
    }
    
    return Array.from(variations)
  }
  
  // Generate variations for each word in the query
  const wordVariations = new Set<string>()
  queryWords.forEach(word => {
    generateWordVariations(word).forEach(variation => {
      wordVariations.add(variation)
    })
  })
  
  // Expand query with synonyms (OPTIMIZED: Limited to 1-2 synonyms per term)
  const searchTerms = useSynonyms
    ? expandQueryWithSynonyms(normalizedQuery, 2) // Limit to 2 synonyms max
    : [normalizedQuery]
  
  // Add word variations to search terms
  wordVariations.forEach(variation => {
    searchTerms.push(variation)
  })
  
  // Combine all search terms (original + synonyms + word variations)
  const allSearchTerms = new Set<string>()
  searchTerms.forEach(term => {
    allSearchTerms.add(term)
    term.split(/\s+/).forEach(word => {
      if (word.length >= 2) allSearchTerms.add(word)
    })
  })
  
  // Results map: productId -> { product, bestScore, matchType }
  const results = new Map<number, {
    product: RobustSearchableProduct
    bestScore: number
    matchType: string
  }>()
  
  // Method 1: Fuse.js fuzzy matching (if enabled)
  if (useFuse) {
    const fuse = createRobustProductSearch(products)
    
    allSearchTerms.forEach(term => {
      const fuseResults = fuse.search(term, { limit: maxResults * 2 })
      
      fuseResults.forEach(result => {
        const product = result.item
        const fuseScore = result.score || 1
        const normalizedScore = 1 - fuseScore // Convert to 0-1 where 1 is best
        
        if (!results.has(product.id) || results.get(product.id)!.bestScore < normalizedScore) {
          results.set(product.id, {
            product,
            bestScore: normalizedScore,
            matchType: 'fuse'
          })
        }
      })
    })
  }
  
  // Method 2: Levenshtein distance matching (OPTIMIZED: Only when needed)
  // Enhanced to catch typos like "lodicell" -> "load cell"
  if (useLevenshtein) {
    const FUSE_THRESHOLD = 0.7 // Only use Levenshtein if Fuse score is below this (increased to always run)
    const MAX_LENGTH_DIFF = 10 // Increased to catch longer typos (was 2, now 10 for concatenated words)
    const MIN_SIMILARITY = 0.4 // Lower threshold for better typo detection (was 0.7, now 0.4)
    
    products.forEach(product => {
      const currentResult = results.get(product.id)
      const fuseScore = currentResult?.bestScore || 0
      
      // OPTIMIZATION: Skip Levenshtein if Fuse.js already found a very good match
      // But for single-word queries (likely concatenated words), always run Levenshtein
      const isSingleWordQuery = queryWords.length === 1 && normalizedQuery.length >= 6
      if (fuseScore >= FUSE_THRESHOLD && !isSingleWordQuery) {
        return
      }
      
      const searchableText = extractSearchableText(product)
      const productWords = searchableText.split(/\s+/).filter(w => w.length >= 2)
      
      let bestSimilarity = 0
      let matched = false
      
      // First, try matching the full query against the full searchable text (for phrases)
      const fullQuery = normalizedQuery
      const fullTextSimilarity = calculateSimilarity(fullQuery, searchableText.toLowerCase())
      if (fullTextSimilarity >= MIN_SIMILARITY) {
        matched = true
        bestSimilarity = Math.max(bestSimilarity, fullTextSimilarity)
      }
      
      // Also try matching against product name specifically (often most important)
      const productNameLower = (product.name || '').toLowerCase()
      const nameSimilarity = calculateSimilarity(fullQuery, productNameLower)
      if (nameSimilarity >= MIN_SIMILARITY) {
        matched = true
        bestSimilarity = Math.max(bestSimilarity, nameSimilarity * 1.2) // Boost name matches
      }
      
      // Special handling for single-word queries that might match multi-word phrases
      // e.g., "lodicell" should match "load cell"
      if (queryWords.length === 1 && fullQuery.length >= 6) {
        const singleWord = fullQuery
        
        // Extract just the main words from product name (remove model numbers, specs, etc.)
        // "Load Cell ( CZL616C ) 5kg" -> "load cell"
        let nameWordsOnly = productNameLower
          .replace(/\([^)]*\)/g, '') // Remove parentheses content like "( CZL616C )"
          .replace(/\[[^\]]*\]/g, '') // Remove brackets
          .replace(/\d+[a-z]*/gi, '') // Remove numbers and units like "5kg", "10ml"
          .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+/g, ' ')
          .trim()
        
        // If name is still too long, try to extract first 2-3 meaningful words
        const nameWords = nameWordsOnly.split(/\s+/).filter(w => w.length >= 3)
        if (nameWords.length > 3) {
          nameWordsOnly = nameWords.slice(0, 3).join(' ')
        }
        
        const nameWordsOnlyNoSpaces = nameWordsOnly.replace(/\s+/g, '')
        
        // Try matching against cleaned product name with spaces removed
        // "lodicell" vs "loadcell" should match well
        if (nameWordsOnlyNoSpaces.length > 0) {
          const nameWithoutSpacesSimilarity = calculateSimilarity(singleWord, nameWordsOnlyNoSpaces)
          if (nameWithoutSpacesSimilarity >= MIN_SIMILARITY) {
            matched = true
            bestSimilarity = Math.max(bestSimilarity, nameWithoutSpacesSimilarity * 1.5) // Higher boost for concatenated matches
          }
        }
        
        // Also try matching against the cleaned name with spaces (for partial matches)
        if (nameWordsOnly.length > 0) {
          const nameWithSpacesSimilarity = calculateSimilarity(singleWord, nameWordsOnly)
          if (nameWithSpacesSimilarity >= MIN_SIMILARITY) {
            matched = true
            bestSimilarity = Math.max(bestSimilarity, nameWithSpacesSimilarity * 1.3)
          }
        }
        
        // Try matching against individual words from cleaned name
        nameWords.forEach(word => {
          if (word.length >= 3) {
            const wordSimilarity = calculateSimilarity(singleWord, word)
            if (wordSimilarity >= MIN_SIMILARITY) {
              matched = true
              bestSimilarity = Math.max(bestSimilarity, wordSimilarity * 0.8) // Lower boost for single word matches
            }
          }
        })
        
        // Try matching against full searchable text with spaces removed (fallback)
        const textWithoutSpaces = searchableText.toLowerCase().replace(/\s+/g, '')
        const textWithoutSpacesSimilarity = calculateSimilarity(singleWord, textWithoutSpaces)
        if (textWithoutSpacesSimilarity >= MIN_SIMILARITY) {
          matched = true
          bestSimilarity = Math.max(bestSimilarity, textWithoutSpacesSimilarity * 0.9)
        }
      }
      
      // Then check each search term against each product word (for individual word typos)
      allSearchTerms.forEach(searchTerm => {
        productWords.forEach(productWord => {
          // Skip if already exact match (handled by Fuse.js)
          if (productWord === searchTerm) {
            matched = true
            bestSimilarity = Math.max(bestSimilarity, 1)
            return
          }
          
          // OPTIMIZATION: Only run Levenshtein if length difference ≤ MAX_LENGTH_DIFF
          const lengthDiff = Math.abs(searchTerm.length - productWord.length)
          if (lengthDiff > MAX_LENGTH_DIFF) {
            return // Skip - strings too different in length
          }
          
          // Calculate similarity using Levenshtein distance
          const similarity = calculateSimilarity(searchTerm, productWord)
          
          // Accept if similarity >= MIN_SIMILARITY
          if (similarity >= MIN_SIMILARITY) {
            matched = true
            bestSimilarity = Math.max(bestSimilarity, similarity)
          }
        })
      })
      
      if (matched && bestSimilarity >= MIN_SIMILARITY) {
        const current = results.get(product.id)
        if (!current || current.bestScore < bestSimilarity) {
          results.set(product.id, {
            product,
            bestScore: bestSimilarity,
            matchType: 'levenshtein'
          })
        }
      }
    })
  }
  
  // Method 3: Custom scoring with field priorities (NORMALIZED: 0-100 scale)
  products.forEach(product => {
    const nameLower = (product.name || '').toLowerCase()
    const brandLower = (product.brand || '').toLowerCase()
    const modelLower = (product.model || '').toLowerCase()
    const skuLower = (product.sku || '').toLowerCase()
    const categoryLower = (product.category || '').toLowerCase()
    const descLower = (product.description || '').toLowerCase()
    
    // Scoring components (0-100 scale)
    let exactScore = 0
    let partialScore = 0
    let typoScore = 0
    let matchType = 'custom'
    
    // Exact matches get highest scores
    queryWords.forEach(word => {
      // Name exact match
      if (nameLower === word) {
        exactScore = Math.max(exactScore, 100)
        matchType = 'exact-name'
      }
      // Brand exact match
      else if (brandLower === word) {
        exactScore = Math.max(exactScore, 80)
        matchType = 'exact-brand'
      }
      // Model exact match
      else if (modelLower === word) {
        exactScore = Math.max(exactScore, 70)
        matchType = 'exact-model'
      }
      // SKU exact match
      else if (skuLower === word) {
        exactScore = Math.max(exactScore, 60)
        matchType = 'exact-sku'
      }
      // Name contains
      else if (nameLower.includes(word)) {
        partialScore = Math.max(partialScore, 50)
        matchType = 'name-contains'
      }
      // Brand contains
      else if (brandLower.includes(word)) {
        partialScore = Math.max(partialScore, 40)
        matchType = 'brand-contains'
      }
      // Model contains
      else if (modelLower.includes(word)) {
        partialScore = Math.max(partialScore, 35)
        matchType = 'model-contains'
      }
      // Category contains
      else if (categoryLower.includes(word)) {
        partialScore = Math.max(partialScore, 20)
        matchType = 'category-contains'
      }
      // Description contains
      else if (descLower.includes(word)) {
        partialScore = Math.max(partialScore, 10)
        matchType = 'description-contains'
      }
    })
    
    // Weighted sum: exact (50%) + partial (30%) + typo (20%)
    // Convert to 0-1 range for consistency
    const finalScore = (
      (exactScore * 0.5) +
      (partialScore * 0.3) +
      (typoScore * 0.2)
    ) / 100
    
    if (finalScore > 0) {
      const current = results.get(product.id)
      if (!current || current.bestScore < finalScore) {
        results.set(product.id, {
          product,
          bestScore: finalScore,
          matchType
        })
      }
    }
  })
  
  // Convert to array, filter by minScore, and sort by match quality
  const finalResults = Array.from(results.values())
    .filter(({ bestScore }) => bestScore >= minScore)
    .sort((a, b) => {
      // PRIORITY 1: Exact matches come first
      const aIsExact = a.matchType.startsWith('exact')
      const bIsExact = b.matchType.startsWith('exact')
      if (aIsExact && !bIsExact) return -1
      if (!aIsExact && bIsExact) return 1
      
      // PRIORITY 2: Within exact matches, prioritize by match type quality
      if (aIsExact && bIsExact) {
        // exact-name > exact-brand > exact-model > exact-sku > exact-postgresql
        const typeOrder: Record<string, number> = {
          'exact-name': 5,
          'exact-brand': 4,
          'exact-model': 3,
          'exact-sku': 2,
          'exact-postgresql': 1
        }
        const aOrder = typeOrder[a.matchType] || 0
        const bOrder = typeOrder[b.matchType] || 0
        if (aOrder !== bOrder) return bOrder - aOrder
      }
      
      // PRIORITY 3: Fuse matches are better than Levenshtein (more accurate)
      if (!aIsExact && !bIsExact) {
        if (a.matchType === 'fuse' && b.matchType === 'levenshtein') return -1
        if (a.matchType === 'levenshtein' && b.matchType === 'fuse') return 1
      }
      
      // PRIORITY 4: Sort by score (higher is better)
      const scoreDiff = b.bestScore - a.bestScore
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff // Significant difference
      
      // PRIORITY 5: If scores are very close, prefer name matches
      const aName = (a.product.name || '').toLowerCase()
      const bName = (b.product.name || '').toLowerCase()
      const queryLower = normalizedQuery.toLowerCase()
      const aNameMatch = aName.includes(queryLower) || queryLower.includes(aName)
      const bNameMatch = bName.includes(queryLower) || queryLower.includes(bName)
      if (aNameMatch && !bNameMatch) return -1
      if (!aNameMatch && bNameMatch) return 1
      
      // PRIORITY 6: Final tiebreaker - prefer shorter names (more specific)
      return aName.length - bName.length
    })
    .slice(0, maxResults)
    .map(({ product, bestScore, matchType }) => ({
      ...product,
      searchScore: bestScore,
      matchType
    }))
  
  // Cache results (if enabled)
  if (useCache && finalResults.length > 0) {
    searchCache.set(normalizedQuery, finalResults, options, 5 * 60 * 1000) // 5 min TTL
  }
  
  return finalResults
}

/**
 * Combine multiple search methods for maximum robustness
 */
export function comprehensiveSearch(
  products: RobustSearchableProduct[],
  query: string,
  options: {
    maxResults?: number
    combineMethods?: boolean
    useCache?: boolean
    minScore?: number
  } = {}
): Array<RobustSearchableProduct & { searchScore: number; matchType: string }> {
  const { maxResults = 100, combineMethods = true, useCache = true, minScore = 0.3 } = options
  
  if (combineMethods) {
    // Use all methods simultaneously and combine results
    // Method 1: Fuse.js with synonyms (fast, good for general fuzzy matching)
    const fuseResults = robustFuzzySearch(products, query, {
      maxResults: maxResults * 2,
      useFuse: true,
      useLevenshtein: false, // Run separately for optimization
      useSynonyms: true,
      useCache: useCache,
      minScore: minScore
    })
    
    // Method 2: Levenshtein with synonyms (slower but better for typos)
    const levenshteinResults = robustFuzzySearch(products, query, {
      maxResults: maxResults * 2,
      useFuse: false, // Run separately for optimization
      useLevenshtein: true,
      useSynonyms: true,
      useCache: useCache,
      minScore: minScore
    })
    
    // Method 3: Combined Fuse + Levenshtein (most comprehensive)
    const combinedResults = robustFuzzySearch(products, query, {
      maxResults: maxResults * 2,
      useFuse: true,
      useLevenshtein: true, // Both together for best coverage
      useSynonyms: true,
      useCache: useCache,
      minScore: minScore
    })
    
    // Combine and deduplicate all results from all methods
    const combined = new Map<number, {
      product: RobustSearchableProduct
      bestScore: number
      matchType: string
    }>()
    
    // Combine results from all three method runs
    const allResults = [...fuseResults, ...levenshteinResults, ...combinedResults]
    allResults.forEach(result => {
      const current = combined.get(result.id)
      // Keep the best score and most specific match type
      if (!current || current.bestScore < result.searchScore) {
        combined.set(result.id, {
          product: result,
          bestScore: result.searchScore,
          matchType: result.matchType
        })
      }
    })
    
    return Array.from(combined.values())
      .sort((a, b) => {
        // Prioritize exact matches
        const aIsExact = a.matchType.startsWith('exact')
        const bIsExact = b.matchType.startsWith('exact')
        if (aIsExact && !bIsExact) return -1
        if (!aIsExact && bIsExact) return 1
        // Then by score
        return b.bestScore - a.bestScore
      })
      .slice(0, maxResults)
      .map(({ product, bestScore, matchType }) => ({
        ...product,
        searchScore: bestScore,
        matchType
      }))
  } else {
    // Use single comprehensive method
    return robustFuzzySearch(products, query, {
      maxResults,
      useFuse: true,
      useLevenshtein: true,
      useSynonyms: true,
      useCache: useCache,
      minScore: minScore
    })
  }
}

