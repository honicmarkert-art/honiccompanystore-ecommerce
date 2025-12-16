"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  Layers,
  ArrowLeft,
  Package,
  Laptop,
  Phone,
  Shirt,
  Home,
  Dumbbell,
  Car,
  Heart,
  Baby,
  BookOpen,
  Utensils,
  PawPrint,
  Briefcase,
  Gift,
  Wrench,
  Zap,
  Cpu,
  Wifi,
  Settings,
  Gamepad2,
  Music,
  Camera,
  Headphones,
  Monitor,
  Smartphone,
  Tablet,
  Watch,
  Globe,
  ChevronRight,
  Grid3X3,
  List,
  Filter
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  slug: string
  description: string
  productCount: number
  icon: React.ReactNode
  color: string
  subcategories?: string[]
}

export default function CategoriesPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Category icons mapping
  const categoryIcons: { [key: string]: any } = {
    "Electronics": Laptop,
    "Microcontrollers": Cpu,
    "Sensors": Settings,
    "Power Supply": Zap,
    "Development Boards": Cpu,
    "Tools": Wrench,
    "Resistors & Capacitors": Settings,
    "Diodes & Transistors": Settings,
    "Integrated Circuits": Cpu,
    "Connectors & Cables": Settings,
    "Motors & Actuators": Settings,
    "Starter Kits": Package,
    "Project Kits": Package,
    "Educational Materials": BookOpen,
    "Robotics": Settings,
    "Accessories": Package,
    "Phone & Accessories": Phone,
    "Computer & Office": Laptop,
    "Home & Garden": Home,
    "Men's Clothing": Shirt,
    "Women's Clothing": Shirt,
    "Fashion": Shirt,
    "Shoes": Shirt,
    "Sports & Entertainment": Dumbbell,
    "Sports & Outdoors": Dumbbell,
    "Beauty & Health": Heart,
    "Health & Beauty": Heart,
    "Toys & Hobbies": Gamepad2,
    "Baby & Kids": Baby,
    "Books & Media": BookOpen,
    "Food & Beverages": Utensils,
    "Pet Supplies": PawPrint,
    "Office & School Supplies": Briefcase,
    "Party & Event Supplies": Gift,
    "Tools & Hardware": Wrench,
    "Automotive": Car,
    "Automotive & Motorcycle": Car,
    "Home Appliances": Home,
    "Home Improvement & Lighting": Home,
    "Jewelry & Watches": Package,
    "Luggages & Bags": Package,
    "Hair Extensions & Wigs": Package,
    "Special Occasion Costume": Shirt,
    "default": Package
  }

  const categories: Category[] = [
    {
      id: '1',
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic components, devices, and accessories',
      productCount: 1250,
      icon: <Laptop className="w-6 h-6" />,
      color: 'bg-blue-500',
      subcategories: ['Microcontrollers', 'Sensors', 'Power Supply', 'Development Boards', 'Tools']
    },
    {
      id: '2',
      name: 'Microcontrollers',
      slug: 'microcontrollers',
      description: 'Arduino, ESP32, Raspberry Pi, and other microcontrollers',
      productCount: 320,
      icon: <Cpu className="w-6 h-6" />,
      color: 'bg-green-500',
      subcategories: ['Arduino', 'ESP32', 'Raspberry Pi', 'STM32', 'PIC']
    },
    {
      id: '3',
      name: 'Sensors',
      slug: 'sensors',
      description: 'Temperature, humidity, motion, and other sensors',
      productCount: 180,
      icon: <Settings className="w-6 h-6" />,
      color: 'bg-orange-500',
      subcategories: ['Temperature', 'Humidity', 'Motion', 'Light', 'Sound']
    },
    {
      id: '4',
      name: 'Development Boards',
      slug: 'development-boards',
      description: 'Development boards and prototyping platforms',
      productCount: 95,
      icon: <Cpu className="w-6 h-6" />,
      color: 'bg-purple-500',
      subcategories: ['Arduino Boards', 'ESP32 Boards', 'Raspberry Pi', 'STM32 Boards']
    },
    {
      id: '5',
      name: 'Phone & Accessories',
      slug: 'phone-accessories',
      description: 'Smartphones, cases, chargers, and mobile accessories',
      productCount: 450,
      icon: <Phone className="w-6 h-6" />,
      color: 'bg-indigo-500',
      subcategories: ['Cases', 'Chargers', 'Cables', 'Screen Protectors', 'Headphones']
    },
    {
      id: '6',
      name: 'Computer & Office',
      slug: 'computer-office',
      description: 'Laptops, desktops, office equipment, and accessories',
      productCount: 280,
      icon: <Monitor className="w-6 h-6" />,
      color: 'bg-gray-500',
      subcategories: ['Laptops', 'Desktops', 'Monitors', 'Keyboards', 'Mice']
    },
    {
      id: '7',
      name: 'Home & Garden',
      slug: 'home-garden',
      description: 'Home improvement, garden tools, and household items',
      productCount: 320,
      icon: <Home className="w-6 h-6" />,
      color: 'bg-green-600',
      subcategories: ['Garden Tools', 'Home Decor', 'Lighting', 'Furniture', 'Storage']
    },
    {
      id: '8',
      name: 'Fashion',
      slug: 'fashion',
      description: 'Clothing, shoes, and fashion accessories',
      productCount: 890,
      icon: <Shirt className="w-6 h-6" />,
      color: 'bg-pink-500',
      subcategories: ['Men\'s Clothing', 'Women\'s Clothing', 'Shoes', 'Accessories', 'Jewelry']
    },
    {
      id: '9',
      name: 'Sports & Outdoors',
      slug: 'sports-outdoors',
      description: 'Sports equipment, outdoor gear, and fitness accessories',
      productCount: 210,
      icon: <Dumbbell className="w-6 h-6" />,
      color: 'bg-red-500',
      subcategories: ['Fitness', 'Outdoor Gear', 'Sports Equipment', 'Exercise', 'Camping']
    },
    {
      id: '10',
      name: 'Beauty & Health',
      slug: 'beauty-health',
      description: 'Beauty products, health supplements, and personal care',
      productCount: 340,
      icon: <Heart className="w-6 h-6" />,
      color: 'bg-rose-500',
      subcategories: ['Skincare', 'Makeup', 'Hair Care', 'Health Supplements', 'Personal Care']
    },
    {
      id: '11',
      name: 'Toys & Hobbies',
      slug: 'toys-hobbies',
      description: 'Toys, games, hobby supplies, and entertainment',
      productCount: 180,
      icon: <Gamepad2 className="w-6 h-6" />,
      color: 'bg-yellow-500',
      subcategories: ['Toys', 'Games', 'Hobby Supplies', 'Collectibles', 'Educational']
    },
    {
      id: '12',
      name: 'Baby & Kids',
      slug: 'baby-kids',
      description: 'Baby products, kids clothing, and child care items',
      productCount: 150,
      icon: <Baby className="w-6 h-6" />,
      color: 'bg-cyan-500',
      subcategories: ['Baby Care', 'Kids Clothing', 'Toys', 'Feeding', 'Safety']
    },
    {
      id: '13',
      name: 'Books & Media',
      slug: 'books-media',
      description: 'Books, magazines, music, and digital media',
      productCount: 95,
      icon: <BookOpen className="w-6 h-6" />,
      color: 'bg-amber-500',
      subcategories: ['Books', 'Magazines', 'Music', 'Movies', 'Digital Media']
    },
    {
      id: '14',
      name: 'Food & Beverages',
      slug: 'food-beverages',
      description: 'Food products, beverages, and kitchen supplies',
      productCount: 120,
      icon: <Utensils className="w-6 h-6" />,
      color: 'bg-orange-600',
      subcategories: ['Food', 'Beverages', 'Kitchen Supplies', 'Snacks', 'Cooking']
    },
    {
      id: '15',
      name: 'Pet Supplies',
      slug: 'pet-supplies',
      description: 'Pet food, toys, accessories, and care products',
      productCount: 85,
      icon: <PawPrint className="w-6 h-6" />,
      color: 'bg-emerald-500',
      subcategories: ['Pet Food', 'Toys', 'Accessories', 'Health Care', 'Grooming']
    },
    {
      id: '16',
      name: 'Office & School Supplies',
      slug: 'office-school',
      description: 'Office equipment, school supplies, and stationery',
      productCount: 160,
      icon: <Briefcase className="w-6 h-6" />,
      color: 'bg-slate-500',
      subcategories: ['Office Equipment', 'School Supplies', 'Stationery', 'Filing', 'Presentation']
    },
    {
      id: '17',
      name: 'Tools & Hardware',
      slug: 'tools-hardware',
      description: 'Tools, hardware, and DIY supplies',
      productCount: 200,
      icon: <Wrench className="w-6 h-6" />,
      color: 'bg-gray-600',
      subcategories: ['Hand Tools', 'Power Tools', 'Hardware', 'DIY Supplies', 'Safety']
    },
    {
      id: '18',
      name: 'Automotive',
      slug: 'automotive',
      description: 'Car parts, accessories, and automotive supplies',
      productCount: 140,
      icon: <Car className="w-6 h-6" />,
      color: 'bg-blue-600',
      subcategories: ['Car Parts', 'Accessories', 'Tools', 'Maintenance', 'Electronics']
    }
  ]

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.subcategories?.some(sub => sub.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category.id)
    // Navigate to products page with category filter
    const params = new URLSearchParams()
    params.set('category', category.slug)
    router.push(`/products?${params.toString()}`)
  }

  return (
    <div className={`min-h-screen ${themeClasses.mainBg} ${themeClasses.mainText}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Layers className="w-10 h-10 text-orange-500" />
            All Categories
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Browse products by category. Find exactly what you need with our comprehensive product catalog.
          </p>

          {/* Search and View Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center max-w-2xl mx-auto">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    // Search is already triggered by onChange
                  }
                }}
                className="pl-12 pr-4 py-3"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Categories Grid/List */}
        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCategories.map((category) => (
                <Card 
                  key={category.id} 
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  onClick={() => handleCategoryClick(category)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${category.color} rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{category.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {category.productCount} products
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {category.description}
                    </p>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Subcategories:</p>
                        <div className="flex flex-wrap gap-1">
                          {category.subcategories.slice(0, 3).map((sub, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {sub}
                            </Badge>
                          ))}
                          {category.subcategories.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{category.subcategories.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">Browse products</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCategories.map((category) => (
                <Card 
                  key={category.id} 
                  className="hover:shadow-md transition-all duration-200 cursor-pointer group"
                  onClick={() => handleCategoryClick(category)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${category.color} rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0`}>
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold truncate">{category.name}</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {category.productCount} products
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {category.description}
                        </p>
                        {category.subcategories && category.subcategories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {category.subcategories.slice(0, 5).map((sub, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {sub}
                              </Badge>
                            ))}
                            {category.subcategories.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{category.subcategories.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-orange-500 transition-colors flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* No Results */}
        {filteredCategories.length === 0 && (
          <Card className="mt-8">
            <CardContent className="p-8 text-center">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No categories found</h3>
              <p className="text-muted-foreground mb-4">
                Try searching with different keywords or browse all categories
              </p>
              <Button onClick={() => setSearchTerm('')}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{categories.length}</h3>
              <p className="text-muted-foreground">Total Categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">
                {categories.reduce((sum, cat) => sum + cat.productCount, 0).toLocaleString()}
              </h3>
              <p className="text-muted-foreground">Total Products</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Advanced</h3>
              <p className="text-muted-foreground">Filtering Options</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}