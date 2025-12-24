# How Search Vector is Created - Complete Flow

## Overview
The `search_vector` is a PostgreSQL `tsvector` column that stores preprocessed, searchable text. It's automatically created and updated by database triggers.

## Step-by-Step Creation Process

### 1. **Database Column**
```sql
ALTER TABLE products 
ADD COLUMN search_vector tsvector;
```
- This column stores the searchable text vector
- Type: `tsvector` (PostgreSQL full-text search type)

### 2. **Trigger Function: `update_product_search_vector()`**

This function runs **BEFORE** every INSERT or UPDATE on the `products` table.

#### What It Does:

```sql
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  variant_text TEXT := '';
  variant_record RECORD;
BEGIN
  -- STEP 1: Collect all variant data
  FOR variant_record IN 
    SELECT 
      COALESCE(variant_name, '') as variant_name,
      COALESCE(sku, '') as sku
    FROM product_variants 
    WHERE product_id = NEW.id
  LOOP
    variant_text := variant_text || ' ' || 
      variant_record.variant_name || ' ' ||
      variant_record.sku;
  END LOOP;

  -- STEP 2: Combine all searchable text
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.category, '') || ' ' ||
    COALESCE(NEW.brand, '') || ' ' ||
    COALESCE(NEW.sku, '') || ' ' ||
    variant_text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. **Trigger: Automatically Runs on Product Changes**

```sql
CREATE TRIGGER update_products_search_vector
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_search_vector();
```

**When This Triggers:**
- ✅ When a new product is created (`INSERT`)
- ✅ When a product is updated (`UPDATE`)
- ✅ Runs **BEFORE** the data is saved to database

### 4. **Variant Change Trigger**

When variants are added/updated/deleted, the product's search_vector is also updated:

```sql
CREATE TRIGGER update_product_search_on_variant_change
  AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_search_vector_from_variants();
```

**When This Triggers:**
- ✅ When a variant is added to a product
- ✅ When a variant is updated
- ✅ When a variant is deleted
- ✅ Runs **AFTER** the variant change

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ADMIN CREATES/UPDATES PRODUCT                            │
│    INSERT INTO products (name, description, ...)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. TRIGGER FIRES (BEFORE INSERT/UPDATE)                     │
│    update_products_search_vector trigger executes           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FUNCTION RUNS: update_product_search_vector()            │
│                                                              │
│    a) Collects product fields:                              │
│       - name: "Arduino Uno"                                 │
│       - description: "Microcontroller board"                │
│       - category: "Electronics"                             │
│       - brand: "Arduino"                                    │
│       - sku: "ARDUINO001"                                   │
│                                                              │
│    b) Queries product_variants table:                       │
│       SELECT variant_name, sku                              │
│       WHERE product_id = NEW.id                             │
│                                                              │
│    c) Combines all text:                                    │
│       "Arduino Uno Microcontroller board Electronics        │
│        Arduino ARDUINO001 Red Blue R3"                      │
│                                                              │
│    d) Processes with to_tsvector('english', ...):           │
│       - Normalizes (lowercase)                              │
│       - Removes stop words ("the", "a", "an")               │
│       - Stems words ("running" → "run")                     │
│       - Tokenizes into searchable terms                      │
│                                                              │
│    e) Creates search_vector:                                │
│       'arduino':1,4,30 'board':9 'electron':4              │
│       'microcontroll':2 'r3':1 'red':6 'blue':7            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. PRODUCT SAVED TO DATABASE                                │
│    search_vector column now contains the vector             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. GIN INDEX AUTOMATICALLY UPDATED                          │
│    Fast search index is rebuilt for this product            │
└─────────────────────────────────────────────────────────────┘
```

## Example: Creating "Arduino Uno" Product

### Input Data:
```json
{
  "name": "Arduino Uno",
  "description": "Microcontroller development board",
  "category": "Electronics",
  "brand": "Arduino",
  "sku": "ARDUINO001",
  "variants": [
    { "variant_name": "R3", "sku": "UNO-R3" },
    { "variant_name": "Red", "sku": "UNO-RED" }
  ]
}
```

### Step 1: Function Collects Text
```
"Arduino Uno Microcontroller development board Electronics Arduino ARDUINO001 R3 UNO-R3 Red UNO-RED"
```

### Step 2: to_tsvector() Processes It
- Removes: "the", "a", "an" (stop words)
- Stems: "development" → "develop", "microcontroller" → "microcontroll"
- Normalizes: All lowercase
- Tokenizes: Creates searchable tokens

### Step 3: Final search_vector
```
'arduino':1,4,30 'board':9 'develop':2 'electron':4 'microcontroll':2 'r3':1 'red':6 'uno':1
```

**Numbers after colons** = positions where word appears in original text

## When Search Vector Updates

### ✅ Automatic Updates:
1. **Product Created** → Trigger fires → Vector created
2. **Product Updated** → Trigger fires → Vector updated
3. **Variant Added** → Variant trigger fires → Product vector updated
4. **Variant Updated** → Variant trigger fires → Product vector updated
5. **Variant Deleted** → Variant trigger fires → Product vector updated

### ❌ Manual Updates Needed:
- If you manually edit the database
- If you bypass triggers
- If you need to rebuild all vectors (use `update_all_search_vectors()` function)

## What Gets Included in Search Vector

### From Product Table:
- ✅ `name` - Product name
- ✅ `description` - Product description
- ✅ `category` - Category name
- ✅ `brand` - Brand name
- ✅ `sku` - Product SKU

### From Variants Table:
- ✅ `variant_name` - Variant names (e.g., "Red", "Large", "128GB")
- ✅ `sku` - Variant SKUs

### What's NOT Included:
- ❌ Price (numbers don't help search)
- ❌ Stock quantity
- ❌ Images
- ❌ Dates
- ❌ IDs

## How to_tsvector() Works

### Input:
```
"Arduino Uno Microcontroller board"
```

### Process:
1. **Lowercase**: `"arduino uno microcontroller board"`
2. **Remove stop words**: `"arduino uno microcontroller board"` (no stop words here)
3. **Stem words**: 
   - "microcontroller" → "microcontroll"
   - "board" → "board" (already stemmed)
4. **Tokenize**: Split into individual words
5. **Index positions**: Track where each word appears

### Output:
```
'arduino':1 'board':4 'microcontroll':3 'uno':2
```

## Performance Benefits

### GIN Index:
```sql
CREATE INDEX idx_products_search_vector 
ON products USING GIN (search_vector);
```

- **GIN** = Generalized Inverted Index
- Like a book index - finds all products containing a word instantly
- Even with millions of products, search is fast
- Automatically updated when search_vector changes

## Testing the Creation

You can test by:

1. **Creating a product** and checking search_vector:
```sql
SELECT name, search_vector 
FROM products 
WHERE id = 99;
```

2. **Updating a product** and seeing search_vector change:
```sql
UPDATE products 
SET name = 'New Name' 
WHERE id = 99;

SELECT search_vector FROM products WHERE id = 99;
```

3. **Adding a variant** and seeing search_vector update:
```sql
INSERT INTO product_variants (product_id, variant_name, sku)
VALUES (99, 'New Variant', 'NEW-SKU');

SELECT search_vector FROM products WHERE id = 99;
```

## Summary

**The search_vector is created automatically by database triggers whenever:**
1. A product is created or updated
2. A variant is added, updated, or deleted

**The process:**
1. Collect all searchable text (name, description, category, brand, SKU, variants)
2. Combine into one string
3. Process with `to_tsvector('english', ...)` to normalize and tokenize
4. Store in `search_vector` column
5. GIN index automatically updates for fast searching

**No manual intervention needed** - it's all automatic! 🎉



