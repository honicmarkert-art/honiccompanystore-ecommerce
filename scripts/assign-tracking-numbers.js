/**
 * Script to manually assign tracking numbers to order items
 * Usage: node scripts/assign-tracking-numbers.js <order_id_or_reference_id>
 * 
 * This will auto-generate and assign tracking numbers for all suppliers in an order
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const identifier = process.argv[2]

if (!identifier) {
  console.error('❌ Usage: node scripts/assign-tracking-numbers.js <order_id_or_reference_id>')
  console.error('   Example: node scripts/assign-tracking-numbers.js a7a3f1f3a1d347a1a68bf90dcfe83f1c')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Generate tracking number
function generateTrackingNumber() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomStr = ''
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return `TRK-${dateStr}-${randomStr}`
}

async function assignTrackingNumbers() {
  try {
    // First, try to find order by reference_id
    let { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, reference_id')
      .eq('reference_id', identifier)
      .single()

    // If not found by reference_id, try by order_id
    if (orderError || !order) {
      const { data: orderById, error: orderByIdError } = await supabase
        .from('orders')
        .select('id, order_number, reference_id')
        .eq('id', identifier)
        .single()

      if (orderByIdError || !orderById) {
        console.error('❌ Order not found with identifier:', identifier)
        process.exit(1)
      }
      order = orderById
    }

    console.log('📦 Found order:')
    console.log(`   Order ID: ${order.id}`)
    console.log(`   Order Number: ${order.order_number}`)
    console.log(`   Reference ID: ${order.reference_id}`)
    console.log('')

    // Get all order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, tracking_number')
      .eq('order_id', order.id)

    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError)
      process.exit(1)
    }

    if (!orderItems || orderItems.length === 0) {
      console.log('ℹ️ No order items found for this order')
      process.exit(0)
    }

    console.log(`📦 Found ${orderItems.length} order items`)
    console.log('')

    // Get product IDs
    const productIds = orderItems.map(item => item.product_id).filter(Boolean)
    
    // Get products with supplier information
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, supplier_id, user_id')
      .in('id', productIds)

    if (productsError) {
      console.error('❌ Error fetching products:', productsError)
      process.exit(1)
    }

    // Group order items by supplier
    const supplierItemsMap = new Map()

    orderItems.forEach(item => {
      const product = products?.find(p => p.id === item.product_id)
      if (!product) {
        const noSupplierKey = 'no-supplier'
        if (!supplierItemsMap.has(noSupplierKey)) {
          supplierItemsMap.set(noSupplierKey, [])
        }
        supplierItemsMap.get(noSupplierKey).push(item)
        return
      }

      const supplierId = product.supplier_id || product.user_id
      if (!supplierId) {
        const noSupplierKey = 'no-supplier'
        if (!supplierItemsMap.has(noSupplierKey)) {
          supplierItemsMap.set(noSupplierKey, [])
        }
        supplierItemsMap.get(noSupplierKey).push(item)
        return
      }

      if (!supplierItemsMap.has(supplierId)) {
        supplierItemsMap.set(supplierId, [])
      }
      supplierItemsMap.get(supplierId).push(item)
    })

    console.log(`📦 Grouped into ${supplierItemsMap.size} supplier(s)`)
    console.log('')

    // Generate and assign tracking number for each supplier
    let totalAssigned = 0
    for (const [supplierId, items] of supplierItemsMap.entries()) {
      const itemIds = items.map(item => item.id)
      const supplierLabel = supplierId === 'no-supplier' ? 'Honic Company' : supplierId

      // Check if tracking number already exists
      const hasTracking = items.some(item => item.tracking_number)
      if (hasTracking) {
        console.log(`ℹ️  ${supplierLabel}: Already has tracking number, skipping`)
        continue
      }

      // Generate new tracking number
      const trackingNumber = generateTrackingNumber()

      // Update all order items from this supplier
      const { data: updatedItems, error: updateError } = await supabase
        .from('order_items')
        .update({ 
          tracking_number: trackingNumber
        })
        .in('id', itemIds)
        .select('id, tracking_number')

      if (updateError) {
        console.error(`❌ Error assigning tracking for ${supplierLabel}:`, updateError)
      } else {
        console.log(`✅ ${supplierLabel}: Assigned ${trackingNumber} to ${itemIds.length} item(s)`)
        totalAssigned += itemIds.length
      }
    }

    console.log('')
    console.log(`✅ Successfully assigned tracking numbers to ${totalAssigned} order item(s)`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

assignTrackingNumbers()

