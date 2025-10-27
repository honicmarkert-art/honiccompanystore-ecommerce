# Google Search Console Setup

## Step 1: Submit Your Sitemap

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property (www.honiccompanystore.com)
3. Click "Sitemaps" in the left menu
4. Enter: `https://www.honiccompanystore.com/sitemap.xml`
5. Click "Submit"

## Step 2: Fix Redirect Issues

### The Problem:
- Google is seeing redirects: http://honiccompanystore.com → https://www.honiccompanystore.com
- This prevents indexing

### Solution:
Set up proper domain redirects in your hosting provider (Vercel, Netlify, etc.):

#### For Vercel:
Add to `vercel.json`:
```json
{
  "redirects": [
    {
      "source": "/(.*)",
      "destination": "https://www.honiccompanystore.com/:path*",
      "permanent": true,
      "has": [
        {
          "type": "host",
          "value": "honiccompanystore.com"
        }
      ]
    }
  ]
}
```

#### For Other Hosting:
Redirect all non-www to www with HTTPS:
- http://honiccompanystore.com/* → https://www.honiccompanystore.com/*
- http://www.honiccompanystore.com/* → https://www.honiccompanystore.com/*

## Step 3: Verify Canonical URLs

Make sure your app has proper canonical URLs set. Update `app/layout.tsx`:

```tsx
export const metadata = {
  alternates: {
    canonical: 'https://www.honiccompanystore.com'
  }
}
```

## Step 4: Request Indexing

After submitting sitemap:
1. Go to Google Search Console
2. Use "URL Inspection" tool
3. Enter: `https://www.honiccompanystore.com`
4. Click "Request Indexing"

## Step 5: Wait for Processing

- Sitemap processing: 1-2 days
- First crawl: 1-7 days
- Full indexing: 2-4 weeks

## Monitoring:
- Check "Coverage" report in Search Console
- Look for "Submitted and indexed" pages increasing
- Fix any errors in the "Issues" section

