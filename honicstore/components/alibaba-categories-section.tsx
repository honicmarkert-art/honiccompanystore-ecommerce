"use client"

import React from 'react'
import {
  Laptop,
  Smartphone,
  Shirt,
  Dumbbell,
  Package,
  Building,
  Zap,
  Cpu,
  CircuitBoard,
  Tool,
  Home,
  Utensils,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface AlibabaCategory {
  id: string
  name: string
  icon: React.ReactNode
  href: string
  productCount?: number
}

export interface AlibabaCategoriesSectionProps {
  themeClasses?: string
  onCategoryClick?: (categoryId: string) => void
}

const DEFAULT_CATEGORIES: AlibabaCategory[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    icon: <Laptop className="w-6 h-6" />,
    href: '?category=electronics',
    productCount: 1240,
  },
  {
    id: 'components',
    name: 'Components',
    icon: <CircuitBoard className="w-6 h-6" />,
    href: '?category=components',
    productCount: 3421,
  },
  {
    id: 'machinery',
    name: 'Machinery',
    icon: <Zap className="w-6 h-6" />,
    href: '?category=machinery',
    productCount: 892,
  },
  {
    id: 'tools',
    name: 'Tools',
    icon: <Tool className="w-6 h-6" />,
    href: '?category=tools',
    productCount: 567,
  },
  {
    id: 'apparel',
    name: 'Apparel',
    icon: <Shirt className="w-6 h-6" />,
    href: '?category=apparel',
    productCount: 2341,
  },
  {
    id: 'sports',
    name: 'Sports',
    icon: <Dumbbell className="w-6 h-6" />,
    href: '?category=sports',
    productCount: 1456,
  },
  {
    id: 'home',
    name: 'Home & Garden',
    icon: <Home className="w-6 h-6" />,
    href: '?category=home',
    productCount: 3210,
  },
  {
    id: 'supplies',
    name: 'Supplies',
    icon: <Package className="w-6 h-6" />,
    href: '?category=supplies',
    productCount: 4567,
  },
]

export function AlibabaCategoriesSection({
  themeClasses = '',
  onCategoryClick,
}: AlibabaCategoriesSectionProps) {
  const handleCategoryClick = (categoryId: string) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId)
    }
  }

  return (
    <div className={cn('w-full', themeClasses)}>
      {/* Categories Header */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Categories for you
        </h2>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {DEFAULT_CATEGORIES.map((category) => (
            <Link
              key={category.id}
              href={category.href}
              onClick={() => handleCategoryClick(category.id)}
              className="group flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Category Icon */}
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-full group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40 transition-colors">
                <div className="text-orange-600 dark:text-orange-400">
                  {category.icon}
                </div>
              </div>

              {/* Category Name */}
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {category.name}
                </p>
                {category.productCount && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {(category.productCount / 1000).toFixed(1)}k items
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* View More Categories */}
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            className="border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            More Categories
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-b border-gray-200 dark:border-gray-700" />
    </div>
  )
}
