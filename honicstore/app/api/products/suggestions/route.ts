import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim().toLowerCase() || ''
    const limit = parseInt(searchParams.get('limit') || '8', 10)

    // Minimum 3 characters required
    if (query.length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    // Use words from dictionary, product, brand, and category keywords, and synonyms/variations
    // Only unique normalized words
    const { PRODUCT_KEYWORDS, BRAND_KEYWORDS, CATEGORY_KEYWORDS, extractKeywords, normalizeSearchTerm, generateSuggestions } = await import('@/lib/dictionary')
    const { expandQueryWithSynonyms } = await import('@/lib/search-synonyms')

    // 1. Start with possible corrections
    const candidatesSet = new Set<string>([...PRODUCT_KEYWORDS, ...BRAND_KEYWORDS, ...CATEGORY_KEYWORDS])
    // 2. Add synonyms/variations for the query and its words
    expandQueryWithSynonyms(query).forEach(word => candidatesSet.add(word))
    extractKeywords(query).forEach(word => expandQueryWithSynonyms(word).forEach(w2 => candidatesSet.add(w2)))
    
    // 3. Remove any words that are too short, pure numbers, or a stop word
    const allCandidates = Array.from(candidatesSet)
      .map(normalizeSearchTerm)
      .filter(word => word.length >= 3 && !/^[0-9]+$/.test(word))
      .filter((word, idx, arr) => arr.indexOf(word) === idx) // remove dups
      .filter(word => word !== query)

    // 4. Generate suggestions for the query from these candidates, sorted by closeness
    const suggested = generateSuggestions(allCandidates, query, limit)

    // 5. Return as { suggestions: [ { text: ... } ] }
    return NextResponse.json({
      suggestions: suggested.map(text => ({ text }))
    })
  } catch (error: any) {
    logger.log(`Suggestions API error: ${error.message}`)
    return NextResponse.json({ suggestions: [] })
  }
}




