import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { WebThemeProvider } from '@/contexts/theme-context'
import { CompanyProvider } from '@/components/company-provider'
import { PublicCompanyProvider } from '@/contexts/public-company-context'
import { AuthProvider } from '@/contexts/auth-context'
import { GlobalAuthModalProvider } from '@/contexts/global-auth-modal'
import { CurrencyProvider } from '@/contexts/currency-context'
import { LanguageProvider } from '@/contexts/language-context'
import { NextIntlProvider } from '@/components/next-intl-provider'
import { RoutePrefetcher } from '@/components/route-prefetcher'
import { PerformanceOptimizer } from '@/components/performance-optimizer'
import { AdvancedRoutePrefetcher } from '@/components/advanced-route-prefetcher'
import { SharedDataCacheProvider } from '@/contexts/shared-data-cache'
import { OptimizedPageWrapper, ScrollRestoration, PageTransitionMonitor } from '@/components/optimized-page-transition'
import { Toaster } from '@/components/ui/toaster'
import { HydrationFix } from '@/components/hydration-fix'
import { SWRProvider } from '@/components/swr-provider'
import { ChunkErrorHandler } from '@/components/chunk-error-handler'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'

export const metadata: Metadata = {
  title: 'Honic Company Store - Online Shopping in Tanzania',
  description: 'Shop the best deals on electronics, fashion, home goods, and more. Free shipping across Tanzania. Best prices guaranteed!',
  generator: 'Next.js',
  keywords: 'online shopping, Tanzania, electronics, fashion, home goods, marketplace, best deals, free shipping',
  authors: [{ name: 'Honic Company Store' }],
  alternates: {
    canonical: 'https://www.honiccompanystore.com'
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome', url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'android-chrome', url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Honic Company Store - Online Shopping in Tanzania',
    description: 'Shop the best deals on electronics, fashion, home goods, and more. Free shipping across Tanzania.',
    type: 'website',
    locale: 'en_US',
    url: 'https://www.honiccompanystore.com',
    siteName: 'Honic Company Store',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Honic Company Store - Online Shopping in Tanzania',
    description: 'Shop the best deals on electronics, fashion, home goods, and more.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
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
                
                // Run more frequently to catch dynamically added attributes
                setInterval(removeExtensionAttributes, 10);
                
                // Also run on any DOM mutations
                if (typeof MutationObserver !== 'undefined') {
                  function startObserver() {
                    try {
                      if (!document.body) return false
                      const observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                          if (mutation.type === 'attributes') {
                            extensionAttributes.forEach(attr => {
                              if ((mutation.target && mutation.target.hasAttribute) && mutation.target.hasAttribute(attr)) {
                                mutation.target.removeAttribute(attr);
                              }
                            });
                          }
                        });
                      });
                      observer.observe(document.body, {
                        attributes: true,
                        subtree: true,
                        attributeFilter: extensionAttributes
                      });
                      return true
                    } catch {}
                    return false
                  }
                  
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => { startObserver() })
                  } else if (!startObserver()) {
                    // Retry shortly if body not ready yet
                    const obsInterval = setInterval(() => {
                      if (startObserver()) clearInterval(obsInterval)
                    }, 50)
                  }
                }
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
          <WebThemeProvider>
          <SharedDataCacheProvider>
            <SWRProvider>
              <AuthProvider>
                <GlobalAuthModalProvider>
                  <CurrencyProvider>
                    <LanguageProvider>
                      <NextIntlProvider>
                      <CompanyProvider>
                        <PublicCompanyProvider>
                        <RoutePrefetcher />
                        <AdvancedRoutePrefetcher />
                        <PerformanceOptimizer />
                        <ScrollRestoration />
                        <PageTransitionMonitor />
                        <OptimizedPageWrapper>
                          {children}
                        </OptimizedPageWrapper>
                        <HydrationFix />
                        <ChunkErrorHandler />
                        <div suppressHydrationWarning>
                        <Toaster />
                        </div>
                        </PublicCompanyProvider>
                      </CompanyProvider>
                      </NextIntlProvider>
                    </LanguageProvider>
                  </CurrencyProvider>
                </GlobalAuthModalProvider>
              </AuthProvider>
            </SWRProvider>
          </SharedDataCacheProvider>
          </WebThemeProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
