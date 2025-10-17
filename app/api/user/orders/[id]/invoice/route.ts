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
        totalPrice: item.total_price,
        image: item.products?.image || ''
      })) || [],
      totals: {
        subtotal: order.total_amount,
        tax: 0, // Add tax calculation if needed
        shipping: order.delivery_option === 'shipping' ? 0 : 0, // Add shipping cost if needed
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

    // Generate HTML invoice
    const htmlInvoice = generateInvoiceHTML(invoiceData)

    // Return HTML response for PDF generation
    return new NextResponse(htmlInvoice, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="invoice-${order.order_number}.html"`
      }
    })

  } catch (error: any) {
    console.error('Error generating invoice:', error)
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 })
  }
}

function generateInvoiceHTML(data: any) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${data.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }
        
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .invoice-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .invoice-header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .invoice-header .invoice-number {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .invoice-content {
            padding: 30px;
        }
        
        .invoice-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .company-info, .customer-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
        }
        
        .company-info h3, .customer-info h3 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }
        
        .company-info p, .customer-info p {
            margin-bottom: 5px;
            color: #6c757d;
        }
        
        .order-details {
            background: #e9ecef;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
        }
        
        .order-details h3 {
            color: #495057;
            margin-bottom: 15px;
        }
        
        .order-details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .order-details-grid div {
            display: flex;
            justify-content: space-between;
        }
        
        .order-details-grid strong {
            color: #495057;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: white;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .items-table th {
            background: #495057;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        
        .items-table td {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .items-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .item-image {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 4px;
        }
        
        .item-name {
            font-weight: 600;
            color: #495057;
        }
        
        .item-variant {
            color: #6c757d;
            font-size: 0.9rem;
        }
        
        .quantity, .price {
            text-align: center;
            font-weight: 600;
        }
        
        .total-price {
            text-align: right;
            font-weight: 700;
            color: #28a745;
        }
        
        .totals-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
        }
        
        .totals-grid {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            max-width: 300px;
            margin-left: auto;
        }
        
        .totals-grid div {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }
        
        .totals-grid .total-line {
            border-top: 2px solid #495057;
            font-weight: 700;
            font-size: 1.1rem;
            color: #495057;
            margin-top: 10px;
            padding-top: 10px;
        }
        
        .payment-info {
            background: #e7f3ff;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        
        .payment-info h3 {
            color: #495057;
            margin-bottom: 15px;
        }
        
        .payment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #6c757d;
            font-size: 0.9rem;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-pending { background: #fff3cd; color: #856404; }
        .status-confirmed { background: #d4edda; color: #155724; }
        .status-shipped { background: #cce5ff; color: #004085; }
        .status-delivered { background: #d1ecf1; color: #0c5460; }
        .status-cancelled { background: #f8d7da; color: #721c24; }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .invoice-container {
                box-shadow: none;
                border-radius: 0;
            }
        }
        
        @media (max-width: 768px) {
            .invoice-info {
                grid-template-columns: 1fr;
            }
            
            .order-details-grid {
                grid-template-columns: 1fr;
            }
            
            .items-table {
                font-size: 0.9rem;
            }
            
            .items-table th,
            .items-table td {
                padding: 10px 8px;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            <h1>INVOICE</h1>
            <div class="invoice-number">${data.invoiceNumber}</div>
        </div>
        
        <div class="invoice-content">
            <div class="invoice-info">
                <div class="company-info">
                    <h3>From:</h3>
                    <p><strong>${data.company.name}</strong></p>
                    <p>${data.company.address}</p>
                    <p>Phone: ${data.company.phone}</p>
                    <p>Email: ${data.company.email}</p>
                    <p>Website: ${data.company.website}</p>
                </div>
                
                <div class="customer-info">
                    <h3>Bill To:</h3>
                    <p><strong>${data.customer.name}</strong></p>
                    <p>${data.customer.email}</p>
                    <p>${data.customer.phone}</p>
                    <p>${data.customer.address}</p>
                </div>
            </div>
            
            <div class="order-details">
                <h3>Order Information</h3>
                <div class="order-details-grid">
                    <div>
                        <span>Order Number:</span>
                        <strong>${data.orderNumber}</strong>
                    </div>
                    <div>
                        <span>Order Date:</span>
                        <strong>${data.orderDate}</strong>
                    </div>
                    <div>
                        <span>Order Time:</span>
                        <strong>${data.orderTime}</strong>
                    </div>
                    <div>
                        <span>Delivery Method:</span>
                        <strong>${data.delivery.option === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</strong>
                    </div>
                    <div>
                        <span>Tracking Number:</span>
                        <strong>${data.delivery.trackingNumber}</strong>
                    </div>
                    <div>
                        <span>Estimated Delivery:</span>
                        <strong>${data.delivery.estimatedDelivery}</strong>
                    </div>
                </div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Image</th>
                        <th>Item</th>
                        <th style="width: 80px;">Qty</th>
                        <th style="width: 100px;">Unit Price</th>
                        <th style="width: 120px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map((item: any) => `
                        <tr>
                            <td>
                                ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image">` : '<div class="item-image" style="background: #e9ecef; display: flex; align-items: center; justify-content: center; color: #6c757d;">N/A</div>'}
                            </td>
                            <td>
                                <div class="item-name">${item.name}</div>
                                ${item.variant ? `<div class="item-variant">${item.variant}</div>` : ''}
                            </td>
                            <td class="quantity">${item.quantity}</td>
                            <td class="price">${formatCurrency(item.unitPrice)}</td>
                            <td class="total-price">${formatCurrency(item.totalPrice)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="totals-section">
                <div class="totals-grid">
                    <div>
                        <span>Subtotal:</span>
                        <span>${formatCurrency(data.totals.subtotal)}</span>
                    </div>
                    ${data.totals.tax > 0 ? `
                    <div>
                        <span>Tax:</span>
                        <span>${formatCurrency(data.totals.tax)}</span>
                    </div>
                    ` : ''}
                    ${data.totals.shipping > 0 ? `
                    <div>
                        <span>Shipping:</span>
                        <span>${formatCurrency(data.totals.shipping)}</span>
                    </div>
                    ` : ''}
                    <div class="total-line">
                        <span>Total:</span>
                        <span>${formatCurrency(data.totals.total)}</span>
                    </div>
                </div>
            </div>
            
            <div class="payment-info">
                <h3>Payment Information</h3>
                <div class="payment-grid">
                    <div>
                        <strong>Payment Method:</strong> ${data.payment.method}
                    </div>
                    <div>
                        <strong>Payment Status:</strong> 
                        <span class="status-badge status-${data.payment.status}">${data.payment.status}</span>
                    </div>
                    <div>
                        <strong>Transaction ID:</strong> ${data.payment.transactionId}
                    </div>
                </div>
            </div>
            
            ${data.notes ? `
            <div class="payment-info">
                <h3>Notes</h3>
                <p>${data.notes}</p>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>This invoice was generated on ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</p>
        </div>
    </div>
</body>
</html>
  `
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}
