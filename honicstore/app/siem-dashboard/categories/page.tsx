"use client"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import React, { useState, useMemo, useEffect } from "react"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Tags,
  Package,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"
import { CategoryForm } from "./category-form"
import Image from "next/image"

interface Category {
  id: number
  name: string
  description: string
  slug: string
  image_url?: string
  is_active: boolean
  display_order: number
  parent_id?: number
  parent_name?: string
  level: number
  children_count: number
  created_at: string
  updated_at: string
}

export default function SiemCategories() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'main' | 'subcategories' | 'flat'>('main')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [selectedMainCategory, setSelectedMainCategory] = useState<Category | null>(null)

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/admin/categories', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setCategories(data)
        } else {
          const text = await response.text().catch(() => '')
          toast({
            title: "Error",
            description: "Failed to fetch categories",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch categories",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [toast])

  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [categories, searchTerm])

  // Organize categories hierarchically
  const hierarchicalCategories = useMemo(() => {
    const categoryMap = new Map<number, Category & { children: Category[] }>()
    const rootCategories: (Category & { children: Category[] })[] = []

    // First pass: create map and initialize children arrays
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] })
    })

    // Second pass: build hierarchy
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!
      if (category.parent_id && categoryMap.has(category.parent_id)) {
        const parent = categoryMap.get(category.parent_id)!
        parent.children.push(categoryWithChildren)
      } else {
        rootCategories.push(categoryWithChildren)
      }
    })

    return rootCategories
  }, [categories])

  // Get main categories (parent_id is null)
  const mainCategories = useMemo(() => {
    return categories.filter(cat => !cat.parent_id)
  }, [categories])

  // Get subcategories for a specific main category
  const getSubcategories = (mainCategoryId: number) => {
    return categories.filter(cat => cat.parent_id === mainCategoryId)
  }

  // Toggle category expansion
  const toggleCategoryExpansion = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Render category tree recursively
  const renderCategoryTree = (categories: (Category & { children: Category[] })[], level = 0): React.JSX.Element[] => {
    return categories.map((category) => (
      <div key={category.id}>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, `ml-${level * 4}`)}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tags className="h-5 w-5 text-muted-foreground" />
                <div className="flex items-center space-x-2">
                  {category.children.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategoryExpansion(category.id)}
                      className="p-1 h-6 w-6"
                    >
                      {expandedCategories.has(category.id) ? '−' : '+'}
                    </Button>
                  )}
                  <CardTitle className={themeClasses.mainText}>
                    {category.name}
                    {category.children.length > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({category.children.length} subcategories)
                      </span>
                    )}
                  </CardTitle>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                  <DropdownMenuItem
                    onClick={() => handleEditCategory(category)}
                    className={themeClasses.buttonGhostHoverBg}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Image */}
            {category.image_url && (
              <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100">
                <Image
                  src={category.image_url}
                  alt={category.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              {category.description}
            </p>
            
            <div className="flex items-center justify-between">
              <Badge variant={category.is_active ? "default" : "secondary"}>
                {category.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className={cn("text-sm font-medium", themeClasses.mainText)}>
                Order: {category.display_order}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className={cn(themeClasses.textNeutralSecondary)}>Slug:</span>
              <span className={cn("font-mono", themeClasses.mainText)}>{category.slug}</span>
            </div>

            {category.parent_name && (
              <div className="flex items-center justify-between text-xs">
                <span className={cn(themeClasses.textNeutralSecondary)}>Parent:</span>
                <span className={cn("font-medium", themeClasses.mainText)}>{category.parent_name}</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Render children if expanded */}
        {category.children.length > 0 && expandedCategories.has(category.id) && (
          <div className="mt-2">
            {renderCategoryTree(category.children as (Category & { children: Category[] })[], level + 1)}
          </div>
        )}
      </div>
    ))
  }

  const handleEditCategory = (category: Category) => {
    // Prevent navigation when editing
    setEditingCategory(category)
    setIsAddDialogOpen(true)
    // Ensure we stay in the current view mode when editing
    // Don't change viewMode here - keep it as is
  }

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/categories?id=${categoryId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCategories(prev => prev.filter(cat => cat.id !== categoryId))
        toast({
          title: "Success",
          description: "Category deleted successfully"
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: "Failed",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed",
        variant: "destructive"
      })
    }
  }

  const handleCategorySaved = (savedCategory: Category) => {
    if (editingCategory) {
      // Update existing category
      setCategories(prev => prev.map(cat => 
        cat.id === savedCategory.id ? savedCategory : cat
      ))
    } else {
      // Add new category
      setCategories(prev => [...prev, savedCategory])
    }
    setIsAddDialogOpen(false)
    setEditingCategory(null)
  }

  const handleMainCategorySelect = (category: Category) => {
    setSelectedMainCategory(category)
    setViewMode('subcategories')
  }

  const handleBackToMain = () => {
    setSelectedMainCategory(null)
    setViewMode('main')
  }

  const stats = {
    totalCategories: categories.length,
    activeCategories: categories.filter(c => c.is_active).length,
    mainCategories: mainCategories.length,
    subCategories: categories.filter(c => c.parent_id).length,
    totalProducts: 0, // This would need to be calculated from products table
    avgProductsPerCategory: 0, // This would need to be calculated
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Categories</h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Manage your product categories and organization with hierarchical structure
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>View:</span>
            <Button
              variant={viewMode === 'main' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('main')
                setSelectedMainCategory(null)
              }}
            >
              Main Categories
            </Button>
            <Button
              variant={viewMode === 'subcategories' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('subcategories')}
              disabled={!selectedMainCategory}
            >
              Subcategories
            </Button>
            <Button
              variant={viewMode === 'flat' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('flat')
                setSelectedMainCategory(null)
              }}
            >
              All Categories
            </Button>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className={cn("max-w-2xl shadow-xl bg-white dark:bg-neutral-900 max-h-[90vh]", themeClasses.cardBorder)}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Add New Category"}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
              <CategoryForm 
                category={editingCategory}
                onClose={() => {
                  setIsAddDialogOpen(false)
                  setEditingCategory(null)
                }}
                onSave={handleCategorySaved}
              />
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Categories
            </CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCategories}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Main Categories
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mainCategories}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Sub Categories
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.subCategories}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Active Categories
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCategories}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={themeClasses.mainText}>Search Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Display */}
      {viewMode === 'main' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-2xl font-semibold", themeClasses.mainText)}>Main Categories</h2>
            <Button
              onClick={() => {
                setEditingCategory(null)
                setIsAddDialogOpen(true)
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Main Category
            </Button>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mainCategories.map((category) => {
              const subcategoryCount = getSubcategories(category.id).length
              return (
                <Card 
                  key={category.id} 
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                    themeClasses.cardBg, 
                    themeClasses.cardBorder
                  )}
                  onClick={(e) => {
                    // Don't navigate if clicking on dropdown, menu items, or buttons
                    const target = e.target as HTMLElement
                    if (
                      target.closest('[role="menu"], [role="menuitem"], button, [role="button"]') ||
                      target.tagName === 'BUTTON' ||
                      isAddDialogOpen
                    ) {
                      return
                    }
                    handleMainCategorySelect(category)
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Tags className="h-6 w-6 text-orange-500" />
                        <CardTitle className={cn("text-lg", themeClasses.mainText)}>
                          {category.name}
                        </CardTitle>
                      </div>
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCategory(category)
                            }}
                            className={themeClasses.buttonGhostHoverBg}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCategory(category.id)
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Category Image */}
                    {category.image_url && (
                      <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100">
                        <Image
                          src={category.image_url}
                          alt={category.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    
                    <p className={cn("text-sm line-clamp-2", themeClasses.textNeutralSecondary)}>
                      {category.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <span className={cn("text-sm font-medium", themeClasses.mainText)}>
                        {subcategoryCount} subcategories
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className={cn("text-xs text-center", themeClasses.textNeutralSecondary)}>
                        Click to manage subcategories
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'subcategories' && selectedMainCategory && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToMain}
                className="flex items-center gap-2"
              >
                ← Back to Main Categories
              </Button>
              <div>
                <h2 className={cn("text-2xl font-semibold", themeClasses.mainText)}>
                  {selectedMainCategory.name} - Subcategories
                </h2>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Manage subcategories for {selectedMainCategory.name}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingCategory(null)
                setIsAddDialogOpen(true)
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Subcategory
            </Button>
          </div>
          
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {getSubcategories(selectedMainCategory.id).map((category) => (
          <Card key={category.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Tags className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className={themeClasses.mainText}>{category.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                    <DropdownMenuItem
                      onClick={() => handleEditCategory(category)}
                      className={themeClasses.buttonGhostHoverBg}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Image */}
              {category.image_url && (
                <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={category.image_url}
                    alt={category.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                {category.description}
              </p>
              
              <div className="flex items-center justify-between">
                <Badge variant={category.is_active ? "default" : "secondary"}>
                  {category.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className={cn("text-sm font-medium", themeClasses.mainText)}>
                  Order: {category.display_order}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className={cn(themeClasses.textNeutralSecondary)}>Slug:</span>
                <span className={cn("font-mono", themeClasses.mainText)}>{category.slug}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
        </div>
      )}

      {viewMode === 'flat' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-2xl font-semibold", themeClasses.mainText)}>All Categories</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((category) => (
              <Card key={category.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Tags className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className={themeClasses.mainText}>{category.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                        <DropdownMenuItem
                          onClick={() => handleEditCategory(category)}
                          className={themeClasses.buttonGhostHoverBg}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category Image */}
                  {category.image_url && (
                    <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100">
                      <Image
                        src={category.image_url}
                        alt={category.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                    {category.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant={category.is_active ? "default" : "secondary"}>
                      {category.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <span className={cn("text-sm font-medium", themeClasses.mainText)}>
                      Order: {category.display_order}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={cn(themeClasses.textNeutralSecondary)}>Slug:</span>
                    <span className={cn("font-mono", themeClasses.mainText)}>{category.slug}</span>
                  </div>

                  {category.parent_name && (
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn(themeClasses.textNeutralSecondary)}>Parent:</span>
                      <span className={cn("font-medium", themeClasses.mainText)}>{category.parent_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
            <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
              Loading categories...
            </h3>
          </CardContent>
        </Card>
      )}

      {!loading && filteredCategories.length === 0 && (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tags className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
              No categories found
            </h3>
            <p className={cn("text-sm text-center", themeClasses.textNeutralSecondary)}>
              {searchTerm ? "Try adjusting your search terms." : "Get started by creating your first category."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 

