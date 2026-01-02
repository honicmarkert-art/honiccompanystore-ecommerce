/**
 * Search Query Normalization
 * 
 * Improves search tolerance by normalizing user input to match how search_vector stores data.
 * Handles:
 * - Hyphens: "load-cell" → "load cell"
 * - No spaces: "loadcell" → "load cell" (word boundary detection)
 * - Spaces in numbers: "5 kg" → "5kg"
 * - Plural forms: "cells" → "cell" (basic plural handling)
 * - Case: Already handled by database (case-insensitive)
 */

/**
 * Normalize search query to improve matching
 * @param query - Raw search query from user
 * @returns Normalized query that better matches search_vector format
 */
export function normalizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return ''
  
  let normalized = query.trim()
  
  // Step 0: Detect model numbers (like "CZL-616-C", "CZL616C") and preserve them
  // Model numbers typically have pattern: letters-numbers-letters or letters-numbers
  const modelNumberPattern = /([A-Z]{2,})([-_]?)(\d+)([-_]?)([A-Z]?)/g
  const modelMatches: Array<{ original: string; normalized: string }> = []
  let matchIndex = 0
  
  normalized = normalized.replace(modelNumberPattern, (match, letters, sep1, numbers, sep2, trailingLetter) => {
    // Create normalized version: "CZL616C" (no separators) and "CZL 616 C" (with spaces)
    const compact = `${letters}${numbers}${trailingLetter || ''}`
    const spaced = `${letters} ${numbers}${trailingLetter ? ' ' + trailingLetter : ''}`
    const placeholder = `__MODEL_${matchIndex}__`
    modelMatches.push({ original: match, normalized: `${compact} ${spaced}` })
    matchIndex++
    return placeholder
  })
  
  // Step 1: Replace hyphens with spaces (for non-model-number parts)
  // "load-cell" → "load cell"
  normalized = normalized.replace(/-/g, ' ')
  
  // Step 2: Handle spaces between numbers and units
  // "5 kg" → "5kg", "10 ml" → "10ml"
  normalized = normalized.replace(/(\d+)\s+([a-z]+)/gi, '$1$2')
  
  // Step 3: Add spaces between camelCase/PascalCase words
  // "loadCell" → "load Cell"
  normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
  
  // Step 4: Add spaces between letters and numbers (for non-model-number parts)
  // "load5kg" → "load 5kg"
  normalized = normalized.replace(/([a-zA-Z])(\d)/g, '$1 $2')
  
  // Step 5: Restore model numbers with both compact and spaced versions
  modelMatches.forEach((model, index) => {
    normalized = normalized.replace(`__MODEL_${index}__`, model.normalized)
  })
  
  // Step 6: Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  // Step 7: Basic plural handling (convert plural to singular for common cases)
  // This helps match "cells" → "cell", "sensors" → "sensor"
  // Note: This is basic - full pluralization would need a library like "pluralize"
  normalized = handleBasicPlurals(normalized)
  
  return normalized
}

/**
 * Basic plural to singular conversion for common cases
 * This is a simplified version - for full support, consider using a library like "pluralize"
 */
function handleBasicPlurals(query: string): string {
  const words = query.split(/\s+/)
  
  return words.map(word => {
    const lower = word.toLowerCase()
    
    // Common plural patterns
    if (lower.endsWith('ies') && lower.length > 3) {
      // "cities" → "city", "batteries" → "battery"
      return word.slice(0, -3) + 'y'
    }
    if (lower.endsWith('es') && lower.length > 2) {
      // "boxes" → "box", "matches" → "match"
      // But keep words ending in "es" that are singular (like "process")
      const beforeEs = lower.slice(0, -2)
      if (beforeEs.endsWith('ch') || beforeEs.endsWith('sh') || beforeEs.endsWith('ss') || beforeEs.endsWith('x')) {
        return word.slice(0, -2)
      }
      // "sensors" → "sensor", "loaders" → "loader"
      if (beforeEs.length > 2 && !beforeEs.endsWith('s')) {
        return word.slice(0, -2)
      }
    }
    if (lower.endsWith('s') && lower.length > 1 && !lower.endsWith('ss')) {
      // "cells" → "cell", "loads" → "load"
      // But keep words that end in 's' that are singular (like "process", "class")
      const beforeS = lower.slice(0, -1)
      if (beforeS.length > 2) {
        return word.slice(0, -1)
      }
    }
    
    return word
  }).join(' ')
}

/**
 * Generate multiple search variations for better matching
 * Returns an array of normalized queries to try
 */
export function generateSearchVariations(query: string): string[] {
  const normalized = normalizeSearchQuery(query)
  const variations: string[] = [normalized]
  
  // Add original query if different
  const original = query.trim()
  if (original !== normalized && original.length > 0) {
    variations.push(original)
  }
  
  // Add version without plural handling (in case plural is correct)
  const withoutPlural = query.trim()
    .replace(/-/g, ' ')
    .replace(/(\d+)\s+([a-z]+)/gi, '$1$2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  
  if (withoutPlural !== normalized && withoutPlural.length > 0) {
    variations.push(withoutPlural)
  }
  
  return [...new Set(variations)] // Remove duplicates
}

/**
 * Test function to see how queries are normalized
 */
export function testNormalization(query: string): {
  original: string
  normalized: string
  variations: string[]
} {
  return {
    original: query,
    normalized: normalizeSearchQuery(query),
    variations: generateSearchVariations(query)
  }
}


