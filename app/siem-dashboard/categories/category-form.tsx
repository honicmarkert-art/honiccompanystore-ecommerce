"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"
import { MediaUpload } from "@/components/media/media-upload"

interface CategoryFormProps {
  category?: any
  onClose: () => void
  onSave: (category: any) => void
}

interface MainCategory {
  id: string
  name: string
  slug: string
}

export function CategoryForm({ category, onClose, onSave }: CategoryFormProps) {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [currentCategoryId, setCurrentCategoryId] = useState<string | number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    slug: "",
    image_url: "",
    is_active: true,
    display_order: 0,
    parent_id: null as string | null,
  })

  // Fetch main categories for parent selection
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const response = await fetch('/api/admin/categories')
        if (response.ok) {
          const data = await response.json()
          // Filter only main categories (parent_id is null)
          const mainCats = data.filter((cat: any) => !cat.parent_id)
          setMainCategories(mainCats)
        }
      } catch (error) {
        console.error('Error fetching main categories:', error)
      }
    }
    fetchMainCategories()
  }, [])

  // Initialize form with category data if editing
  useEffect(() => {
    if (category) {
      const categoryId = String(category.id)
      // Only initialize if this is a different category
      if (currentCategoryId !== categoryId) {
        setCurrentCategoryId(categoryId)
        setFormData({
          name: category.name || "",
          description: category.description || "",
          slug: category.slug || "",
          image_url: category.image_url || "",
          is_active: category.is_active ?? true,
          display_order: category.display_order ?? 0,
          parent_id: category.parent_id || null,
        })
      }
    } else {
      // Reset form when category is null (new category)
      if (currentCategoryId !== null) {
        setCurrentCategoryId(null)
        setFormData({
          name: "",
          description: "",
          slug: "",
          image_url: "",
          is_active: true,
          display_order: 0,
          parent_id: null,
        })
      }
    }
  }, [category?.id, currentCategoryId]) // Only depend on category ID, not the whole object

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    handleInputChange("name", value)
    // Auto-generate slug if it's empty or if we're creating a new category
    if (!category || !formData.slug) {
      const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      handleInputChange("slug", slug)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.slug) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive"
        })
        return
      }

      const url = '/api/admin/categories'
      const method = category ? 'PUT' : 'POST'
      const body = category 
        ? { id: category.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const savedCategory = await response.json()
        toast({
          title: "Success",
          description: category ? "Category updated successfully!" : "Category created successfully!",
        })
        onSave(savedCategory)
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to save category. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save category. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Category Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter category name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => handleInputChange("slug", e.target.value)}
            placeholder="category-slug"
            required
          />
          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
            URL-friendly version of the category name
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent_id">Parent Category</Label>
        <select
          id="parent_id"
          value={formData.parent_id || ""}
          onChange={(e) => handleInputChange("parent_id", e.target.value ? e.target.value : null)}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            themeClasses.inputBg,
            themeClasses.mainText
          )}
        >
          <option value="">Select a main category (optional)</option>
          {mainCategories.map((mainCat) => (
            <option key={mainCat.id} value={String(mainCat.id)}>
              {mainCat.name}
            </option>
          ))}
        </select>
        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
          Leave empty to create a main category, or select a parent to create a subcategory
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange("description", e.target.value)}
          placeholder="Enter category description..."
          rows={3}
        />
      </div>

              <MediaUpload
          type="image"
          value={formData.image_url}
          onChange={(url) => handleInputChange("image_url", url)}
          onRemove={() => handleInputChange("image_url", "")}
          maxSize={10}
          aspectRatio={16/9}
          context="category"
          label="Category Image"
          description="Upload an image or provide a URL for the category"
        />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => handleInputChange("is_active", checked)}
          />
          <Label htmlFor="is_active">Active Category</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_order">Display Order</Label>
          <Input
            id="display_order"
            type="number"
            value={formData.display_order}
            onChange={(e) => handleInputChange("display_order", parseInt(e.target.value) || 0)}
            placeholder="0"
            min="0"
          />
          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
            Lower numbers appear first
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : (category ? "Update Category" : "Create Category")}
        </Button>
      </div>
    </form>
  )
} 