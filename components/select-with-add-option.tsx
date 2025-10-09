"use client"

import React, { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'

interface SelectWithAddOptionProps {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  options: string[]
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  onAddNew?: (newValue: string) => void
  className?: string
}

export function SelectWithAddOption({
  value,
  onValueChange,
  placeholder,
  options,
  isLoading = false,
  error = null,
  emptyMessage = "No options found",
  onAddNew,
  className
}: SelectWithAddOptionProps) {
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newValue, setNewValue] = useState('')

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

  return (
    <div className={className}>
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <SelectItem value="__loading__" disabled>
              Loading...
            </SelectItem>
          ) : error ? (
            <SelectItem value="__error__" disabled>
              Error loading options
            </SelectItem>
          ) : options.length === 0 ? (
            <SelectItem value="__empty__" disabled>
              {emptyMessage}
            </SelectItem>
          ) : (
            <>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              {onAddNew && (
                <SelectItem 
                  value="__add_new__" 
                  onSelect={() => setIsAddingNew(true)}
                  className="text-blue-600 font-medium"
                >
                  <Plus className="h-4 w-4 mr-2 inline" />
                  Add new...
                </SelectItem>
              )}
            </>
          )}
        </SelectContent>
      </Select>

      {isAddingNew && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Enter new ${placeholder.toLowerCase()}`}
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

      {error && (
        <p className="text-sm text-red-500 mt-1">
          Error loading options: {error}
        </p>
      )}
    </div>
  )
}
