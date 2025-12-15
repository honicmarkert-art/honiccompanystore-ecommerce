/**
 * Script to manually trigger stock decrement for a specific order
 * This bypasses the payment status check for testing
 * Usage: node scripts/manual-stock-decrement.js <reference_id>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const referenceId = process.argv[2] || '6e53dd9792ee437c93023295f2befbf3';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function manualStockDecrement() {
  try {
    console.log(`🔍 Processing stock decrement for order: ${referenceId}\n`);
    
    // Find the order
    const normalizedRef = referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
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
    console.log(`   Payment Status: ${order.payment_status}\n`);
    
    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, variant_attributes, variant_id, variant_name')
      .eq('order_id', order.id);
    
    if (itemsError || !orderItems || orderItems.length === 0) {
      console.error('❌ Error fetching order items:', itemsError);
      return;
    }
    
    console.log(`📦 Found ${orderItems.length} order item(s)\n`);
    
    // Process each item
    for (const item of orderItems) {
      console.log(`\n📦 Processing product ${item.product_id}, quantity: ${item.quantity}`);
      
      // Parse variant_attributes
      let variantAttributes = item.variant_attributes;
      if (typeof variantAttributes === 'string') {
        try {
          variantAttributes = JSON.parse(variantAttributes);
        } catch (e) {
          variantAttributes = null;
        }
      }
      
      // Fallback: Reconstruct from variant_name
      if ((!variantAttributes || Object.keys(variantAttributes || {}).length === 0) && item.variant_name) {
        console.log(`⚠️  variant_attributes missing, reconstructing from variant_name: "${item.variant_name}"`);
        
        const { data: productVariants } = await supabase
          .from('product_variants')
          .select('primary_values')
          .eq('product_id', item.product_id);
        
        if (productVariants) {
          for (const variant of productVariants) {
            let pvArray = variant.primary_values;
            if (typeof pvArray === 'string') {
              try {
                pvArray = JSON.parse(pvArray);
              } catch (e) {
                continue;
              }
            }
            
            if (pvArray && Array.isArray(pvArray)) {
              const matchingPv = pvArray.find((pv) => String(pv.value) === String(item.variant_name));
              if (matchingPv) {
                variantAttributes = { [matchingPv.attribute]: matchingPv.value };
                console.log(`✅ Reconstructed:`, variantAttributes);
                break;
              }
            }
          }
        }
      }
      
      // Process variant-level stock if we have variant_attributes
      if (variantAttributes && typeof variantAttributes === 'object' && Object.keys(variantAttributes).length > 0) {
        console.log(`📋 Using variant_attributes:`, variantAttributes);
        
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, primary_values')
          .eq('product_id', item.product_id);
        
        if (!variants || variants.length === 0) {
          console.log(`⚠️  No variants found, skipping`);
          continue;
        }
        
        for (const variant of variants) {
          let primaryValues = variant.primary_values;
          if (typeof primaryValues === 'string') {
            try {
              primaryValues = JSON.parse(primaryValues);
            } catch (e) {
              continue;
            }
          }
          
          if (!primaryValues || !Array.isArray(primaryValues)) continue;
          
          let updated = false;
          const updatedPrimaryValues = primaryValues.map((pv) => {
            const matchingAttribute = Object.entries(variantAttributes).find(
              ([key, value]) => pv.attribute === key && String(pv.value) === String(value)
            );
            
            if (matchingAttribute) {
              const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0;
              const newQty = Math.max(0, currentQty - item.quantity);
              updated = true;
              console.log(`✅ Decrementing ${pv.attribute}="${pv.value}": ${currentQty} -> ${newQty}`);
              return { ...pv, quantity: newQty };
            }
            return pv;
          });
          
          if (updated) {
            const { error: updateError } = await supabase
              .from('product_variants')
              .update({ primary_values: updatedPrimaryValues })
              .eq('id', variant.id);
            
            if (updateError) {
              console.error(`❌ Error updating variant:`, updateError);
            } else {
              console.log(`✅ Variant ${variant.id} updated`);
              
              // Recalculate product stock
              const { data: allVariants } = await supabase
                .from('product_variants')
                .select('primary_values')
                .eq('product_id', item.product_id);
              
              if (allVariants) {
                let totalStock = 0;
                for (const v of allVariants) {
                  let pvArray = v.primary_values;
                  if (typeof pvArray === 'string') {
                    try {
                      pvArray = JSON.parse(pvArray);
                    } catch (e) {
                      continue;
                    }
                  }
                  if (pvArray && Array.isArray(pvArray)) {
                    for (const pv of pvArray) {
                      const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0;
                      totalStock += qty;
                    }
                  }
                }
                
                const { error: productUpdateError } = await supabase
                  .from('products')
                  .update({
                    stock_quantity: totalStock,
                    in_stock: totalStock > 0,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id);
                
                if (productUpdateError) {
                  console.error(`❌ Error updating product stock:`, productUpdateError);
                } else {
                  console.log(`✅ Product ${item.product_id} stock updated to: ${totalStock}`);
                }
              }
            }
          }
        }
      } else {
        console.log(`⚠️  No variant_attributes, using product-level reduction`);
        // Product-level fallback would go here
      }
    }
    
    console.log(`\n✅ Stock decrement complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

manualStockDecrement();









