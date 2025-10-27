import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/user/orders/[orderNumber]/invoice - Generate HTML invoice
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

    // Generate HTML invoice
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - ${order.order_number}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: #007bff;
        }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .info-box {
            flex: 1;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
        }
        .info-box h3 {
            margin: 0 0 10px 0;
            color: #007bff;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background: #007bff;
            color: white;
            padding: 10px;
            text-align: left;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        .total-row {
            font-weight: bold;
            background: #f8f9fa;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>INVOICE</h1>
        <p>Order #${order.order_number}</p>
    </div>
    
    <div class="info-section">
        <div class="info-box">
            <h3>Order Information</h3>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Payment Status:</strong> ${order.payment_status}</p>
        </div>
        <div class="info-box">
            <h3>Customer Information</h3>
            <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
            ${order.shipping_address?.fullName ? `<p><strong>Name:</strong> ${order.shipping_address.fullName}</p>` : ''}
            ${order.shipping_address?.phone ? `<p><strong>Phone:</strong> ${order.shipping_address.phone}</p>` : ''}
        </div>
    </div>

    <h3>Order Items</h3>
    <table>
        <thead>
            <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${(order.order_items || []).map((item: any) => `
                <tr>
                    <td>${item.product_name}${item.variant_name ? ' - ' + item.variant_name : ''}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.price)}</td>
                    <td>${formatCurrency(item.total_price)}</td>
                </tr>
            `).join('')}
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="3"><strong>Total</strong></td>
                <td><strong>${formatCurrency(order.total_amount)}</strong></td>
            </tr>
        </tfoot>
    </table>

    ${order.shipping_address ? `
        <div class="info-box">
            <h3>Shipping Address</h3>
            <p>${order.shipping_address.fullName || ''}</p>
            <p>${order.shipping_address.address || ''}</p>
            <p>${order.shipping_address.city || ''}, ${order.shipping_address.state || ''}</p>
            <p>${order.shipping_address.country || ''}</p>
        </div>
    ` : ''}

    <div class="footer">
        <p>Thank you for your business!</p>
        <p>This is an automatically generated invoice.</p>
    </div>
</body>
</html>
    `.trim()

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error: any) {
    logger.log('❌ Error generating invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

