# Copy 信德电子 → Honic (even if product exists)

## Permission

Detail images allowed — see `00-AUTHORIZATION.md` and `evidence/`.

## One-item import (automated)

From `honicstore/`:

```bash
node scripts/import-xinde-taobao-item.mjs 5383206599
```

- **SKU** on site: `TAOBAO-<itemId>` (e.g. `TAOBAO-5383206599`)
- **Always creates a new product** (duplicates on site are OK). Unique SKU `TAOBAO-<id>-<ts>` and slug includes `taobao-<id>`.
- Supplier must be able to add products (Premium = unlimited). Honic supplier is on **Premium** so imports are not blocked at 30.

Pricing defaults: `price ≈ ¥ × 380 × 2.8`, rounded to nearest 50 TZS, minimum 200 TZS. Override with env `TAOBAO_CNY_TO_TZS` / `TAOBAO_MARKUP`.

**Main image:** import scripts sort Taobao URLs by quality (`760x760` / `item_pic` first, avoid `q50` thumbs). The **best** file is uploaded first and stored as `products.image`; gallery keeps the rest (minimum 5 when available).

## Add more Taobao IDs

1. Open item in Cursor browser (logged into Taobao).
2. Copy **alicdn** image URLs from 图集 + 图文详情.
3. Add a block to `PRESET` in `scripts/import-xinde-taobao-item.mjs` (name EN, category, `imageUrls`, specs).
4. Run `node scripts/import-xinde-taobao-item.mjs <id>`.

## Manual fallback

1. Save images → `images-copied/<itemId>/`
2. Supplier admin → Add product, or edit if SKU `TAOBAO-<id>` exists.
3. Log in `products/PRODUCT_LOG.csv`.

## Categories (common)

| Taobao type | Honic category |
|-------------|----------------|
| Modules, sensors | Sensors / DIY Electronic Components |
| Kits | Project Kits |
| Wires, connectors | Connectors & Cables |
| Switches, small parts | DIY Electronic Components |