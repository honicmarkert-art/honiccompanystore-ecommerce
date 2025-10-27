import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/user/orders/[orderNumber]/invoice-pdf - Generate PDF invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    const cookieStore = await cookies()
    
    const response = new NextResponse()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) { response.cookies.set(name, value, options) },
          remove(name: string, options: any) { response.cookies.delete(name) },
        },
      }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          variant_name,
          variant_attributes,
          quantity,
          price,
          total_price
        )
      `)
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check authorization
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch product images
    const productIds = order.order_items?.map((item: any) => item.product_id).filter(Boolean) || []
    let productImagesMap = new Map<number, string>()
    
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, image')
        .in('id', productIds)
      
      if (products) {
        products.forEach(product => {
          productImagesMap.set(product.id, product.image || '/placeholder.jpg')
        })
      }
    }

    // Format date
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Format currency
    const formatCurrency = (amount: number, currency: string = 'TZS') => {
      return `${currency} ${amount.toLocaleString()}`
    }

    // For now, return a simple text-based invoice
    // To generate actual PDFs, you would need a library like puppeteer, pdfkit, or @react-pdf/renderer
    const textContent = `
INVOICE
========

Order #${order.order_number}
Date: ${formatDate(order.created_at)}
Status: ${order.status}
Payment Status: ${order.payment_status}

CUSTOMER INFORMATION
---------------------
Email: ${user.email || 'N/A'}
${order.shipping_address?.fullName ? `Name: ${order.shipping_address.fullName}` : ''}
${order.shipping_address?.phone ? `Phone: ${order.shipping_address.phone}` : ''}

ORDER ITEMS
-----------
${(order.order_items || []).map((item: any) => `
${item.product_name}${item.variant_name ? ' - ' + item.variant_name : ''}
Quantity: ${item.quantity} | Price: ${formatCurrency(item.price)} | Total: ${formatCurrency(item.total_price)}
`).join('\n')}

TOTAL: ${formatCurrency(order.total_amount)}

${order.shipping_address ? `
SHIPPING ADDRESS
----------------
${order.shipping_address.fullName || ''}
${order.shipping_address.address || ''}
${order.shipping_address.city || ''}, ${order.shipping_address.state || ''}
${order.shipping_address.country || ''}
` : ''}

Thank you for your business!
This is an automatically generated invoice.

Generated on: ${new Date().toISOString()}
    `.trim()

    // Return as plain text for now
    // To generate actual PDFs, you would convert this to PDF format
    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="invoice-${orderNumber}.txt"`,
      },
    })

  } catch (error: any) {
    logger.log('❌ Error generating PDF invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

