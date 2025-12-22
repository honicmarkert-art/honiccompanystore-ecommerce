# User and Supplier ID Generation

This migration adds human-readable IDs for users and suppliers:
- **User IDs**: Format `HCS-N{number}` (e.g., `HCS-N000001`, `HCS-N000002`)
- **Supplier IDs**: Format `HCS-SL{number}` (e.g., `HCS-SL000001`, `HCS-SL000002`)

## Migration Files

1. **20250223_add_user_and_supplier_ids.sql**
   - Adds `user_id` and `supplier_id` columns to `profiles` table
   - Creates functions to generate sequential IDs
   - Updates the `handle_new_user` trigger to auto-generate IDs during registration

2. **20250223_backfill_user_and_supplier_ids.sql**
   - Generates IDs for all existing users/suppliers that don't have them
   - Processes users in chronological order (oldest first)

## How to Apply

### Step 1: Apply the main migration
Run `20250223_add_user_and_supplier_ids.sql` in your Supabase SQL Editor or via CLI:
```bash
supabase db push
```

### Step 2: Backfill existing users
Run `20250223_backfill_user_and_supplier_ids.sql` to generate IDs for existing users:
```bash
supabase db push
```

Or run directly in Supabase SQL Editor.

## How It Works

### Automatic Generation
- When a new user registers, the `handle_new_user` trigger automatically generates:
  - `user_id` (HCS-N{number}) for normal users
  - `supplier_id` (HCS-SL{number}) for suppliers
- IDs are generated sequentially and are unique

### ID Format
- **User IDs**: `HCS-N` + 6-digit zero-padded number (e.g., `HCS-N000001`)
- **Supplier IDs**: `HCS-SL` + 6-digit zero-padded number (e.g., `HCS-SL000001`)
- Supports up to 999,999 users and 999,999 suppliers

### Database Functions
- `generate_next_user_id()`: Returns the next available user ID
- `generate_next_supplier_id()`: Returns the next available supplier ID

## Usage in Code

The IDs are automatically generated and stored in the `profiles` table. You can query them like:

```sql
SELECT user_id, supplier_id, email, full_name 
FROM profiles 
WHERE user_id = 'HCS-N000001';
```

Or in your application code:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('user_id, supplier_id, email')
  .eq('id', userId)
  .single()
```

## Notes

- IDs are generated server-side only (in the database trigger)
- IDs cannot be modified by clients (enforced by RLS policies)
- The registration API includes a safety check to ensure IDs are generated even if the trigger fails
- Existing users will get IDs assigned when you run the backfill script

