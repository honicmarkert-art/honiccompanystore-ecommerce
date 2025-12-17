/**
 * Script to update order status using reference ID
 * Usage: node scripts/update-order-status-by-ref.js <reference_id> <status>
 * Example: node scripts/update-order-status-by-ref.js a7a3f1f3a1d347a1a68bf90dcfe83f1c shipped
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const referenceId = process.argv[2]
const newStatus = process.argv[3]

if (!referenceId || !newStatus) {
  console.error('❌ Usage: node scripts/update-order-status-by-ref.js <reference_id> <status>')
  console.error('   Example: node scripts/update-order-status-by-ref.js a7a3f1f3a1d347a1a68bf90dcfe83f1c shipped')
  console.error('\n   Valid statuses: pending, confirmed, shipped, delivered, ready_for_pickup, picked_up, cancelled')
  process.exit(1)
}

const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'ready_for_pickup', 'picked_up', 'cancelled']
if (!validStatuses.includes(newStatus.toLowerCase())) {
  console.error(`❌ Invalid status: ${newStatus}`)
  console.error(`   Valid statuses: ${validStatuses.join(', ')}`)
  process.exit(1)
}

async function updateOrderStatus() {
  try {
    // Use Supabase REST API directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?reference_id=eq.${referenceId}&select=id,order_number,reference_id,status,payment_status`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to fetch order: ${response.status} ${error}`)
    }

    const orders = await response.json()
    
    if (!orders || orders.length === 0) {
      console.error(`❌ Order not found with reference_id: ${referenceId}`)
      process.exit(1)
    }

    const order = orders[0]
    console.log('📦 Found order:')
    console.log(`   Order Number: ${order.order_number}`)
    console.log(`   Reference ID: ${order.reference_id}`)
    console.log(`   Current Status: ${order.status}`)
    console.log(`   Payment Status: ${order.payment_status}`)

    // Update the order status
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: newStatus.toLowerCase(),
        updated_at: new Date().toISOString()
      })
    })

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      throw new Error(`Failed to update order: ${updateResponse.status} ${error}`)
    }

    const updatedOrders = await updateResponse.json()
    const updatedOrder = updatedOrders[0]

    console.log('\n✅ Order status updated successfully!')
    console.log(`   New Status: ${updatedOrder.status}`)
    console.log(`   Updated At: ${updatedOrder.updated_at}`)

    // Also update confirmed_orders if it exists
    const confirmedResponse = await fetch(`${SUPABASE_URL}/rest/v1/confirmed_orders?order_id=eq.${order.id}&select=id,status`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (confirmedResponse.ok) {
      const confirmedOrders = await confirmedResponse.json()
      if (confirmedOrders && confirmedOrders.length > 0) {
        const confirmedUpdateResponse = await fetch(`${SUPABASE_URL}/rest/v1/confirmed_orders?id=eq.${confirmedOrders[0].id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            status: newStatus.toLowerCase(),
            updated_at: new Date().toISOString()
          })
        })

        if (confirmedUpdateResponse.ok) {
          console.log('✅ Confirmed order status also updated')
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

updateOrderStatus()

