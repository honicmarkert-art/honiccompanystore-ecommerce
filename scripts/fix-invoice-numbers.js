#!/usr/bin/env node
/**
 * Fix invoice numbers to follow the pattern: INV-{year}-{clientInitials}-HCIR-{globalCounter}
 * JavaScript version for direct execution
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function clientInitials(name) {
  const skip = new Set(["of", "and", "the", "for", "a", "an"]);
  const letters = String(name || "")
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word && !skip.has(word.toLowerCase()))
    .map((word) => word[0].toUpperCase());
  return letters.join("").slice(0, 4);
}

async function fixInvoiceNumbers() {
  console.log("Starting invoice number fix with global counter...");
  console.log("");

  const year = 2026;

  // Get all invoices for this year, sorted by creation date
  const { data: invoices, error: fetchError } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_name, created_at")
    .like("invoice_number", `INV-${year}-%`)
    .order("created_at", { ascending: true })
    .limit(500);

  if (fetchError) {
    console.error("Error fetching invoices:", fetchError);
    process.exit(1);
  }

  if (!invoices || invoices.length === 0) {
    console.log("No invoices found for this year");
    return;
  }

  console.log(`Found ${invoices.length} invoices to reorganize:`);
  console.log("");

  const updates = [];

  // Assign new numbers with global counter but keep client initials
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    const initials = clientInitials(invoice.client_name);
    const mark = initials ? `${initials}-HCIR` : "HCIR";
    const newNumber = `INV-${year}-${mark}-${String(i + 1).padStart(4, "0")}`;

    console.log(`${i + 1}. ${invoice.client_name} (${initials})`);
    console.log(`   Old: ${invoice.invoice_number}`);
    console.log(`   New: ${newNumber}`);
    console.log(`   Created: ${invoice.created_at}`);
    console.log("");

    updates.push({
      id: invoice.id,
      oldNumber: invoice.invoice_number,
      newNumber,
      clientName: invoice.client_name,
      initials,
      createdAt: invoice.created_at,
    });

    // Update the invoice
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        invoice_number: newNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (updateError) {
      console.error(`❌ Error updating invoice ${invoice.invoice_number}:`, updateError);
    } else {
      console.log(`   ✓ Updated successfully`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY OF CHANGES:");
  console.log("=".repeat(80));
  updates.forEach((u, idx) => {
    console.log(
      `${String(idx + 1).padStart(2, " ")}. ${u.clientName.padEnd(25)} (${u.initials.padEnd(4)}) | ${u.oldNumber.padEnd(30)} → ${u.newNumber}`
    );
  });
  console.log("=".repeat(80));
  console.log(`\n✓ Successfully reorganized ${updates.length} invoices with global counter`);
  console.log("Note: Counter is GLOBAL across all clients, but client initials are preserved");
}

fixInvoiceNumbers().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
