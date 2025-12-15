/**
 * Script to check current stock levels for a product
 * Usage: node scripts/check-stock.js <product_id>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const productId = process.argv[2] || '183';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkStock() {
  try {
    console.log(`🔍 Checking stock for product ${productId}...\n`);
    
    // Get product stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock_quantity, in_stock')
      .eq('id', productId)
      .single();
    
    if (productError || !product) {
      console.error('❌ Product not found:', productError);
      return;
    }
    
    console.log('📦 Product Stock:');
    console.log(`   ID: ${product.id}`);
    console.log(`   Name: ${product.name || 'N/A'}`);
    console.log(`   Stock Quantity: ${product.stock_quantity}`);
    console.log(`   In Stock: ${product.in_stock}\n`);
    
    // Get variants
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, product_id, primary_values')
      .eq('product_id', productId);
    
    if (variantsError) {
      console.error('❌ Error fetching variants:', variantsError);
      return;
    }
    
    if (!variants || variants.length === 0) {
      console.log('⚠️  No variants found for this product');
      return;
    }
    
    console.log(`📋 Found ${variants.length} variant(s):\n`);
    
    let totalFromVariants = 0;
    
    variants.forEach((variant, index) => {
      console.log(`Variant ${index + 1} (ID: ${variant.id}):`);
      
      let primaryValues = variant.primary_values;
      if (typeof primaryValues === 'string') {
        try {
          primaryValues = JSON.parse(primaryValues);
        } catch (e) {
          console.log(`   ❌ Error parsing primary_values:`, e.message);
          return;
        }
      }
      
      if (!primaryValues || !Array.isArray(primaryValues)) {
        console.log(`   ⚠️  Invalid primary_values format`);
        return;
      }
      
      console.log(`   Primary Values:`);
      primaryValues.forEach((pv) => {
        const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0;
        totalFromVariants += qty;
        console.log(`     - ${pv.attribute}="${pv.value}": ${qty}`);
      });
      console.log('');
    });
    
    console.log(`📊 Summary:`);
    console.log(`   Product stock_quantity: ${product.stock_quantity}`);
    console.log(`   Total from variants: ${totalFromVariants}`);
    console.log(`   Match: ${product.stock_quantity === totalFromVariants ? '✅' : '❌ MISMATCH!'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStock();









