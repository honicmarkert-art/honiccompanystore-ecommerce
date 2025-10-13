import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClientWithUser } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { generateSuggestions, normalizeSearchTerm } from '@/lib/dictionary'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const supabase = getSupabaseClientWithUser()

    // Search in products table
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('name, description, brand, category')
      .or(`name.ilike.%${query}%, description.ilike.%${query}%, brand.ilike.%${query}%, category.ilike.%${query}%`)
      .limit(10)

    if (productsError) {
      logger.error('Error fetching product suggestions:', productsError)
    }

    // Search in product_variants table
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('variant_name, primary_values, multi_values')
      .or(`variant_name.ilike.%${query}%, primary_values.ilike.%${query}%, multi_values.ilike.%${query}%`)
      .limit(10)

    if (variantsError) {
      logger.error('Error fetching variant suggestions:', variantsError)
    }

    // Extract unique words and phrases
    const suggestions = new Set<string>()

    // Add product names, brands, categories
    products?.forEach(product => {
      if (product.name) suggestions.add(product.name)
      if (product.brand) suggestions.add(product.brand)
      if (product.category) suggestions.add(product.category)
    })

    // Add variant names and attribute values
    variants?.forEach(variant => {
      if (variant.variant_name) suggestions.add(variant.variant_name)
      
      // Parse JSON fields for attribute values
      try {
        if (variant.primary_values) {
          const primaryValues = typeof variant.primary_values === 'string' 
            ? JSON.parse(variant.primary_values) 
            : variant.primary_values
          if (Array.isArray(primaryValues)) {
            primaryValues.forEach(value => {
              if (typeof value === 'string') suggestions.add(value)
            })
          }
        }
        
        if (variant.multi_values) {
          const multiValues = typeof variant.multi_values === 'string' 
            ? JSON.parse(variant.multi_values) 
            : variant.multi_values
          if (Array.isArray(multiValues)) {
            multiValues.forEach(value => {
              if (typeof value === 'string') suggestions.add(value)
            })
          }
        }
      } catch (error) {
        logger.error('Error parsing variant values:', error)
      }
    })

    // Use dictionary lib for better relevance scoring
    const allSuggestions = Array.from(suggestions)
    const filteredSuggestions = generateSuggestions(allSuggestions, query, 8)

    return NextResponse.json({ suggestions: filteredSuggestions })

  } catch (error) {
    logger.error('Error in search suggestions API:', error)
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }
}
