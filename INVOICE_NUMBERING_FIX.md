# Invoice Numbering System - Global Sequential

## Overview

The invoicing system now uses **global sequential numbering** where each invoice gets a unique number **independent of the client name**. The counter increments continuously for each new invoice added.

## Format

```
INV-{year}-{4digitNumber}
```

Where:
- `{year}` = Year of invoice (e.g., 2026)
- `{4digitNumber}` = Continuous counter across all clients

## Examples

| Order | Client | Invoice Number |
|--|--|--|
| 1st | Emanuel Kaiga | INV-2026-0001 |
| 2nd | Hosea | INV-2026-0002 |
| 3rd | Juma | INV-2026-0003 |
| 4th | Emanuel Kaiga | INV-2026-0004 |
| 5th | Bryan | INV-2026-0005 |

## Previous Format (Deprecated)

The old system used client initials:
```
INV-{year}-{clientInitials}-HCIR-{4digitNumber}  ❌ OLD
```

Examples:
- `INV-2026-EK-HCIR-0001` (Emanuel Kaiga)
- `INV-2026-H-HCIR-0001` (Hosea)
- `INV-2026-J-HCIR-0001` (Juma)

**This format is no longer used.**

## How It Works

### Auto-Increment on New Invoice

When you create a new invoice:
1. System finds the highest invoice number for the year
2. Adds 1 to it
3. Pads to 4 digits
4. Generates the new invoice number

**Example flow:**
- Create invoice 1 → `INV-2026-0001` ✓
- Create invoice 2 → `INV-2026-0002` ✓
- Create invoice 3 → `INV-2026-0003` ✓

## Applying the Fix

### Option 1: Automated Script (Recommended)

This script will reorganize all existing invoices to use global sequential numbering:

```bash
cd honicstore-admin

# Set environment variables if not already set
export NEXT_PUBLIC_SUPABASE_URL="<your-supabase-url>"
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Run the fix
npx ts-node ../scripts/fix-invoice-numbers.ts
```

**What the script does:**
1. Fetches all invoices for the current year
2. Sorts them by creation date (oldest first)
3. Reassigns sequential numbers: 0001, 0002, 0003, ...
4. Updates the database
5. Displays a summary of all changes

**Output example:**
```
Found 6 invoices to reorganize:

1. Emanuel Kaiga
   Old: INV-2026-EK-HCIR-0001
   New: INV-2026-0001
   ✓ Updated successfully

2. Hosea
   Old: INV-2026-H-HCIR-0001
   New: INV-2026-0002
   ✓ Updated successfully
...
```

### Option 2: Manual Database Update

If you prefer SQL, update each invoice manually in Supabase:

```sql
-- Set new sequential numbers based on creation order
UPDATE invoices
SET invoice_number = 'INV-2026-0001'
WHERE id = '<invoice-id-1>' AND created_at <= '<creation-date-1>';

UPDATE invoices
SET invoice_number = 'INV-2026-0002'
WHERE id = '<invoice-id-2>' AND created_at <= '<creation-date-2>';

-- And so on...
```

## Code Changes

### Modified Files

1. **[invoice-sequence.ts](honicstore-admin/lib/invoice-sequence.ts)**
   - Updated `invoiceNumberSeries()` function
   - Removed client initials from invoice number pattern
   - Now uses simple global counter: `INV-{year}-####`

### Key Function

```typescript
export function invoiceNumberSeries(documentKind: string | undefined, year: number, clientName = ""): {
  if (documentKind === "invoice") {
    // Global sequential numbering - independent of client name
    const prefix = `INV-${year}-`
    return {
      pattern: new RegExp(`^INV-${year}-(\\d+)$`),
      prefix,
      format: (value) => `${prefix}${value}`
    }
  }
  // ... other document types ...
}
```

## Notes

- **Client names do NOT affect the invoice number** - only the order of creation
- **Invoices are assigned numbers by creation date** - oldest first
- **Different document types** (quotes, delivery notes, reports) keep their own prefixes:
  - Quotes: `QT-{year}-####`
  - Delivery Notes: `DN-{year}-####`
  - Technical Reports: `TR-{year}-####`
- **Only invoices use the new global sequential system**

## Verification

After applying the fix, verify:

1. ✓ All invoices follow format: `INV-YYYY-####`
2. ✓ Numbers are sequential: 0001, 0002, 0003, ...
3. ✓ No client names affect the numbering
4. ✓ Next new invoice gets the correct next number

## Support

For questions about the invoice numbering system, refer to:
- [invoice-sequence.ts](honicstore-admin/lib/invoice-sequence.ts) - Core logic
- [invoices route.ts](honicstore-admin/app/api/admin/invoices/route.ts) - API endpoint
