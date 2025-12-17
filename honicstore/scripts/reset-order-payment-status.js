/**
 * Script to reset an order's payment status to 'pending' for testing
 * Usage: node scripts/reset-order-payment-status.js <reference_id>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const referenceId = process.argv[2];

if (!referenceId) {
  console.error('❌ Error: Please provide a reference ID');
  console.log('Usage: node scripts/reset-order-payment-status.js <reference_id>');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetOrderStatus() {
  try {
    console.log(`🔍 Resetting payment status for order: ${referenceId}\n`);
    
    const normalizedRef = referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    
    // Find the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, reference_id, payment_status')
      .eq('reference_id', normalizedRef)
      .single();
    
    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      return;
    }
    
    console.log('✅ Order found:');
    console.log(`   ID: ${order.id}`);
    console.log(`   Current Payment Status: ${order.payment_status}\n`);
    
    if (order.payment_status === 'pending') {
      console.log('ℹ️  Order is already pending, no change needed');
      return;
    }
    
    // Reset to pending
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);
    
    if (updateError) {
      console.error('❌ Error resetting order status:', updateError);
      return;
    }
    
    console.log('✅ Order payment status reset to "pending"');
    console.log('   You can now test the webhook again\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetOrderStatus();









