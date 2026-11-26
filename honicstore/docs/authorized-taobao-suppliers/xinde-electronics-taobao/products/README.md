# Product copy log — 信德电子

## Quick workflow

1. Open the Taobao item → 详情.
2. Create folder: `../images-copied/<item-id>/` (use the numeric id from the URL).
3. Download detail images into that folder (right-click save or browser download).
4. Add a row to `PRODUCT_LOG.csv`.
5. Upload images via Honic admin → product edit → **Main product image** / gallery.
6. Write customer-facing title/description in English (translate/adapt; don’t paste Chinese-only blocks unless you translate).

## One-product note template

Copy this file as `products/item-<taobao-id>.md` when needed:

```markdown
# Taobao item ID: 

- **URL:**
- **Title (CN):**
- **Honic product ID:**
- **Date copied:**
- **Seller authorization:** See ../00-AUTHORIZATION.md
- **Images saved:** ../images-copied/<item-id>/
- **Specs copied:** yes/no — list fields
```