import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..')
const shouldUseStandaloneOutput = process.env.NEXT_OUTPUT_STANDALONE === 'true'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    qualities: [60, 75, 80, 85, 90, 100], // Required for Next.js 16 - configure allowed quality values (includes all values used in codebase)
    minimumCacheTTL: 31536000, // 1 year cache for images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Enable CDN support
    loader: 'default',
    // Optimize for performance
    unoptimized: false,
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [{
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').replace('http://', ''),
        port: '',
        pathname: '/storage/v1/object/public/**',
      }] : []),
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
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
  // Allow cross-origin requests from dev domain
  allowedDevOrigins: [
    ...(process.env.DEV_DOMAIN ? [
      `https://${process.env.DEV_DOMAIN}`,
      `http://${process.env.DEV_DOMAIN}`,
      process.env.DEV_DOMAIN,
    ] : [
      'https://dev.honiccompanystore.com',
      'http://dev.honiccompanystore.com',
      'dev.honiccompanystore.com',
    ]),
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // `experimental.turbo` is deprecated in Next 15+, use top-level `turbopack`.
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
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
    
    // Configure chunk loading and optimizations
    if (!isServer) {
      // Increase timeout for chunk loading to prevent premature failures
      config.output = {
        ...config.output,
        chunkLoadTimeout: 120000, // 2 minutes instead of default 30 seconds
        crossOriginLoading: 'anonymous', // Improve CORS handling for chunks
      }
      
      // Configure splitChunks to separate large modules (like auth context)
      // This helps prevent chunk loading timeouts by creating smaller, more manageable chunks
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate auth context into its own chunk to prevent blocking
            auth: {
              name: 'auth',
              test: /[\\/]contexts[\\/]auth-context/,
              priority: 20,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
        // Keep runtimeChunk disabled to avoid exports issues
        runtimeChunk: false,
      }
    } else {
      // For server-side, keep the original optimization settings
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
        runtimeChunk: false
      }
    }
    
    return config
  },
  // Enable compression
  compress: true,
  // Optimize page loading
  poweredByHeader: false,
  generateEtags: true, // Enable ETags for cache validation
  // Security: Request size limits (Note: Next.js 15 handles this differently, but this still works)
  // The warning can be ignored - body size limits are enforced at the route level
  // External packages for server components (moved from experimental)
  serverExternalPackages: ['@supabase/supabase-js'],
  // Navigation and prefetching optimizations
  trailingSlash: false, // Consistent URL structure
  skipTrailingSlashRedirect: true, // Avoid redirects
  // Monorepo/workspace root for tracing to avoid lockfile-root warnings.
  outputFileTracingRoot: workspaceRoot,
  // Use standalone only when explicitly enabled (e.g., CI/deploy).
  // This avoids Windows EBUSY copyfile issues during local builds.
  output: shouldUseStandaloneOutput ? 'standalone' : undefined,
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
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://www.google.com https://www.gstatic.com https://static.cloudflareinsights.com https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' data: ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''} https://*.supabase.co; connect-src 'self' ${process.env.CLICKPESA_API_URL || process.env.NEXT_PUBLIC_CLICKPESA_API_URL || 'https://api.clickpesa.com'} ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''} wss://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '') || ''} https://www.google.com https://vision.googleapis.com https://va.vercel-scripts.com; frame-src 'self' https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self';`
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
