"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Search, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchSuggestionsProps {
  query: string
  onSuggestionClick: (suggestion: string) => void
  isVisible: boolean
  className?: string
}

export function SearchSuggestions({ 
  query, 
  onSuggestionClick, 
  isVisible, 
  className 
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch suggestions when query changes
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    const fetchSuggestions = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      } catch (error) {
        console.error('Error fetching suggestions:', error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [query])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || suggestions.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            onSuggestionClick(suggestions[selectedIndex])
          }
          break
        case 'Escape':
          setSelectedIndex(-1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, suggestions, selectedIndex, onSuggestionClick])

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [suggestions])

  if (!isVisible || (!isLoading && suggestions.length === 0)) {
    return null
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto",
        className
      )}
    >
      {isLoading ? (
        <div className="p-3 text-center text-gray-500 dark:text-gray-400">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full mx-auto"></div>
          <p className="text-sm mt-2">Searching...</p>
        </div>
      ) : (
        <div className="py-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2",
                selectedIndex === index && "bg-gray-100 dark:bg-gray-700"
              )}
            >
              <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Recent searches placeholder */}
      {!isLoading && suggestions.length === 0 && query.length >= 2 && (
        <div className="p-3 text-center text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4 mx-auto mb-2" />
          <p className="text-sm">No suggestions found</p>
        </div>
      )}
    </div>
  )
}


