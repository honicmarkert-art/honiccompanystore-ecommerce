// Dictionary and word processing utilities for search suggestions

export interface DictionaryEntry {
  word: string
  frequency: number
  category?: string
  synonyms?: string[]
  related?: string[]
}

// Common product-related words that should be prioritized
export const PRODUCT_KEYWORDS = [
  'arduino', 'raspberry pi', 'sensor', 'led', 'resistor', 'capacitor',
  'breadboard', 'motor', 'servo', 'camera', 'display', 'screen',
  'battery', 'power', 'usb', 'wireless', 'bluetooth', 'wifi',
  'microcontroller', 'development', 'kit', 'starter', 'beginner',
  'electronic', 'component', 'module', 'shield', 'board',
  'digital', 'analog', 'prototype', 'project', 'diy'
]

// Common brand names that should be prioritized
export const BRAND_KEYWORDS = [
  'arduino', 'raspberry pi', 'esp32', 'esp8266', 'nodemcu',
  'stm32', 'atmega', 'pic', 'intel', 'amd', 'nvidia',
  'samsung', 'apple', 'sony', 'lg', 'panasonic', 'philips'
]

// Category keywords
export const CATEGORY_KEYWORDS = [
  'electronics', 'computers', 'phones', 'accessories', 'components',
  'tools', 'kits', 'boards', 'modules', 'sensors', 'actuators',
  'power', 'communication', 'storage', 'display', 'input'
]

// Function to clean and normalize search terms
export function normalizeSearchTerm(term: string): string {
  return term
    .toLowerCase()
    .trim()
    // Treat separators uniformly: slashes, hyphens, underscores, commas → spaces
    .replace(/[\/_\-,:]+/g, ' ')
    // Remove remaining non-alphanumeric characters
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
}

// Function to extract keywords from text
export function extractKeywords(text: string): string[] {
  const normalized = normalizeSearchTerm(text)
  const words = normalized.split(' ')
  
  return words.filter(word => 
    word.length >= 2 && // Minimum length
    !isStopWord(word) && // Not a stop word
    !/^\d+$/.test(word) // Not just numbers
  )
}

// Common stop words that should be ignored
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
  'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
])

// Check if a word is a stop word
export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase())
}

// Calculate relevance score for search suggestions
export function calculateRelevanceScore(suggestion: string, query: string): number {
  const suggestionLower = suggestion.toLowerCase()
  const queryLower = query.toLowerCase()
  const normalizedSuggestion = normalizeSearchTerm(suggestionLower)
  const normalizedQuery = normalizeSearchTerm(queryLower)
  
  let score = 0
  
  // Tokenize for coverage scoring
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const suggestionTokens = normalizedSuggestion.split(/\s+/).filter(Boolean)
  const tokenSet = new Set(suggestionTokens)
  const overlapCount = queryTokens.reduce((acc, token) => acc + (tokenSet.has(token) ? 1 : 0), 0)
  const coverage = queryTokens.length > 0 ? overlapCount / queryTokens.length : 0

  // Exact match gets highest score
  if (suggestionLower === queryLower) score += 200
  if (normalizedSuggestion === normalizedQuery) score += 220
  
  // Starts with query gets high score
  if (suggestionLower.startsWith(queryLower)) score += 80
  if (normalizedSuggestion.startsWith(normalizedQuery)) score += 90
  
  // Contains query gets medium score
  if (suggestionLower.includes(queryLower)) score += 60
  if (normalizedSuggestion.includes(normalizedQuery)) score += 70
  
  // Coverage scoring (prioritize suggestions that cover most of the query terms)
  // Up to +100 points based on percentage of query tokens found
  score += Math.round(coverage * 100)

  // Word boundary match gets bonus
  const words = normalizedSuggestion.split(' ')
  for (const word of words) {
    if (word.startsWith(normalizedQuery)) {
      score += 30
    }
  }
  
  // Product keywords get priority
  if (PRODUCT_KEYWORDS.some(keyword => suggestionLower.includes(keyword))) {
    score += 20
  }
  
  // Brand keywords get priority
  if (BRAND_KEYWORDS.some(keyword => suggestionLower.includes(keyword))) {
    score += 15
  }
  
  // Category keywords get priority
  if (CATEGORY_KEYWORDS.some(keyword => suggestionLower.includes(keyword))) {
    score += 10
  }
  
  // Shorter suggestions get slight preference (more specific)
  if (suggestion.length < 20) {
    score += 10
  }

  // Penalize extremely long suggestions a bit
  if (suggestion.length > 60) {
    score -= Math.min(20, Math.floor((suggestion.length - 60) / 5))
  }

  // Domain-specific boosts (e.g., RF, LoRa, transceiver, module)
  const DOMAIN_TERMS = [
    'lora', 'rf', 'transceiver', 'transceiver module', 'rf module', 'rf transceiver', 'rf transceiver module'
  ]
  for (const term of DOMAIN_TERMS) {
    if (normalizedSuggestion.includes(term)) {
      score += 25
    }
  }
  
  return score
}

// Generate search suggestions from a list of items
export function generateSuggestions(
  items: string[], 
  query: string, 
  maxSuggestions: number = 8
): string[] {
  if (!query || query.length < 2) return []
  
  const normalizedQuery = normalizeSearchTerm(query)
  
  // Calculate scores for all items
  const scoredItems = items.map(item => ({
    item,
    score: calculateRelevanceScore(item, normalizedQuery)
  }))
  
  // Filter out items with no match and sort by score
  return scoredItems
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map(({ item }) => item)
}

// Expand search terms with synonyms and related terms
export function expandSearchTerms(terms: string[]): string[] {
  const expanded = new Set<string>()
  
  terms.forEach(term => {
    expanded.add(term)
    
    // Add common variations
    if (term.includes('board')) {
      expanded.add(term.replace('board', 'module'))
      expanded.add(term.replace('board', 'shield'))
    }
    
    if (term.includes('module')) {
      expanded.add(term.replace('module', 'board'))
      expanded.add(term.replace('module', 'shield'))
    }
    
    // Add plural/singular variations
    if (term.endsWith('s')) {
      expanded.add(term.slice(0, -1))
    } else {
      expanded.add(term + 's')
    }
  })
  
  return Array.from(expanded)
}

// Create a simple dictionary from text data
export function createDictionaryFromText(texts: string[]): Map<string, number> {
  const dictionary = new Map<string, number>()
  
  texts.forEach(text => {
    const keywords = extractKeywords(text)
    keywords.forEach(keyword => {
      dictionary.set(keyword, (dictionary.get(keyword) || 0) + 1)
    })
  })
  
  return dictionary
}


