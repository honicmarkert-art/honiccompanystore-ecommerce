'use client'

import { ChevronLeft, Share2, Facebook, Twitter, Instagram } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface ProductHeaderProps {
  productName: string
  category?: string
  productUrl?: string
}

export function ProductHeader({ productName, category, productUrl }: ProductHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()

  const handleShare = (platform?: string) => {
    const url = productUrl || window.location.href
    const text = `Check out ${productName}!`

    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url)
      toast({
        title: "Link copied!",
        description: "Product link copied to clipboard"
      })
    } else if (navigator.share) {
      navigator.share({
        title: productName,
        text,
        url
      }).catch(() => {
        // Fallback if share fails
        navigator.clipboard.writeText(url)
        toast({
          title: "Link copied!",
          description: "Product link copied to clipboard"
        })
      })
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2 hover:bg-accent"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          {/* Breadcrumb Navigation - Hidden on mobile */}
          <nav className="hidden md:flex text-sm text-muted-foreground items-center">
            <button
              onClick={() => router.push('/')}
              className="hover:text-foreground transition-colors"
            >
              Home
            </button>
            <span className="mx-2">/</span>
            {category && (
              <>
                <button
                  onClick={() => router.push(`/products?category=${encodeURIComponent(category)}`)}
                  className="hover:text-foreground transition-colors"
                >
                  {category}
                </button>
                <span className="mx-2">/</span>
              </>
            )}
            <span className="text-foreground truncate max-w-xs font-medium">
              {productName}
            </span>
          </nav>

          {/* Share Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare('facebook')}>
                <Facebook className="w-4 h-4 mr-2" />
                Share on Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('twitter')}>
                <Twitter className="w-4 h-4 mr-2" />
                Share on Twitter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')}>
                <Share2 className="w-4 h-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

