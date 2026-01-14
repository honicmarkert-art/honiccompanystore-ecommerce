/**
 * Script to simulate ClickPesa webhook for testing payment status updates
 * Usage: node scripts/simulate-clickpesa-webhook.js <reference_id>
 * 
 * This simulates a ClickPesa "PAYMENT RECEIVED" webhook to update an order to paid status
 * It will:
 * 1. Fetch the order from database to get the actual amount
 * 2. Simulate the webhook call
 * 3. Stock will be decremented automatically via webhook handler
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Get reference ID from command line argument
const referenceId = process.argv[2] || '90987db839924fa98840f39994608e9c';

if (!referenceId) {
  console.error('❌ Error: Please provide a reference ID');
  console.log('Usage: node scripts/simulate-clickpesa-webhook.js <reference_id>');
  process.exit(1);
}

// Get environment variables
// Allow override with LOCAL_DEV=true to test against localhost
const USE_LOCAL = process.env.LOCAL_DEV === 'true' || process.argv.includes('--local');
const LOCALHOST_PORT = process.env.LOCALHOST_PORT || '3000'
const SITE_URL = USE_LOCAL 
  ? `http://localhost:${LOCALHOST_PORT}`
  : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || `http://localhost:${LOCALHOST_PORT}`);
const CLICKPESA_CHECKSUM_KEY = process.env.CLICKPESA_CHECKSUM_KEY || '';

if (USE_LOCAL) {
  console.log(`🏠 Using LOCAL development server (localhost:${LOCALHOST_PORT})`);
} else {
  console.log(`🌐 Using server: ${SITE_URL}`);
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch order details first
async function fetchOrderDetails() {
  try {
    // Normalize reference ID (remove hyphens, lowercase)
    const normalizedReference = referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    
    console.log('🔍 Fetching order details...');
    console.log('📦 Reference ID:', referenceId);
    console.log('🔤 Normalized:', normalizedReference);
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('reference_id', normalizedReference)
      .single();
    
    if (error || !order) {
      // Try with original reference ID
      const { data: order2, error: error2 } = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', referenceId)
        .single();
      
      if (error2 || !order2) {
        console.error('❌ Order not found with reference ID:', referenceId);
        console.error('Error:', error?.message || error2?.message);
        return null;
      }
      
      return order2;
    }
    
    return order;
  } catch (error) {
    console.error('❌ Error fetching order:', error.message);
    return null;
  }
}

// Create webhook payload matching ClickPesa format
async function createWebhookPayload(order) {
  const amount = order ? parseFloat(order.total_amount || 0).toFixed(2) : '100000.00';
  
  return {
    event: 'PAYMENT RECEIVED',
    data: {
      orderReference: referenceId,
      paymentId: `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      collectedAmount: amount,
      collectedCurrency: 'TZS',
      customer: {
        fullName: order?.shipping_address?.fullName || 'Test Customer',
        email: order?.shipping_address?.email || 'test@example.com',
        phone: order?.shipping_address?.phone || '+255123456789'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

// Generate signature if checksum key is available
// Must match the webhook handler's verification logic exactly
function generateSignature(webhookPayload) {
  if (!CLICKPESA_CHECKSUM_KEY) {
    return null;
  }
  
  // ClickPesa signature format matches webhook handler:
  // 1. Sort keys alphabetically
  // 2. Concatenate values only (join all values directly)
  // 3. Generate HMAC-SHA256 hash
  
  // Sort keys alphabetically
  const sortedPayload = Object.keys(webhookPayload)
    .sort()
    .reduce((obj, key) => {
      obj[key] = webhookPayload[key];
      return obj;
    }, {});
  
  // Concatenate values only (join all values directly)
  // Values are converted to strings, nested objects become JSON strings
  const payloadString = Object.values(sortedPayload).map(value => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }).join('');
  
  // Generate HMAC-SHA256 hash
  const signature = crypto
    .createHmac('sha256', CLICKPESA_CHECKSUM_KEY)
    .update(payloadString)
    .digest('hex');
  
  return signature;
}

// Make the webhook request
async function simulateWebhook(webhookPayload) {
  try {
    const body = JSON.stringify(webhookPayload);
    const signature = generateSignature(webhookPayload);
    
    console.log('\n🚀 Simulating ClickPesa webhook...');
    console.log('📦 Reference ID:', referenceId);
    console.log('🌐 Target URL:', `${SITE_URL}/api/webhooks/clickpesa`);
    console.log('📝 Payload:', JSON.stringify(webhookPayload, null, 2));
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Skip signature for testing - webhook handler accepts without signature
    // if checksum key is not configured or if signature is missing
    // Uncomment below to test with signature validation
    /*
    if (signature && CLICKPESA_CHECKSUM_KEY) {
      headers['x-clickpesa-signature'] = signature;
      console.log('🔐 Signature:', signature.substring(0, 20) + '...');
    } else {
      console.log('⚠️  No CLICKPESA_CHECKSUM_KEY found - sending without signature');
    }
    */
    console.log('⚠️  Sending without signature for testing');
    console.log('   (Webhook handler will accept this)');
    
    // Use built-in fetch (Node 18+) or require node-fetch
    let fetchFunction;
    try {
      // Try to use built-in fetch (Node 18+)
      if (typeof globalThis.fetch === 'function') {
        fetchFunction = globalThis.fetch;
      } else {
        // Fallback to node-fetch
        const nodeFetch = require('node-fetch');
        fetchFunction = nodeFetch.default || nodeFetch;
      }
    } catch (error) {
      console.error('❌ Error loading fetch:', error.message);
      console.log('💡 Tip: Use Node.js 18+ or install node-fetch: npm install node-fetch');
      return false;
    }
    
    const response = await fetchFunction(`${SITE_URL}/api/webhooks/clickpesa`, {
      method: 'POST',
      headers: headers,
      body: body
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log('\n✅ Webhook simulation successful!');
      console.log('📊 Response:', JSON.stringify(responseData, null, 2));
      return true;
    } else {
      console.error('\n❌ Webhook simulation failed!');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(responseData, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Error simulating webhook:', error.message);
    console.error(error);
    return false;
  }
}

// Main execution
async function main() {
  try {
    // Step 1: Fetch order details
    const order = await fetchOrderDetails();
    
    if (!order) {
      console.error('\n❌ Cannot proceed - order not found');
      process.exit(1);
    }
    
    console.log('\n✅ Order found:');
    console.log('   Order ID:', order.id);
    console.log('   Order Number:', order.order_number);
    console.log('   Total Amount:', order.total_amount);
    console.log('   Current Payment Status:', order.payment_status);
    
    if (order.payment_status === 'paid' || order.payment_status === 'success') {
      console.log('\n⚠️  Warning: Order is already marked as paid!');
      console.log('   This will still trigger stock decrement if not already done.');
      console.log('   Continue? (This is safe - webhook handler checks for duplicate processing)');
    }
    
    // Step 2: Create webhook payload
    const webhookPayload = await createWebhookPayload(order);
    
    // Step 3: Simulate webhook
    const success = await simulateWebhook(webhookPayload);
    
    if (success) {
      console.log('\n✅ Order payment status should now be updated to "paid"');
      console.log('📦 Stock quantities should have been decremented');
      console.log('🛒 Cart should have been cleared (if user was authenticated)');
    } else {
      console.log('\n❌ Webhook simulation failed - check the error messages above');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the simulation
main();

