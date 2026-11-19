#!/usr/bin/env node
/**
 * Fix invoice numbers to follow the proper sequence pattern: INV-{year}-{clientInitials}-HCIR-{4digitNumber}
 *
 * This script updates invoices that don't follow the new naming convention:
 * - INV-2026-79592 (THERESIA) -> INV-2026-T-HCIR-0001
 * - INV-2026-43621 (Emmanuel Kaiga) -> INV-2026-EK-HCIR-0001
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

function clientInitials(name: string): string {
  const skip = new Set(["of", "and", "the", "for", "a", "an"])
  const letters = String(name || "")
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word && !skip.has(word.toLowerCase()))
    .map((word) => word[0].toUpperCase())
  return letters.join("").slice(0, 4)
}

async function fixInvoiceNumbers() {
  console.log("Starting invoice number fix...")

  // Get all invoices that need fixing
  const { data: invoices, error: fetchError } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_name")
    .or(`invoice_number.eq.INV-2026-79592,invoice_number.eq.INV-2026-43621`)

  if (fetchError) {
    console.error("Error fetching invoices:", fetchError)
    process.exit(1)
  }

  if (!invoices || invoices.length === 0) {
    console.log("No invoices found that need fixing")
    return
  }

  console.log(`Found ${invoices.length} invoices to fix:`)
  invoices.forEach((inv) => console.log(`  - ${inv.invoice_number} (${inv.client_name})`))

  const updates: Array<{ id: string; oldNumber: string; newNumber: string }> = []

  // Fix each invoice
  for (const invoice of invoices) {
    const initials = clientInitials(invoice.client_name)
    const year = 2026
    const mark = initials ? `${initials}-HCIR` : "HCIR"

    // Get the next number for this client
    const { data: existing, error: countError } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `INV-${year}-${mark}-%`)
      .limit(400)

    if (countError) {
      console.error(`Error counting invoices for ${invoice.client_name}:`, countError)
      continue
    }

    const maxNum = (existing || []).reduce((max: number, row: any) => {
      const match = String(row?.invoice_number || "").trim().match(new RegExp(`^INV-${year}-${mark}-(\\d+)$`))
      const number = match ? Number(match[1]) : 0
      return Number.isFinite(number) ? Math.max(max, number) : max
    }, 0)

    const newNumber = `INV-${year}-${mark}-${String(maxNum + 1).padStart(4, "0")}`

    console.log(`\nUpdating invoice:`)
    console.log(`  Client: ${invoice.client_name}`)
    console.log(`  Initials: ${initials}`)
    console.log(`  Old number: ${invoice.invoice_number}`)
    console.log(`  New number: ${newNumber}`)

    updates.push({
      id: invoice.id,
      oldNumber: invoice.invoice_number,
      newNumber,
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
      console.error(`Error updating invoice ${invoice.invoice_number}:`, updateError)
    } else {
      console.log(`  ✓ Updated successfully`)
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("Summary of changes:")
  updates.forEach((u) => {
    console.log(`  ${u.oldNumber} → ${u.newNumber}`)
  })
  console.log("=".repeat(60))
}

fixInvoiceNumbers().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
