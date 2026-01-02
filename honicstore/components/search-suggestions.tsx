'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import Link from 'next/link'

interface SearchSuggestion {
  name: string
  id: number
  category?: string
  brand?: string
}

interface SearchSuggestionsProps {
  query: string
  onSelect?: (query: string) => void
  minChars?: number
  maxSuggestions?: number
}

export function SearchSuggestions({ 
  query, 
  onSelect,
  minChars = 3,
  maxSuggestions = 8 
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const { themeClasses } = useTheme()
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const trimmedQuery = query.trim()
    
    // Only show suggestions if query has minimum characters
    if (trimmedQuery.length < minChars) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    // Debounce API call
    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/products/suggestions?q=${encodeURIComponent(trimmedQuery)}&limit=${maxSuggestions}`
        )
        
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
          setShowDropdown(data.suggestions && data.suggestions.length > 0)
        } else {
          setSuggestions([])
          setShowDropdown(false)
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
        setSuggestions([])
        setShowDropdown(false)
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query, minChars, maxSuggestions])

  const handleSelect = (suggestion: SearchSuggestion) => {
    if (onSelect) {
      onSelect(suggestion.name)
    }
    setShowDropdown(false)
  }

  if (!showDropdown && !loading) {
    return null
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-50">
      <div
        className={cn(
          "rounded-lg shadow-lg border overflow-hidden",
          themeClasses.bgPrimary,
          themeClasses.borderNeutral
        )}
      >
        {loading ? (
          <div className="p-4 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Searching...
            </span>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion.id || suggestion.text || suggestion.name}
                href={`/products?search=${encodeURIComponent(suggestion.text || suggestion.name)}`}
                onClick={() => handleSelect(suggestion)}
                className={cn(
                  "block px-4 py-3 hover:bg-opacity-50 transition-colors border-b last:border-b-0",
                  themeClasses.bgHover,
                  themeClasses.borderNeutral
                )}
              >
                <div className="flex items-start gap-3">
                  <Search className={cn("w-4 h-4 mt-0.5 flex-shrink-0", themeClasses.textNeutralSecondary)} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-medium truncate", themeClasses.textNeutralPrimary)}>
                      {suggestion.name}
                    </div>
                    {(suggestion.brand || suggestion.category) && (
                      <div className={cn("text-xs mt-0.5 truncate", themeClasses.textNeutralSecondary)}>
                        {[suggestion.brand, suggestion.category].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : query.length >= minChars ? (
          <div className={cn("p-4 text-sm text-center", themeClasses.textNeutralSecondary)}>
            No suggestions found
          </div>
        ) : null}
      </div>
    </div>
  )
}
