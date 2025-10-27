# Cart Items RLS Policies and Indexes Documentation

## Overview
This document describes the Row Level Security (RLS) policies and performance indexes implemented for the `cart_items` table to ensure secure access control and optimal query performance.

## Cart Items Table Schema
```sql
CREATE TABLE public.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id integer NOT NULL,
  variant_id text NULL,
  quantity integer NOT NULL,
  price numeric(10,2) NOT NULL,
  currency character(3) NULL DEFAULT 'USD',
  applied_discount numeric(10,2) NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  -- Constraints and indexes...
);
```

## RLS Policies

### 1. User Access Control
- **SELECT Policy**: Users can only view their own cart items
- **INSERT Policy**: Users can only add items to their own cart
- **UPDATE Policy**: Users can only modify their own cart items
- **DELETE Policy**: Users can only remove items from their own cart

### 2. Admin Access
- **Full Access**: Admin and super_admin users can view and manage all cart items
- **Purpose**: Allows administrators to help customers, analyze cart data, and manage abandoned carts

### 3. System Access
- **Webhook Access**: System operations (like cleanup functions) can access cart items
- **Purpose**: Enables automated processes like cart cleanup and order processing

## Performance Indexes

### Primary Indexes
1. **User-based queries** - Most common cart operations
2. **User + Product queries** - Product-specific cart operations
3. **User + Product + Variant** - Variant-specific operations (optimizes unique constraint)

### Analytics Indexes
4. **Recent activity** - Last 30 days of cart activity
5. **Product analytics** - Product popularity in carts
6. **Variant analysis** - Variant preference analysis
7. **Currency queries** - Multi-currency support
8. **Discount analysis** - Discount usage patterns

### Optimization Indexes
9. **Cart cleanup** - Old/abandoned cart identification
10. **User cart summary** - Cart totals and counts
11. **Product popularity** - Most added products
12. **Active carts** - Recently updated carts (last 7 days)
13. **High-value items** - Items over $100
14. **Bulk quantities** - Items with quantity > 5

## Security Benefits

### Data Isolation
- Users cannot access other users' cart data
- Prevents cart manipulation attacks
- Ensures privacy compliance

### Admin Oversight
- Administrators can help customers with cart issues
- Analytics and reporting capabilities
- Abandoned cart management

### System Operations
- Automated cart cleanup
- Order processing integration
- Webhook operations

## Performance Benefits

### Query Optimization
- **User cart queries**: Sub-millisecond response times
- **Product analytics**: Fast aggregation queries
- **Recent activity**: Optimized time-based queries
- **Cleanup operations**: Efficient old data identification

### Index Strategy
- **Covering indexes**: Include commonly selected columns
- **Partial indexes**: Optimize specific scenarios
- **Composite indexes**: Support complex queries
- **Conditional indexes**: Focus on relevant data subsets

## Usage Examples

### User Cart Operations
```sql
-- View own cart
SELECT * FROM cart_items WHERE user_id = auth.uid();

-- Add item to cart
INSERT INTO cart_items (user_id, product_id, quantity, price) 
VALUES (auth.uid(), 123, 2, 25.99);

-- Update quantity
UPDATE cart_items 
SET quantity = 3, updated_at = NOW() 
WHERE user_id = auth.uid() AND product_id = 123;

-- Remove item
DELETE FROM cart_items 
WHERE user_id = auth.uid() AND product_id = 123;
```

### Admin Operations
```sql
-- View all carts (admin only)
SELECT * FROM cart_items;

-- Help customer with cart issue
SELECT * FROM cart_items WHERE user_id = 'customer-uuid';

-- Analyze product popularity
SELECT product_id, COUNT(*) as cart_count
FROM cart_items 
GROUP BY product_id 
ORDER BY cart_count DESC;
```

### System Operations
```sql
-- Cleanup old cart items
DELETE FROM cart_items 
WHERE updated_at < NOW() - INTERVAL '30 days';

-- Process order (webhook)
DELETE FROM cart_items 
WHERE user_id = 'order-user-uuid';
```

## Monitoring and Maintenance

### Performance Monitoring
- Monitor index usage with `pg_stat_user_indexes`
- Track query performance with `pg_stat_statements`
- Analyze slow queries and optimize indexes

### Security Auditing
- Review RLS policy effectiveness
- Monitor admin access patterns
- Audit system operations

### Index Maintenance
- Regular `VACUUM ANALYZE` on cart_items table
- Monitor index bloat and rebuild if necessary
- Update statistics for optimal query planning

## Migration Notes

### Applying the Migration
1. Run the migration during low-traffic periods
2. Monitor performance after index creation
3. Verify RLS policies work correctly
4. Test admin and system access

### Rollback Considerations
- Indexes can be dropped without data loss
- RLS policies can be disabled if needed
- Original functionality preserved

## Best Practices

### Development
- Always test RLS policies with different user roles
- Use proper authentication in API endpoints
- Implement proper error handling for access violations

### Production
- Monitor cart performance metrics
- Set up alerts for unusual cart activity
- Regular security audits of cart access

### Maintenance
- Regular index maintenance
- Monitor cart cleanup effectiveness
- Update policies as business requirements change

## Troubleshooting

### Common Issues
1. **Access Denied**: Check user authentication and role
2. **Slow Queries**: Verify index usage and statistics
3. **Policy Conflicts**: Review policy order and logic
4. **Index Bloat**: Regular maintenance and rebuilding

### Debugging Queries
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'cart_items';

-- View active policies
SELECT * FROM pg_policies 
WHERE tablename = 'cart_items';

-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE relname = 'cart_items';
```

This comprehensive setup ensures secure, performant cart operations while maintaining flexibility for admin and system operations.
