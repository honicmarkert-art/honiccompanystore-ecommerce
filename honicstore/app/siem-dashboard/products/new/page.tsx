"use client"


// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Save,
  X,
  Upload,
  Package,
  DollarSign,
  Tag,
  FileText,
  Image as ImageIcon,
  Video,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"

export default function NewProductPage() {
  const router = useRouter()
  const { themeClasses } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    originalPrice: "",
    category: "",
    brand: "",
    description: "",
    image: "",
    video: "",
    view360: "",
  })

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    router.push("/admin")
  }

  const handleCancel = () => {
    router.push("/admin")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Add New Product</h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Create a new product for your store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="border-red-500 text-red-500 hover:bg-red-50"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Product
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Product Form */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", themeClasses.mainText)}>
              <Package className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                Product Name
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter product name"
                className={cn(
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  themeClasses.mainText,
                  "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                  Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className={cn(
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.mainText,
                    "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  )}
                />
              </div>
              <div>
                <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                  Original Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                  placeholder="0.00"
                  className={cn(
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.mainText,
                    "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                  Category
                </label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Enter category"
                  className={cn(
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.mainText,
                    "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  )}
                />
              </div>
              <div>
                <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                  Brand
                </label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="Enter brand"
                  className={cn(
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.mainText,
                    "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description & Image */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", themeClasses.mainText)}>
              <FileText className="w-5 h-5" />
              Description & Media
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter product description..."
                rows={4}
                className={cn(
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  themeClasses.mainText,
                  "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                )}
              />
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                Product Image URL
              </label>
              <Input
                value={formData.image}
                onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                placeholder="Enter image URL"
                className={cn(
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  themeClasses.mainText,
                  "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                )}
              />
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                Product Video URL
              </label>
              <Input
                value={formData.video}
                onChange={(e) => setFormData(prev => ({ ...prev, video: e.target.value }))}
                placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                className={cn(
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  themeClasses.mainText,
                  "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                )}
              />
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", themeClasses.mainText)}>
                360° View URL
              </label>
              <Input
                value={formData.view360}
                onChange={(e) => setFormData(prev => ({ ...prev, view360: e.target.value }))}
                placeholder="Enter 360° view URL"
                className={cn(
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  themeClasses.mainText,
                  "focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                )}
              />
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Drag and drop media files here, or click to browse
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
