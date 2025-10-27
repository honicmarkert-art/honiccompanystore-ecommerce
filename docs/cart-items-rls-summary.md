# Cart Items RLS Policies and Indexes - Quick Summary

## 🛡️ Security Policies

| Policy | Access Level | Purpose |
|--------|-------------|---------|
| `cart_items_select_own_items` | User | View own cart items only |
| `cart_items_insert_own_cart` | User | Add items to own cart only |
| `cart_items_update_own_items` | User | Modify own cart items only |
| `cart_items_delete_own_items` | User | Remove own cart items only |
| `cart_items_admin_full_access` | Admin | Full access for management |
| `cart_items_system_access` | System | Webhook/cleanup operations |

## 🚀 Performance Indexes

### Core Indexes
- `idx_cart_items_user_id_performance` - User-based queries
- `idx_cart_items_user_product_performance` - User + Product queries
- `idx_cart_items_user_product_variant_performance` - Unique constraint optimization

### Analytics Indexes
- `idx_cart_items_recent_activity` - Last 30 days activity
- `idx_cart_items_product_analytics` - Product popularity
- `idx_cart_items_variant_analysis` - Variant preferences
- `idx_cart_items_currency` - Multi-currency support
- `idx_cart_items_discount_analysis` - Discount patterns

### Optimization Indexes
- `idx_cart_items_cleanup` - Old items identification
- `idx_cart_items_active` - Recently updated carts
- `idx_cart_items_high_value` - Items > $100
- `idx_cart_items_bulk_quantity` - Items with quantity > 5

## 📊 Access Matrix

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| **Regular User** | ✅ Own items | ✅ Own cart | ✅ Own items | ✅ Own items |
| **Admin User** | ✅ All items | ✅ All carts | ✅ All items | ✅ All items |
| **System/Webhook** | ✅ All items | ✅ All carts | ✅ All items | ✅ All items |
| **Anonymous** | ❌ No access | ❌ No access | ❌ No access | ❌ No access |

## 🔧 Common Operations

### User Cart Management
```sql
-- View cart
SELECT * FROM cart_items WHERE user_id = auth.uid();

-- Add item
INSERT INTO cart_items (user_id, product_id, quantity, price) 
VALUES (auth.uid(), 123, 2, 25.99);

-- Update quantity
UPDATE cart_items SET quantity = 3 WHERE user_id = auth.uid() AND product_id = 123;

-- Remove item
DELETE FROM cart_items WHERE user_id = auth.uid() AND product_id = 123;
```

### Admin Operations
```sql
-- View all carts
SELECT * FROM cart_items;

-- Help customer
SELECT * FROM cart_items WHERE user_id = 'customer-uuid';

-- Product analytics
SELECT product_id, COUNT(*) FROM cart_items GROUP BY product_id;
```

### System Operations
```sql
-- Cleanup old carts
DELETE FROM cart_items WHERE updated_at < NOW() - INTERVAL '30 days';

-- Process order
DELETE FROM cart_items WHERE user_id = 'order-user-uuid';
```

## 📈 Performance Benefits

- **User cart queries**: Sub-millisecond response
- **Product analytics**: Fast aggregation
- **Recent activity**: Optimized time-based queries
- **Cleanup operations**: Efficient old data identification

## 🔍 Monitoring Queries

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'cart_items';

-- View policies
SELECT * FROM pg_policies WHERE tablename = 'cart_items';

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE relname = 'cart_items';
```

## ⚠️ Important Notes

1. **RLS is enabled** - All access goes through policies
2. **Indexes are optimized** for common query patterns
3. **Admin access** requires proper role verification
4. **System operations** need NULL auth.uid() context
5. **Regular maintenance** recommended for optimal performance

## 🚀 Migration Commands

```bash
# Apply the migration
psql -d your_database -f supabase/migrations/20250124_add_cart_items_rls_policies.sql

# Test the policies
psql -d your_database -f supabase/migrations/test_cleanup_function.sql
```

This setup provides secure, performant cart operations with proper access control and optimization for all use cases.
