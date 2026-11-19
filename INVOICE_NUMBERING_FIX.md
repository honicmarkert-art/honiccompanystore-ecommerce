# Invoice Numbering System - Global Counter with Client Initials

## Overview

The invoicing system uses a **hybrid approach**:
- Includes **client initials** for identification
- Uses a **global independent counter** across all clients
- Counter increments continuously regardless of which client the invoice is for

## Format

```
INV-{year}-{clientInitials}-HCIR-{globalCounter}
```

Where:
- `{year}` = Year of invoice (e.g., 2026)
- `{clientInitials}` = First letter of each significant word in client name (up to 4 letters)
  - Skip articles: "of", "and", "the", "for", "a", "an"
  - Examples: "Emanuel Kaiga" → "EK", "Hosea" → "H", "Juma" → "J"
- `{globalCounter}` = Continuous counter across all clients, independent of their names

## Examples

| Order | Client | Invoice Number | Counter |
|--|--|--|--|
| 1st | Emanuel Kaiga | INV-2026-EK-HCIR-0001 | 0001 |
| 2nd | Hosea | INV-2026-H-HCIR-0002 | 0002 |
| 3rd | Juma | INV-2026-J-HCIR-0003 | 0003 |
| 4th | Emanuel Kaiga | INV-2026-EK-HCIR-0004 | 0004 ← Not 0002! |
| 5th | Bryan | INV-2026-B-HCIR-0005 | 0005 |

**Key Point:** Even though Emanuel has 2 invoices, the second one is **0004**, not **0002**, because the counter is independent and continues across all clients.

## How It Works

### Auto-Increment on New Invoice

When you create a new invoice:
1. System finds ALL invoices for the year
2. Finds the highest counter number (across all clients)
3. Adds 1 to it
4. Uses the new client's initials with the new counter
5. Generates the invoice number

**Example flow:**
- Create invoice for Emanuel → `INV-2026-EK-HCIR-0001` ✓
- Create invoice for Hosea → `INV-2026-H-HCIR-0002` ✓ (not 0001!)
- Create invoice for Juma → `INV-2026-J-HCIR-0003` ✓ (not 0001!)
- Create invoice for Emanuel again → `INV-2026-EK-HCIR-0004` ✓ (not 0002!)

### Why This Works Better

- **Client identification**: Initials tell you who the invoice is for at a glance
- **Global sequence**: Numbers still represent chronological order across all invoices
- **No duplication**: Each invoice has a unique number

## Applying the Fix

### Option 1: Automated Script (Recommended)

This script will reorganize all existing invoices to use the global counter:

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
3. Reassigns sequential numbers with client initials: 0001, 0002, 0003, ...
4. Updates the database
5. Displays a summary of all changes

**Output example:**
```
Found 6 invoices to reorganize:

1. Emanuel Kaiga (EK)
   Old: INV-2026-EK-HCIR-0001
   New: INV-2026-EK-HCIR-0001
   ✓ Updated successfully

2. Hosea (H)
   Old: INV-2026-H-HCIR-0001
   New: INV-2026-H-HCIR-0002
   ✓ Updated successfully

3. Juma (J)
   Old: INV-2026-J-HCIR-0001
   New: INV-2026-J-HCIR-0003
   ✓ Updated successfully
...
```

### Option 2: Manual Database Update

Update invoices in order of creation:

```sql
-- First invoice
UPDATE invoices SET invoice_number = 'INV-2026-EK-HCIR-0001' WHERE id = '<id-1>';

-- Second invoice
UPDATE invoices SET invoice_number = 'INV-2026-H-HCIR-0002' WHERE id = '<id-2>';

-- Third invoice
UPDATE invoices SET invoice_number = 'INV-2026-J-HCIR-0003' WHERE id = '<id-3>';

-- And so on...
```

## Code Changes

### Modified Files

1. **[invoice-sequence.ts](honicstore-admin/lib/invoice-sequence.ts)**
   - Updated `invoiceNumberSeries()` function
   - Changed pattern to match ALL invoices globally: `^INV-${year}-.*-HCIR-(\\d+)$`
   - Finds maximum counter across all clients
   - Keeps client initials in the final number

### Key Function Logic

```typescript
export function invoiceNumberSeries(documentKind: string | undefined, year: number, clientName = "") {
  const initials = clientInitials(clientName)
  const mark = initials ? `${initials}-HCIR` : "HCIR"
  const prefix = `INV-${year}-${mark}-`
  
  return {
    // This pattern matches ALL invoices for the year (global search)
    pattern: new RegExp(`^INV-${year}-.*-HCIR-(\\d+)$`),
    prefix,
    format: (value) => `${prefix}${value}`
  }
}
```

**How it works:**
1. Pattern `^INV-${year}-.*-HCIR-(\\d+)$` matches all invoices for the year
2. Extracts the counter number from each
3. Finds the maximum
4. Increments it
5. Uses the specific client's initials with the new counter

## Comparison

### Old System (Per-Client)
```
Client A: 0001, 0002, 0003
Client B: 0001, 0002
Client C: 0001
```
Problem: Same number could exist for different clients

### New System (Global Counter)
```
Client A (invoice 1): 0001
Client B (invoice 2): 0002
Client C (invoice 3): 0003
Client A (invoice 4): 0004 ← Continues global sequence
Client B (invoice 5): 0005
```
Benefit: Unique numbers, chronological order, client identification

## Verification

After applying the fix, verify:

1. ✓ All invoices follow format: `INV-YYYY-INITIALS-HCIR-####`
2. ✓ Numbers are sequential globally: 0001, 0002, 0003, ...
3. ✓ Older invoices have lower numbers than newer ones
4. ✓ Client initials correspond to client names
5. ✓ Next new invoice gets the correct next number

## Notes

- **Document types** keep their own prefixes:
  - Quotes: `QT-{year}-####`
  - Delivery Notes: `DN-{year}-####`
  - Technical Reports: `TR-{year}-####`
- **Only invoices** use the INV-INITIALS-HCIR format with global counter
- **Year changes** reset the counter (2026 ends at some number, 2027 starts at 0001)

## Support

For questions about the invoice numbering system, refer to:
- [invoice-sequence.ts](honicstore-admin/lib/invoice-sequence.ts) - Core logic
- [invoices route.ts](honicstore-admin/app/api/admin/invoices/route.ts) - API endpoint
