"use client"

import React, { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X, ChevronDown } from 'lucide-react'
import { useCategories } from '@/hooks/use-categories'

interface HierarchicalCategorySelectorProps {
  value: string
  onValueChange: (value: string) => void
  onSelect?: (selection: {
    main: { id: string | number; name: string; slug: string } | null
    sub: { id: string | number; name: string; slug: string } | null
  }) => void
  placeholder?: string
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  onAddNew?: (newValue: string) => void
  className?: string
}

export function HierarchicalCategorySelector({
  value,
  onValueChange,
  onSelect,
  placeholder = "Select a category",
  isLoading = false,
  error = null,
  emptyMessage = "No categories found",
  onAddNew,
  className
}: HierarchicalCategorySelectorProps) {
  const { mainCategories, subCategories, isLoading: categoriesLoading, error: categoriesError } = useCategories()
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>("")
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newValue, setNewValue] = useState('')

  // Filter subcategories based on selected main category
  const filteredSubCategories = subCategories.filter(sub => {
    const mainCategory = mainCategories.find(main => main.name === selectedMainCategory)
    return mainCategory && sub.parent_name === mainCategory.name
  })

  // Handle main category selection
  const handleMainCategoryChange = (mainCategoryName: string) => {
    setSelectedMainCategory(mainCategoryName)
    // Clear subcategory selection when main category changes
    onValueChange("")
    const main = mainCategories.find(m => m.name === mainCategoryName) || null
    if (onSelect) onSelect({ main: main ? { id: main.id, name: main.name, slug: main.slug } : null, sub: null })
  }

  // Handle subcategory selection
  const handleSubCategoryChange = (subCategoryName: string) => {
    onValueChange(subCategoryName)
    const main = mainCategories.find(m => m.name === selectedMainCategory) || null
    const sub = subCategories.find(s => s.name === subCategoryName && (main ? s.parent_name === main.name : true)) || null
    if (onSelect) onSelect({
      main: main ? { id: main.id, name: main.name, slug: main.slug } : null,
      sub: sub ? { id: sub.id, name: sub.name, slug: sub.slug } : null
    })
  }

  // Handle adding new category
  const handleAddNew = () => {
    if (newValue.trim() && onAddNew) {
      onAddNew(newValue.trim())
      onValueChange(newValue.trim())
      setNewValue('')
      setIsAddingNew(false)
    }
  }

  const handleCancelAdd = () => {
    setNewValue('')
    setIsAddingNew(false)
  }

  // Initialize selected main category based on current value
  useEffect(() => {
    if (value && !selectedMainCategory) {
      // Find which main category this subcategory belongs to
      const subCategory = subCategories.find(sub => sub.name === value)
      if (subCategory && subCategory.parent_name) {
        setSelectedMainCategory(subCategory.parent_name)
      }
    }
  }, [value, subCategories, selectedMainCategory])

  const isActuallyLoading = isLoading || categoriesLoading
  const actualError = error || categoriesError

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Main Category Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Main Category
          </label>
          <Select
            value={selectedMainCategory}
            onValueChange={handleMainCategoryChange}
            disabled={isActuallyLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select main category first" />
            </SelectTrigger>
            <SelectContent>
              {isActuallyLoading ? (
                <SelectItem value="__loading__" disabled>
                  Loading...
                </SelectItem>
              ) : actualError ? (
                <SelectItem value="__error__" disabled>
                  Error loading categories
                </SelectItem>
              ) : mainCategories.length === 0 ? (
                <SelectItem value="__empty__" disabled>
                  {emptyMessage}
                </SelectItem>
              ) : (
                <>
                  {mainCategories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                  {onAddNew && (
                    <SelectItem 
                      value="__add_new_main__" 
                      onSelect={() => setIsAddingNew(true)}
                      className="text-blue-600 font-medium"
                    >
                      <Plus className="h-4 w-4 mr-2 inline" />
                      Add new main category...
                    </SelectItem>
                  )}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Sub Category Selection */}
        {selectedMainCategory && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Sub Category
            </label>
            <Select
              value={value}
              onValueChange={handleSubCategoryChange}
              disabled={isActuallyLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sub category" />
              </SelectTrigger>
              <SelectContent>
                {filteredSubCategories.length === 0 ? (
                  <SelectItem value="__no_subs__" disabled>
                    No subcategories available
                  </SelectItem>
                ) : (
                  <>
                    {filteredSubCategories.map((subCategory) => (
                      <SelectItem key={subCategory.id} value={subCategory.name}>
                        {subCategory.name}
                      </SelectItem>
                    ))}
                    {onAddNew && (
                      <SelectItem 
                        value="__add_new_sub__" 
                        onSelect={() => setIsAddingNew(true)}
                        className="text-blue-600 font-medium"
                      >
                        <Plus className="h-4 w-4 mr-2 inline" />
                        Add new subcategory...
                      </SelectItem>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Add New Category Input */}
        {isAddingNew && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`Enter new ${selectedMainCategory ? 'sub' : 'main'} category`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddNew()
                } else if (e.key === 'Escape') {
                  handleCancelAdd()
                }
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleAddNew}
              disabled={!newValue.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelAdd}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error Display */}
        {actualError && (
          <p className="text-sm text-red-500 mt-1">
            Error loading categories: {actualError}
          </p>
        )}

        {/* Current Selection Display */}
        {value && (
          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <strong>Selected:</strong> {selectedMainCategory && `${selectedMainCategory} > `}{value}
          </div>
        )}
      </div>
    </div>
  )
}
