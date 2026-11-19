# Invoice Numbering Fix

## Problem

The invoicing system was updated to use a standardized invoice numbering format, but some legacy invoices still used the old format:

- **INV-2026-79592** (THERESIA)
- **INV-2026-43621** (Emmanuel Kaiga)

## Expected Format

All invoices should follow this pattern:
```
INV-{year}-{clientInitials}-HCIR-{4digitNumber}
```

Where:
- `{year}` = Current year (e.g., 2026)
- `{clientInitials}` = First letter of each significant word in client name (up to 4 letters)
  - Skip articles: "of", "and", "the", "for", "a", "an"
  - Examples:
    - "Swahili DMakers (Pyrameter)" → "SDP"
    - "Swahili D Makers (Robotic Arm)" → "SDMR"
    - "Bryan" → "B"
    - "THERESIA" → "T"
    - "Emmanuel Kaiga" → "EK"
- `{4digitNumber}` = Incrementing counter per client (0001, 0002, etc.)

## Current State

| Old Invoice | Client | Should Be |
|--|--|--|
| INV-2026-79592 | THERESIA | INV-2026-T-HCIR-0001 |
| INV-2026-43621 | Emmanuel Kaiga | INV-2026-EK-HCIR-0001 |

## How to Apply the Fix

### Option 1: Automated Script (Recommended)

Run the fix script:
```bash
cd honicstore-admin

# Set environment variables if not already set
export NEXT_PUBLIC_SUPABASE_URL="<your-supabase-url>"
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Run the fix
npx ts-node ../scripts/fix-invoice-numbers.ts
```

The script will:
1. Find all invoices with the old format
2. Calculate the correct new invoice number based on client name
3. Update the invoice numbers in the database
4. Display a summary of all changes

### Option 2: Manual Database Update

If you prefer to update manually using Supabase:

```sql
-- Update THERESIA invoice
UPDATE invoices
SET invoice_number = 'INV-2026-T-HCIR-0001'
WHERE invoice_number = 'INV-2026-79592';

-- Update Emmanuel Kaiga invoice
UPDATE invoices
SET invoice_number = 'INV-2026-EK-HCIR-0001'
WHERE invoice_number = 'INV-2026-43621';
```

## Code References

The invoice numbering logic is implemented in:
- **[invoice-sequence.ts](honicstore-admin/lib/invoice-sequence.ts)** - Core numbering logic
- **[route.ts](honicstore-admin/app/api/admin/invoices/route.ts)** - API endpoint that generates invoice numbers

Key functions:
- `clientInitials()` - Extracts initials from client name
- `invoiceNumberSeries()` - Generates the numbering pattern
- `generateNextInvoiceNumber()` - Creates the next invoice number for a client

## Verification

After applying the fix:

1. Check the invoices list in the admin dashboard
2. Verify that all invoices now follow the `INV-YYYY-INITIALS-HCIR-####` pattern
3. Confirm that the numbers are sequential per client
4. For reports/payments, ensure the `payload.referenceNumber` field is also updated if needed

## Related Changes

This fix is related to the system update referenced in commit:
> "Point the admin submodule at invoice numbers that follow a renamed client."

The reference number system also supports project categories (FYP, Side, Research) with their own numbering sequences.
