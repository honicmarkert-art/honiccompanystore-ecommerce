# Cart Items Indexes - Query Patterns Guide

## Time-Based Partial Index Limitation

PostgreSQL doesn't allow `NOW()` in index predicates because it's not immutable (the value changes constantly). Instead, we use regular indexes and filter in queries.

## Index Usage Examples

### 1. Recent Cart Activity (Last 30 Days)

#### Before (Invalid):
```sql
-- ❌ Can't do this - NOW() is not immutable
CREATE INDEX ON cart_items (created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';
```

#### After (Correct):
```sql
-- ✅ Use regular index + filter in query
CREATE INDEX ON cart_items (created_at DESC);

-- Query with time filter
SELECT * FROM cart_items 
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

### 2. Old Cart Cleanup (Older Than 30 Days)

#### Before (Invalid):
```sql
-- ❌ Can't do this - NOW() is not immutable
CREATE INDEX ON cart_items (updated_at) 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

#### After (Correct):
```sql
-- ✅ Use regular index + filter in query
CREATE INDEX ON cart_items (updated_at ASC);

-- Query with time filter
DELETE FROM cart_items 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

### 3. Active Cart Items (Updated in Last 7 Days)

#### Before (Invalid):
```sql
-- ❌ Can't do this - NOW() is not immutable
CREATE INDEX ON cart_items (user_id, updated_at DESC) 
WHERE updated_at > NOW() - INTERVAL '7 days';
```

#### After (Correct):
```sql
-- ✅ Use regular index + filter in query
CREATE INDEX ON cart_items (user_id, updated_at DESC);

-- Query with time filter
SELECT * FROM cart_items 
WHERE updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

## Available Indexes

### Core Indexes
1. `idx_cart_items_user_id_performance` - User-based queries
2. `idx_cart_items_user_product_performance` - User + Product queries  
3. `idx_cart_items_user_product_variant_performance` - Variant queries

### Analytics Indexes
4. `idx_cart_items_recent_activity` - Recent activity (use with time filter)
5. `idx_cart_items_cleanup` - Cleanup queries (use with time filter)
6. `idx_cart_items_product_analytics` - Product popularity
7. `idx_cart_items_currency` - Multi-currency
8. `idx_cart_items_discount_analysis` - Discount patterns

### Optimization Indexes
9. `idx_cart_items_user_summary` - Cart summaries
10. `idx_cart_items_product_popularity` - Product popularity
11. `idx_cart_items_variant_analysis` - Variant analysis
12. `idx_cart_items_active` - Active carts (use with time filter)
13. `idx_cart_items_high_value` - High-value items (> $100)
14. `idx_cart_items_bulk_quantity` - Bulk quantities (> 5)

## Query Patterns

### Recent Activity Query
```sql
-- Use idx_cart_items_recent_activity + filter
SELECT * FROM cart_items 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Cleanup Query
```sql
-- Use idx_cart_items_cleanup + filter
DELETE FROM cart_items 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

### Active Carts Query
```sql
-- Use idx_cart_items_active + filter
SELECT user_id, COUNT(*) as item_count
FROM cart_items 
WHERE updated_at > NOW() - INTERVAL '7 days'
GROUP BY user_id;
```

## Performance Notes

### Index Efficiency
- PostgreSQL will still use indexes efficiently even with time filters
- The optimizer can use index range scans for time-based queries
- Covering indexes (with INCLUDE) avoid table lookups entirely

### Query Hints
If you need to force index usage:
```sql
SET enable_seqscan = off;
-- Run your query
SET enable_seqscan = on;
```

### Monitoring
Check index usage:
```sql
SELECT * FROM pg_stat_user_indexes 
WHERE relname = 'cart_items';
```

## Summary

✅ **Use**: Regular indexes with time filters in queries
❌ **Don't Use**: Time-based partial indexes with `NOW()`

The indexes will still work efficiently with query-level time filters!
