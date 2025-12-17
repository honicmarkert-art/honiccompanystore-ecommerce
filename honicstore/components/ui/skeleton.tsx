import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        "relative overflow-hidden",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

// Shimmer effect for more sophisticated loading
function ShimmerSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

// Product image skeleton
function ProductImageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:gap-4 lg:flex-row lg:gap-6", className)}>
      {/* Thumbnail Gallery (Left on LG screens, Top on SM screens) */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-row lg:flex-col gap-2 lg:max-h-[500px] lg:w-24 xl:w-28 pb-2 lg:pb-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="aspect-square w-16 lg:w-full rounded-md" />
          ))}
        </div>
      </div>
      
      {/* Main Image */}
      <div className="flex-1">
        <ShimmerSkeleton className="aspect-square w-full rounded-lg" />
      </div>
    </div>
  )
}

// Product info skeleton
function ProductInfoSkeleton() {
  return (
    <div className="space-y-4">
      {/* Title */}
      <ShimmerSkeleton className="h-8 w-3/4" />
      
      {/* Rating and reviews */}
      <div className="flex items-center space-x-4">
        <ShimmerSkeleton className="h-5 w-20" />
        <ShimmerSkeleton className="h-4 w-16" />
      </div>
      
      {/* Price */}
      <div className="space-y-2">
        <ShimmerSkeleton className="h-8 w-32" />
        <ShimmerSkeleton className="h-6 w-24" />
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <ShimmerSkeleton className="h-4 w-full" />
        <ShimmerSkeleton className="h-4 w-5/6" />
        <ShimmerSkeleton className="h-4 w-4/5" />
      </div>
      
      {/* Features */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <ShimmerSkeleton className="h-4 w-4 rounded-full" />
            <ShimmerSkeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Variant selection skeleton
function VariantSelectionSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerSkeleton className="h-5 w-24" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <ShimmerSkeleton key={j} className="h-10 w-20 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Related products skeleton
function RelatedProductsSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3 w-full">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col space-y-2">
          <ShimmerSkeleton className="aspect-square w-full rounded-lg" />
          <ShimmerSkeleton className="h-4 w-3/4" />
          <ShimmerSkeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// Button skeleton
function ButtonSkeleton({ className }: { className?: string }) {
  return (
    <ShimmerSkeleton 
      className={cn("h-10 w-32 rounded-md", className)} 
    />
  )
}

// Product card skeleton for product list
function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      {/* Product Image */}
      <ShimmerSkeleton className="aspect-square w-full rounded-lg" />
      
      {/* Product Name */}
      <ShimmerSkeleton className="h-4 w-3/4" />
      
      {/* Rating */}
      <div className="flex items-center space-x-1">
        <ShimmerSkeleton className="h-3 w-16" />
        <ShimmerSkeleton className="h-3 w-8" />
      </div>
      
      {/* Price */}
      <ShimmerSkeleton className="h-5 w-20" />
    </div>
  )
}

// Product grid skeleton for product list
function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 gap-1 px-1 sm:px-2 lg:px-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Filter sidebar skeleton
function FilterSidebarSkeleton() {
  return (
    <div className="space-y-6">
      {/* Price Range Filter */}
      <div className="space-y-3">
        <ShimmerSkeleton className="h-5 w-24" />
        <div className="space-y-2">
          <ShimmerSkeleton className="h-4 w-full" />
          <ShimmerSkeleton className="h-4 w-3/4" />
        </div>
      </div>
      
      {/* Category Filter */}
      <div className="space-y-3">
        <ShimmerSkeleton className="h-5 w-20" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <ShimmerSkeleton className="h-4 w-4 rounded" />
              <ShimmerSkeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Brand Filter */}
      <div className="space-y-3">
        <ShimmerSkeleton className="h-5 w-16" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <ShimmerSkeleton className="h-4 w-4 rounded" />
              <ShimmerSkeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Pagination skeleton
function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-center space-x-2">
      <ShimmerSkeleton className="h-8 w-8 rounded" />
      <ShimmerSkeleton className="h-8 w-8 rounded" />
      <ShimmerSkeleton className="h-8 w-8 rounded" />
      <ShimmerSkeleton className="h-8 w-8 rounded" />
      <ShimmerSkeleton className="h-8 w-8 rounded" />
    </div>
  )
}

// Search bar skeleton
function SearchBarSkeleton() {
  return (
    <div className="relative flex-1 flex items-center">
      <div className="relative flex-1">
        <ShimmerSkeleton className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 z-10" />
        <ShimmerSkeleton className="w-full h-10 rounded-lg" />
      </div>
    </div>
  )
}

// Order card skeleton
function OrderCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left Section */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <ShimmerSkeleton className="w-4 h-4 rounded" />
            <div className="flex-1">
              <ShimmerSkeleton className="h-6 w-48 mb-2" />
              <ShimmerSkeleton className="h-4 w-32" />
            </div>
            <ShimmerSkeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <ShimmerSkeleton className="w-4 h-4 rounded" />
            <ShimmerSkeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ShimmerSkeleton className="h-4 w-32" />
            <ShimmerSkeleton className="h-4 w-2" />
            <ShimmerSkeleton className="h-4 w-28" />
          </div>
        </div>
        
        {/* Right Section */}
        <div className="flex items-center gap-4">
          <ShimmerSkeleton className="w-16 h-16 rounded-full hidden sm:block" />
          <div className="text-right">
            <ShimmerSkeleton className="h-7 w-28 mb-1" />
            <ShimmerSkeleton className="h-3 w-16" />
          </div>
          <div className="flex gap-2">
            <ShimmerSkeleton className="h-9 w-24 rounded-md" />
            <ShimmerSkeleton className="h-9 w-24 rounded-md hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Orders list skeleton
function OrdersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  )
}

export { 
  Skeleton, 
  ShimmerSkeleton, 
  ProductImageSkeleton, 
  ProductInfoSkeleton, 
  VariantSelectionSkeleton, 
  RelatedProductsSkeleton,
  ButtonSkeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  FilterSidebarSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  OrderCardSkeleton,
  OrdersListSkeleton
}