"use client"

import React, { Component, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logError } from '@/lib/error-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary for Product Detail Page
 * Catches errors in product rendering and shows fallback UI
 */
export class ProductDetailErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for monitoring
    logError(error, {
      action: 'product_detail_error_boundary',
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'ProductDetailErrorBoundary'
      }
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <ProductDetailErrorFallback 
          error={this.state.error} 
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Fallback UI component for product detail errors
 */
function ProductDetailErrorFallback({ 
  error, 
  onReset 
}: { 
  error: Error | null
  onReset: () => void 
}) {
  const router = useRouter()

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl font-bold">
            Unable to Load Product
          </CardTitle>
          <CardDescription>
            Something went wrong while loading the product details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>We're having trouble loading this product.</p>
            {process.env.NODE_ENV === 'development' && error && (
              <p className="mt-2 text-xs font-mono text-gray-400 dark:text-gray-500">
                {error.message}
              </p>
            )}
          </div>
          
          <div className="flex flex-col space-y-2">
            <Button 
              onClick={onReset}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            <Button 
              onClick={() => router.push('/products')}
              className="w-full"
              variant="outline"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
