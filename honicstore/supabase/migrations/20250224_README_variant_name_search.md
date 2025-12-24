# Add Variant Name to Search Vector

This migration optimizes database search by adding `variant_name` from `product_variants` to the `search_vector` column in the `products` table.

## What This Does

1. **Updates Search Vector Functions**: Modifies the `update_product_search_vector()` function to include `variant_name` when building search vectors
2. **Updates Variant Change Triggers**: Ensures search vectors are updated when variants are added, modified, or deleted
3. **Updates Existing Products**: Rebuilds search vectors for all existing products to include variant names
4. **Creates Index**: Adds an index on `variant_name` for faster variant name lookups
5. **Updates Helper Functions**: Updates `update_all_search_vectors()` function to include variant names

## Benefits

- **Better Search Results**: Products can now be found by searching for variant names (e.g., "Red", "Large", "128GB")
- **Optimized Performance**: Uses PostgreSQL's full-text search (GIN index) for fast searches
- **Automatic Updates**: Search vectors are automatically updated when variants change

## How to Apply

Run the migration in your Supabase SQL Editor or via CLI:

```bash
supabase db push
```

Or run directly in Supabase SQL Editor.

## How It Works

### Search Vector Content

The `search_vector` column now includes:
- Product name
- Product description
- Category
- Brand
- SKU
- **Variant names** (NEW)
- Variant SKUs

### Automatic Updates

When a product or variant is created/updated:
1. The `update_product_search_vector()` trigger function runs
2. It collects all variant names and SKUs for the product
3. It rebuilds the search vector with all searchable text
4. The GIN index is automatically updated for fast searches

### Search Usage

The search vector is used in the products API (`app/api/products/route.ts`):

```typescript
.textSearch('search_vector', sanitized, { type: 'websearch' })
```

This will now match variant names automatically!

## Example

Before this migration:
- Searching for "Red" might not find products that only have "Red" as a variant name

After this migration:
- Searching for "Red" will find products with "Red" variant names
- Searching for "128GB" will find products with "128GB" variant names
- All variant names are indexed and searchable

## Notes

- Only uses columns that exist (`variant_name`, `sku`) - compatible with simplified variants schema
- The migration is idempotent - safe to run multiple times
- Existing search functionality continues to work unchanged
- No API changes required - search automatically benefits from variant names




