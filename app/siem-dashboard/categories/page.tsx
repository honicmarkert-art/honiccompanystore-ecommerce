"use client"


// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from "react"
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
  created_at: string
  updated_at: string
}

export default function AdminCategories() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/admin/categories')
        if (response.ok) {
          const data = await response.json()
          setCategories(data)
        } else {
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

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setIsAddDialogOpen(true)
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
          description: error.error || "Failed to delete category",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category",
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

  const stats = {
    totalCategories: categories.length,
    activeCategories: categories.filter(c => c.is_active).length,
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
            Manage your product categories and organization
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Add New Category"}
              </DialogTitle>
            </DialogHeader>
            <CategoryForm 
              category={editingCategory}
              onClose={() => {
                setIsAddDialogOpen(false)
                setEditingCategory(null)
              }}
              onSave={handleCategorySaved}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Avg Products/Category
            </CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgProductsPerCategory}</div>
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

      {/* Categories Grid */}
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
            </CardContent>
          </Card>
        ))}
      </div>

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
