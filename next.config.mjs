/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make environment variables available during build
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year cache for images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Enable CDN support
    loader: 'default',
    // Optimize for performance
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qobobocldfjhdkpjyuuq.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add CDN domains if you have them
      {
        protocol: 'https',
        hostname: 'cdn.yourdomain.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Enable modern performance features
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Suppress hydration warnings for browser extension attributes
  reactStrictMode: false,
  // Reduce disk writes during dev to avoid ENOSPC on low-space environments
  webpack: (config, { dev, isServer, webpack }) => {
    if (dev) {
      // Disable webpack filesystem cache in dev to minimize writes
      config.cache = false
    }
    
    // Handle exports error - minimal approach
    if (isServer) {
      config.plugins = config.plugins || []
      
      // Define minimal globals for server-side compatibility
      config.plugins.push(new webpack.DefinePlugin({
        'typeof self': '"undefined"',
        'typeof window': '"undefined"'
      }))
    }
    
    // Fix Supabase realtime dependency warnings
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
    }
    
    // Handle critical dependency warnings
    config.module = {
      ...config.module,
      exprContextCritical: false,
      unknownContextCritical: false
    }
    
    // Disable problematic optimizations that cause exports issues
    config.optimization = {
      ...config.optimization,
      // Remove splitChunks to avoid exports issues
      splitChunks: false,
      // Remove runtimeChunk to avoid exports issues
      runtimeChunk: false
    }
    
    return config
  },
  // Enable compression
  compress: true,
  // Optimize page loading
  poweredByHeader: false,
  generateEtags: true, // Enable ETags for cache validation
  // External packages for server components (moved from experimental)
  serverExternalPackages: ['@supabase/supabase-js'],
  // Navigation and prefetching optimizations
  trailingSlash: false, // Consistent URL structure
  skipTrailingSlashRedirect: true, // Avoid redirects
  // Enable static optimization
  output: 'standalone', // Optimize for deployment
  // Enhanced Security Headers and Performance Optimizations
  async headers() {
    return [
      // Static assets caching (Next.js generated files) - 1 year
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'ETag',
            value: 'W/"static-asset"',
          },
        ],
      },
      // Image optimization caching - 1 year
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'ETag',
            value: 'W/"optimized-image"',
          },
        ],
      },
      // Fonts caching - 1 year
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'ETag',
            value: 'W/"font"',
          },
        ],
      },
      // Public assets (images, icons, etc.) - 1 year
      {
        source: '/:path*\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'ETag',
            value: 'W/"public-asset"',
          },
        ],
      },
      // API routes caching - 5 minutes with revalidation
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
          },
          {
            key: 'ETag',
            value: 'W/"api-response"',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Landing page - 1 hour with long revalidation
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
          },
          {
            key: 'ETag',
            value: 'W/"landing-page"',
          },
        ],
      },
      // All other routes (pages, etc.)
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://www.google.com https://www.gstatic.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' data: https://qobobocldfjhdkpjyuuq.supabase.co https://*.supabase.co; connect-src 'self' https://api.clickpesa.com https://qobobocldfjhdkpjyuuq.supabase.co wss://qobobocldfjhdkpjyuuq.supabase.co https://www.google.com https://vision.googleapis.com; frame-src 'self' https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self';"
          },
          // Security Headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Page caching (shorter for dynamic content)
          ...(process.env.NODE_ENV === 'development' ? [{
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          }] : [{
            key: 'Cache-Control',
            value: 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400',
          }]),
          {
            key: 'ETag',
            value: 'W/"page-content"',
          },
        ],
      },
    ]
  },
}

export default nextConfig
