import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { CompanyProvider } from '@/components/company-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { GlobalAuthModalProvider } from '@/contexts/global-auth-modal'
import { CurrencyProvider } from '@/contexts/currency-context'
import { RoutePrefetcher } from '@/components/route-prefetcher'
import { PerformanceOptimizer } from '@/components/performance-optimizer'
import { AdvancedRoutePrefetcher } from '@/components/advanced-route-prefetcher'
import { SharedDataCacheProvider } from '@/contexts/shared-data-cache'
import { OptimizedPageWrapper, ScrollRestoration, PageTransitionMonitor } from '@/components/optimized-page-transition'
import { Toaster } from '@/components/ui/toaster'
import { HydrationFix } from '@/components/hydration-fix'
import { SWRProvider } from '@/components/swr-provider'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'

export const metadata: Metadata = {
  title: 'honiccompanystore - Shopping',
  description: 'Discover amazing products at unbeatable prices. Fast shipping, secure payments, and exceptional customer service.',
  generator: 'Next.js',
  keywords: 'online shopping, ecommerce, electronics, fashion, home goods',
  authors: [{ name: 'honiccompanystore' }],
  openGraph: {
    title: 'honiccompanystore - Shopping',
    description: 'Discover amazing products at unbeatable prices',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'honiccompanystore - Shopping',
    description: 'Discover amazing products at unbeatable prices',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicon - Multiple sizes for better browser support */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://qobobocldfjhdkpjyuuq.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://qobobocldfjhdkpjyuuq.supabase.co" />
        <link rel="preconnect" href="https://api.clickpesa.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.clickpesa.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Preload critical fonts */}
        <link 
          rel="preload" 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          as="style" 
        />
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
        />
        
        {/* Meta tags for performance */}
        <meta name="theme-color" content="#ffffff" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Hydration fix script - runs before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Remove browser extension attributes before React hydration
              (function() {
                const extensionAttributes = [
                  'bis_skin_checked',
                  'data-bis_skin_checked',
                  'data-bis_skin',
                  'data-bis',
                  'data-adblock',
                  'data-adblocker',
                  'data-extension',
                  'data-browser-extension',
                  'data-ublock',
                  'data-ghostery',
                  'data-adguard',
                  'data-privacy-badger'
                ];
                
                function removeExtensionAttributes() {
                  extensionAttributes.forEach(attr => {
                    const elements = document.querySelectorAll('[' + attr + ']');
                    elements.forEach(element => {
                      element.removeAttribute(attr);
                    });
                  });
                }
                
                // Run immediately
                removeExtensionAttributes();
                
                // Run when DOM is ready
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', removeExtensionAttributes);
                } else {
                  removeExtensionAttributes();
                }
                
                // Run periodically to catch dynamically added attributes
                setInterval(removeExtensionAttributes, 50);
              })();
            `,
          }}
        />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Resource hints for better performance */}
        <link rel="prefetch" href="/products" />
        <link rel="prefetch" href="/cart" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SharedDataCacheProvider>
            <SWRProvider>
              <AuthProvider>
                <GlobalAuthModalProvider>
                  <CurrencyProvider>
                    <CompanyProvider>
                      <RoutePrefetcher />
                      <AdvancedRoutePrefetcher />
                      <PerformanceOptimizer />
                      <ScrollRestoration />
                      <PageTransitionMonitor />
                      <OptimizedPageWrapper>
                        {children}
                      </OptimizedPageWrapper>
                      <HydrationFix />
                      <Toaster />
                    </CompanyProvider>
                  </CurrencyProvider>
                </GlobalAuthModalProvider>
              </AuthProvider>
            </SWRProvider>
          </SharedDataCacheProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
