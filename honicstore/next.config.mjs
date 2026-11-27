import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..')
const shouldUseStandaloneOutput = process.env.NEXT_OUTPUT_STANDALONE === 'true'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // (eslint config removed: Next.js 16 no longer runs or configures ESLint during builds)
  // The project type-checks cleanly (0 errors as of 2026-11-24): a new type error now fails the build
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Kept deliberately small: every (image × width × format × quality) is one billable
    // transformation on Vercel. WebP only (AVIF doubles the variants for a small gain);
    // widths cover phone cards → full-screen gallery.
    formats: ['image/webp'],
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [64, 128, 256, 384],
    qualities: [60, 75, 80, 85], // must include every quality= used in the code
    minimumCacheTTL: 31536000, // 1 year cache for images
    // SVGs never go through the optimizer (next/image serves .svg files as-is automatically)
    dangerouslyAllowSVG: false,
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
    // Keep visited pages in the client cache for 30 s so back/forward and repeat visits are instant
    // (product data and stock are re-read after that; payment state never relies on this cache).
    staleTimes: { dynamic: 30, static: 300 },
    // Build-only: lower peak memory so production builds fit on an 8 GB machine
    webpackMemoryOptimizations: true,
    cpus: 2,
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
  serverExternalPackages: ['@supabase/supabase-js', 'sharp', 'tesseract.js'], // sharp/tesseract: native + worker code, keep out of the bundle (photo search)
  // Navigation and prefetching optimizations
  trailingSlash: false, // Consistent URL structure
  skipTrailingSlashRedirect: true, // Avoid redirects
  // Monorepo/workspace root for tracing to avoid lockfile-root warnings.
  outputFileTracingRoot: workspaceRoot,
  // Use standalone only when explicitly enabled (e.g., CI/deploy).
  // This avoids Windows EBUSY copyfile issues during local builds.
  output: shouldUseStandaloneOutput ? 'standalone' : undefined,
  async redirects() {
    return [
      // Marketplace is now the main products page; removed pages point to their replacements
      { source: '/marketplace-demo', destination: '/products', permanent: true },
      { source: '/marketplace', destination: '/products', permanent: false },
      { source: '/home', destination: '/', permanent: true },
      { source: '/china', destination: '/buy-from-china', permanent: false },
      { source: '/china/:path*', destination: '/buy-from-china', permanent: false },
      { source: '/settings', destination: '/account/settings', permanent: true },
      { source: '/tracking', destination: '/support/order-tracking', permanent: false },
      { source: '/returns', destination: '/support/returns-refunds', permanent: false },
      { source: '/shipping', destination: '/support/shipping-info', permanent: false },
      { source: '/services/terms-of-service', destination: '/terms', permanent: false },
      { source: '/services/privacy-policy', destination: '/privacy', permanent: false },
      { source: '/gdpr', destination: '/privacy', permanent: false },
      { source: '/data-protection', destination: '/privacy', permanent: false },
      { source: '/coming-soon', destination: '/support', permanent: false },
      { source: '/help', destination: '/support', permanent: false },
      { source: '/services/pcb', destination: '/services/stem-kits', permanent: false },
      { source: '/services/ai', destination: '/services/stem-kits', permanent: false },
      { source: '/services/prototyping', destination: '/services/stem-kits', permanent: false },
      { source: '/services/electronics', destination: '/products', permanent: false },
      { source: '/services/electronics-supply', destination: '/products', permanent: false },
      { source: '/services/pcb-printing', destination: '/services/stem-kits', permanent: false },
      { source: '/services/ai-consultancy', destination: '/services/stem-kits', permanent: false },
      { source: '/discover', destination: '/products', permanent: false },
      { source: '/featured', destination: '/products', permanent: false },
      { source: '/buyer-central', destination: '/products', permanent: false },
      { source: '/products/on-demand', destination: '/products', permanent: false },
      { source: '/qrcode', destination: '/products', permanent: false },
      { source: '/location', destination: '/products', permanent: false },
      { source: '/test-location', destination: '/products', permanent: false },
    ]
  },
  // Photo search reads its bundled OCR data from disk; make sure Vercel ships the file with that function
  outputFileTracingIncludes: {
    '/api/image-search': ['./data/tessdata/**/*'],
  },
  async headers() {
    // Caching rules. SECURITY:
    // - Never mark API responses or pages as "public" here: carts, profiles, orders and sessions are per user,
    //   and a public / s-maxage header lets the browser and Vercel's CDN store one person's data and serve it
    //   to another. Routes that are safe to share (product lists, product detail) set their own CDN headers.
    // - No hand-written ETag headers: one ETag shared by every page/response makes caches return the wrong copy.
    //   Next.js and Vercel generate real ones.
    // - Pages: Next.js sets the right Cache-Control itself (ISR pages get s-maxage, dynamic pages no-store).
    // - Security headers (CSP, HSTS, X-Frame-Options...) are set in proxy.ts, one place only.
    return [
      // Fonts: 1 year
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Files in /public (logos, icons, placeholders) aren't content-hashed, so not "immutable":
      // cached for a week and refreshed in the background, so a replaced logo shows up
      {
        source: '/:path*\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      // API: private by default
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Accept-Encoding, Cookie, Authorization' },
        ],
      },
      // Public catalogue data (no login, same for everyone): shared on the CDN for a minute, refreshed in the
      // background. Only add routes here that never read cookies or the Authorization header.
      ...['/api/products', '/api/products/:id(\\d+)', '/api/products/:id(\\d+)/sold-count', '/api/search', '/api/categories', '/api/company/settings'].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      })),
    ]
  },
}

export default nextConfig
