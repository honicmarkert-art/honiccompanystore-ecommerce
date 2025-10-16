# Image Optimization and Upload Guidelines

Purpose: Ensure fast loading, consistent visuals, and good Core Web Vitals across the storefront by standardizing image formats, sizes, and usage.

## Recommended Formats
- Primary: AVIF (best compression), WebP (fallback)
- Fallback: JPEG (only when older clients or tooling require it)
- PNG: Only for transparency (logos, icons, UI)

## Source Upload (Master)
- Canvas: 1200×1200 px (square), sRGB color profile
- Background: Clean, neutral light; product centered with even padding
- Naming: product-slug-1200.avif (also .webp and .jpg variants if needed)
- Target file size: 250–450 KB (masters), visually lossless

## Derived Sizes (Variants)
Generate or optimize to these sizes (or let Next Image do on-the-fly if preferred):
- 1200×1200 – product detail hero/zoom
- 640×640 – product grid/list cards
- 256×256 – cart, wishlist, recommendations
- 96×96 – thumbnails, small badges

Suggested quality (using Sharp):
- AVIF: q=45–55 (detail: ~50)
- WebP: q=70–78 (cards: ~72; detail: ~78)
- JPEG: q=80–85 (only when needed)

## Next.js Configuration
Add image formats and domains in `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: [
      // Add your hosts (CDN / Supabase project domain)
      'your-supabase-project-id.supabase.co'
    ],
  },
}
module.exports = nextConfig
```

## Component Usage (sizes, quality, placeholders)

Product grid/list card:
```tsx
<Image
  src={imageUrl640}
  alt={name}
  width={640}
  height={640}
  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 12vw"
  placeholder={blurDataURL ? 'blur' : undefined}
  blurDataURL={blurDataURL}
  quality={72}
  priority={index < 6}
/>
```

Product detail hero:
```tsx
<Image
  src={imageUrl1200}
  alt={name}
  width={1200}
  height={1200}
  sizes="(max-width: 640px) 95vw, (max-width: 1024px) 60vw, 800px"
  quality={82}
  priority
/>
```

Cart / recommendations:
```tsx
<Image
  src={imageUrl256}
  alt={name}
  width={256}
  height={256}
  sizes="(max-width: 640px) 33vw, 256px"
  quality={68}
/>
```

Thumbnails:
```tsx
<Image src={imageUrl96} alt={name} width={96} height={96} sizes="96px" quality={65} />
```

Rules of thumb:
- Use `object-cover` for cards; `object-contain` only when full shape must be visible.
- Always set width/height (or `aspect-square`) to prevent layout shift.
- Use `priority` only above the fold (first row/hero) to avoid network contention.

## Upload Pipeline (Server)
On upload, generate AVIF/WebP/JPEG variants and a tiny blur placeholder:

Pseudocode (Sharp):
```ts
import sharp from 'sharp'

const SIZES = [1200, 640, 256, 96]
const outputs: Record<string, { avif: string; webp: string; jpg: string }> = {}

for (const size of SIZES) {
  const avif = await sharp(buffer).resize(size, size, { fit: 'cover' }).avif({ quality: 50 }).toBuffer()
  const webp = await sharp(buffer).resize(size, size, { fit: 'cover' }).webp({ quality: 72 }).toBuffer()
  const jpg  = await sharp(buffer).resize(size, size, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer()
  // Upload buffers to storage/CDN and capture public URLs (outputs[size] = {...})
}

const blurDataURL = `data:image/jpeg;base64,${(
  await sharp(buffer).resize(20).jpeg({ quality: 30 }).toBuffer()
).toString('base64')}`
```

Persist on product record (JSONB):
```json
{
  "image_variants": {
    "96": {"avif": "...", "webp": "...", "jpg": "..."},
    "256": {"avif": "...", "webp": "...", "jpg": "..."},
    "640": {"avif": "...", "webp": "...", "jpg": "..."},
    "1200": {"avif": "...", "webp": "...", "jpg": "..."}
  },
  "blur_data_url": "data:image/jpeg;base64,..."
}
```

## Delivery & Caching
- Cache headers: `public, max-age=86400, s-maxage=604800`
- Add `<link rel="preconnect" href="https://your-supabase-project-id.supabase.co" />`
- Preload critical hero/banner images when necessary

## Quality/Size Targets
- Cards (640): 80–160 KB typical
- Detail hero (1200): 200–350 KB typical
- Thumbs (96/256): 10–60 KB

## Troubleshooting
- Images not appearing: check `next.config.js` `images.domains`, CORS, and bucket permissions.
- Slow first-load: warm cache or enable preconnect; consider prerender of top products.
- Blurry on retina: ensure `sizes` reflects actual CSS width; avoid stretching small sources.

---
This document standardizes image handling for performance, consistency, and SEO. Adopt it across upload workflows and components.



