import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Honic Company Store - Online Shopping in Tanzania',
  description: 'Shop the best deals on electronics, fashion, home goods, and more. Free shipping across Tanzania. Best prices guaranteed!',
  keywords: 'online shopping, Tanzania, electronics, fashion, home goods, marketplace, best deals, free shipping',
  authors: [{ name: 'Honic Company Store' }],
  creator: 'Honic Company Store',
  publisher: 'Honic Company Store',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://www.honiccompanystore.com',
    siteName: 'Honic Company Store',
    title: 'Honic Company Store - Online Shopping in Tanzania',
    description: 'Shop the best deals on electronics, fashion, home goods, and more. Free shipping across Tanzania.',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://www.honiccompanystore.com'}/logo.png`,
        width: 1200,
        height: 630,
        alt: 'Honic Company Store',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Honic Company Store - Online Shopping in Tanzania',
    description: 'Shop the best deals on electronics, fashion, home goods, and more.',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://www.honiccompanystore.com'}/logo.png`],
  },
  verification: {
    google: 'your-google-verification-code',
    // Add other verification codes as needed
  },
}

