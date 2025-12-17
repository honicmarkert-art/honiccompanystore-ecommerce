# Database Migrations

This folder contains all database migration files for the AliExpress Clone project.

## Migration Files

### Core Performance & Features
- `001_performance_indexes.sql` - Basic performance indexes
- `002_profiles_with_trigger.sql` - User profiles with triggers
- `002_stock_sync_trigger.sql` - Stock synchronization triggers
- `003_improved_stock_logic.sql` - Enhanced stock management
- `004_product_stock_status_trigger.sql` - Product stock status automation
- `005_add_variant_images_column.sql` - Product variant images support
- `006_add_admin_settings_service_columns.sql` - Admin settings enhancements
- `007_full_text_search_indexes.sql` - Full-text search optimization

### User Features
- `20250117_add_payment_statuses.sql` - Payment status tracking
- `20250118_create_order_status_history.sql` - Order status history system
- `20250118_update_orders_for_user_interface.sql` - Order interface updates
- `20251016_add_wishlist_savedlater_columns.sql` - Wishlist and saved items

### Category System (Hierarchical)
- `20250119_add_hierarchical_categories.sql` - **Base hierarchical categories support**
- `20250120_reorganize_categories_hierarchy.sql` - **Main category reorganization**
- `20250120_products_categories_foreign_key.sql` - **Products-categories foreign key relationship**

### Category Reorganization Scripts (Choose One)
- `20250120_safe_category_reorganization.sql` - **Recommended** - Transaction-based with backup
- `20250120_fixed_category_reorganization.sql` - Fixed version with proper error handling
- `20250120_simple_category_reorganization.sql` - Simple version for Supabase SQL Editor
- `20250120_ultra_simple_category_reorganization.sql` - Ultra simple step-by-step version

### Security & Performance Functions
- `20250123_drop_existing_functions.sql` - **FIRST** - Drops existing functions to prevent conflicts
- `20250123_create_upsert_cart_item_function.sql` - Cart item atomic upsert function
- `20250123_create_security_functions.sql` - IDOR protection and security monitoring
- `20250123_create_rbac_functions.sql` - Role-based access control functions
- `20250123_create_performance_functions.sql` - Database optimization functions
- `20250123_create_audit_functions.sql` - Audit logging and data integrity functions

## Category System Overview

### Main Categories (8):
1. **DIY Electronic Components** - Electronic parts and DIY supplies
2. **Home Electronic Devices** - Complete home electronics
3. **School Items** - Educational supplies and school electronics
4. **Clothes and Shoes** - Fashion and footwear
5. **Sport and Entertainment** - Sports equipment and gaming
6. **Computer Office** - Computers and office equipment
7. **Games** - Video games and gaming accessories
8. **Fashion and Jewelry** - Fashion accessories and jewelry

### Subcategories (40+):
Each main category has 4-5 subcategories for specific product types.

### Database Structure:
- **Categories Table**: Hierarchical structure with `parent_id` foreign key
- **Products Table**: `category_id` foreign key linking to categories
- **Performance**: Optimized indexes for fast hierarchical queries

## Running Migrations

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration files in order

### Option 2: Supabase CLI
```bash
cd supabase
npx supabase db reset
```

### Option 3: Manual Execution
Run the SQL files directly in your database management tool.

## Migration Order

1. **Core migrations** (001-007) - Basic functionality
2. **User features** (20250117-20251016) - User-specific features
3. **Category base** (20250119) - Hierarchical categories support
4. **Category reorganization** (20250120) - Main category structure
5. **Products relationship** (20250120) - Foreign key relationship
6. **Security & Performance** (20250123) - Drop existing functions, then create new security functions, RBAC, audit logging

## Notes

- All migrations are **idempotent** - safe to run multiple times
- **Backup recommended** before running major reorganizations
- **Test in development** before production deployment
- Some migrations include **data migration** - existing data will be preserved and reorganized

## Troubleshooting

If you encounter errors:
1. Check that previous migrations have been applied
2. Verify database permissions
3. Check for conflicting constraints
4. Review error messages for specific issues

## Support

For issues with migrations, check the individual SQL files for detailed comments and error handling.