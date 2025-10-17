import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function getClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    
    // Fetch the specific order with all details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          variant_id,
          variant_name,
          variant_attributes,
          quantity,
          price,
          total_price,
          created_at,
          products (
            id,
            name,
            image,
            gallery
          )
        )
      `)
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Get company settings for invoice branding
    const { data: companySettings } = await supabase
      .from('admin_settings')
      .select('*')
      .single()

    // Generate invoice data
    const invoiceData = {
      invoiceNumber: `INV-${order.order_number}`,
      orderNumber: order.order_number,
      orderDate: new Date(order.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      orderTime: new Date(order.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      company: {
        name: companySettings?.company_name || 'Honic Co.',
        address: companySettings?.company_address || 'NSSF 3-Floor, Dar es Salaam, Tanzania',
        phone: companySettings?.company_phone || '0127377461 / 0693119708',
        email: companySettings?.company_email || 'sales@honiccompanystore.com',
        website: companySettings?.company_website || 'honiccompanystore.com'
      },
      customer: {
        name: order.shipping_address?.fullName || order.shipping_address?.full_name || 'Guest Customer',
        email: order.shipping_address?.email || 'N/A',
        phone: order.shipping_address?.phone || 'N/A',
        address: [
          order.shipping_address?.address1 || order.shipping_address?.address || '',
          order.shipping_address?.address2 || '',
          `${order.shipping_address?.city || ''}, ${order.shipping_address?.state || order.shipping_address?.region || ''}`,
          order.shipping_address?.postalCode || order.shipping_address?.postal_code || '',
          order.shipping_address?.country || ''
        ].filter(Boolean).join(', ')
      },
      items: order.order_items?.map((item: any) => ({
        name: item.product_name,
        variant: item.variant_name || '',
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.total_price
      })) || [],
      totals: {
        subtotal: order.total_amount,
        tax: 0,
        shipping: order.delivery_option === 'shipping' ? 0 : 0,
        total: order.total_amount
      },
      payment: {
        method: order.payment_method,
        status: order.payment_status,
        transactionId: order.clickpesa_transaction_id || 'N/A'
      },
      delivery: {
        option: order.delivery_option,
        trackingNumber: order.tracking_number || 'N/A',
        estimatedDelivery: order.estimated_delivery || 'N/A'
      },
      notes: order.notes || ''
    }

    // Generate simple text invoice for PDF conversion
    const textInvoice = generateTextInvoice(invoiceData)

    // Return text response that can be converted to PDF
    return new NextResponse(textInvoice, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="invoice-${order.order_number}.txt"`
      }
    })

  } catch (error: any) {
    console.error('Error generating invoice:', error)
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 })
  }
}

function generateTextInvoice(data: any) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return `
================================================================================
                                    INVOICE
================================================================================

Invoice Number: ${data.invoiceNumber}
Order Number: ${data.orderNumber}
Date: ${data.orderDate} at ${data.orderTime}

================================================================================
FROM:
${data.company.name}
${data.company.address}
Phone: ${data.company.phone}
Email: ${data.company.email}
Website: ${data.company.website}

================================================================================
BILL TO:
${data.customer.name}
${data.customer.email}
${data.customer.phone}
${data.customer.address}

================================================================================
ORDER INFORMATION:
Order Number: ${data.orderNumber}
Order Date: ${data.orderDate}
Order Time: ${data.orderTime}
Delivery Method: ${data.delivery.option === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
Tracking Number: ${data.delivery.trackingNumber}
Estimated Delivery: ${data.delivery.estimatedDelivery}

================================================================================
ITEMS:
${data.items.map((item: any, index: number) => `
${index + 1}. ${item.name}${item.variant ? ` (${item.variant})` : ''}
   Quantity: ${item.quantity}
   Unit Price: ${formatCurrency(item.unitPrice)}
   Total: ${formatCurrency(item.totalPrice)}
`).join('')}

================================================================================
TOTALS:
Subtotal: ${formatCurrency(data.totals.subtotal)}
${data.totals.tax > 0 ? `Tax: ${formatCurrency(data.totals.tax)}` : ''}
${data.totals.shipping > 0 ? `Shipping: ${formatCurrency(data.totals.shipping)}` : ''}
TOTAL: ${formatCurrency(data.totals.total)}

================================================================================
PAYMENT INFORMATION:
Payment Method: ${data.payment.method}
Payment Status: ${data.payment.status.toUpperCase()}
Transaction ID: ${data.payment.transactionId}

================================================================================
${data.notes ? `NOTES:
${data.notes}

================================================================================` : ''}
Thank you for your business!

This invoice was generated on ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
})}

================================================================================
  `.trim()
}
