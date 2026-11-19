#!/usr/bin/env node
/**
 * Fix invoice numbers to follow global sequential pattern: INV-{year}-{globalNumber}
 *
 * This script reorganizes all invoices to use a continuous global counter per year,
 * independent of client names.
 *
 * Example:
 * - Invoice 1 (Emanuel Kaiga) -> INV-2026-0001
 * - Invoice 2 (Hosea) -> INV-2026-0002
 * - Invoice 3 (Juma) -> INV-2026-0003
 *
 * Usage: npx ts-node scripts/fix-invoice-numbers.ts
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  created_at: string
}

async function fixInvoiceNumbers() {
  console.log("Starting global sequential invoice number fix...")
  console.log("")

  const year = 2026

  // Get all invoices for this year, sorted by creation date
  const { data: invoices, error: fetchError } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_name, created_at")
    .like("invoice_number", `INV-${year}-%`)
    .order("created_at", { ascending: true })
    .limit(500)

  if (fetchError) {
    console.error("Error fetching invoices:", fetchError)
    process.exit(1)
  }

  if (!invoices || invoices.length === 0) {
    console.log("No invoices found for this year")
    return
  }

  console.log(`Found ${invoices.length} invoices to reorganize:`)
  console.log("")

  const updates: Array<{ id: string; oldNumber: string; newNumber: string; clientName: string; createdAt: string }> = []

  // Assign new global sequential numbers based on creation date
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i] as Invoice
    const newNumber = `INV-${year}-${String(i + 1).padStart(4, "0")}`

    console.log(`${i + 1}. ${invoice.client_name}`)
    console.log(`   Old: ${invoice.invoice_number}`)
    console.log(`   New: ${newNumber}`)
    console.log(`   Created: ${invoice.created_at}`)
    console.log("")

    updates.push({
      id: invoice.id,
      oldNumber: invoice.invoice_number,
      newNumber,
      clientName: invoice.client_name,
      createdAt: invoice.created_at,
    })

    // Update the invoice
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        invoice_number: newNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)

    if (updateError) {
      console.error(`❌ Error updating invoice ${invoice.invoice_number}:`, updateError)
    } else {
      console.log(`   ✓ Updated successfully`)
    }
  }

  console.log("\n" + "=".repeat(70))
  console.log("SUMMARY OF CHANGES:")
  console.log("=".repeat(70))
  updates.forEach((u, idx) => {
    console.log(`${idx + 1}. ${u.clientName.padEnd(30)} | ${u.oldNumber.padEnd(25)} → ${u.newNumber}`)
  })
  console.log("=".repeat(70))
  console.log(`\n✓ Successfully reorganized ${updates.length} invoices to global sequential numbering`)
}

fixInvoiceNumbers().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
