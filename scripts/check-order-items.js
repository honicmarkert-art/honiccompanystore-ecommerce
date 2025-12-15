/**
 * Script to check order_items for a specific order
 * Usage: node scripts/check-order-items.js <reference_id>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const referenceId = process.argv[2] || '6e53dd9792ee437c93023295f2befbf3';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkOrderItems() {
  try {
    console.log(`🔍 Checking order items for reference: ${referenceId}\n`);
    
    // Find the order
    const normalizedRef = referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, reference_id')
      .eq('reference_id', normalizedRef)
      .single();
    
    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      return;
    }
    
    console.log('✅ Order found:');
    console.log(`   ID: ${order.id}`);
    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Reference ID: ${order.reference_id}\n`);
    
    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    
    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }
    
    if (!orderItems || orderItems.length === 0) {
      console.log('⚠️  No order items found');
      return;
    }
    
    console.log(`📦 Found ${orderItems.length} order item(s):\n`);
    
    orderItems.forEach((item, index) => {
      console.log(`Item ${index + 1}:`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Product ID: ${item.product_id}`);
      console.log(`   Quantity: ${item.quantity}`);
      console.log(`   Variant ID: ${item.variant_id || 'null'}`);
      console.log(`   Variant Name: ${item.variant_name || 'null'}`);
      console.log(`   Variant Attributes:`, JSON.stringify(item.variant_attributes, null, 2));
      console.log(`   Variant Attributes Type: ${typeof item.variant_attributes}`);
      console.log(`   Variant Attributes Keys: ${item.variant_attributes && typeof item.variant_attributes === 'object' ? Object.keys(item.variant_attributes).join(', ') : 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOrderItems();









