/**
 * Email Templates Utility
 * Modern, responsive email templates with colorless icons
 * Security-focused with proper validation
 */

export interface EmailTemplateOptions {
  companyName?: string
  companyLogo?: string
  primaryColor?: string
  supportEmail?: string
  unsubscribeUrl?: string
}

// Base email template wrapper
export function getBaseEmailTemplate(
  content: string,
  options: EmailTemplateOptions = {}
): string {
  const {
    companyName = 'Honic Company Store',
    companyLogo = '',
    primaryColor = '#f59e0b',
    supportEmail = 'support@honiccompanystore.com',
  } = options

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: linear-gradient(135deg, ${primaryColor} 0%, #ea580c 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .email-logo {
      max-width: 150px;
      height: auto;
      margin-bottom: 10px;
    }
    .email-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-content {
      color: #333333;
      font-size: 16px;
      line-height: 1.8;
    }
    .email-button {
      display: inline-block;
      padding: 14px 28px;
      background-color: ${primaryColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .email-button:hover {
      background-color: #ea580c;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
    .email-footer a {
      color: ${primaryColor};
      text-decoration: none;
    }
    .info-box {
      background-color: #f9fafb;
      border-left: 4px solid ${primaryColor};
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box-title {
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }
    .info-box-content {
      color: #4b5563;
      font-size: 14px;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }
    .icon {
      width: 20px;
      height: 20px;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
      fill: currentColor;
    }
    @media only screen and (max-width: 600px) {
      .email-body { padding: 30px 20px; }
      .email-title { font-size: 20px; }
      .email-content { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" class="email-logo">` : ''}
      <h1 class="email-title">${companyName}</h1>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
      <p style="margin-top: 10px;">
        <a href="mailto:${supportEmail}">Contact Support</a> | 
        <a href="${options.unsubscribeUrl || '#'}">Unsubscribe</a>
      </p>
      <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Colorless SVG icons
export const Icons = {
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 6L9 17l-5-5"/>
  </svg>`,
  package: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>`,
  truck: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="1" y="3" width="15" height="13"/>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>`,
  mail: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
  dollar: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>`,
  user: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`,
  lock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>`,
  star: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`,
  calendar: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>`,
  clock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>`,
  checkCircle: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,
}

// Order Confirmation Email Template
export function getOrderConfirmationTemplate(order: {
  orderNumber: string
  orderDate: string
  items: Array<{ name: string; quantity: number; price: number; image?: string }>
  subtotal: number
  shipping: number
  tax: number
  total: number
  shippingAddress: any
  billingAddress?: any
  paymentMethod: string
  trackingUrl?: string
  invoiceUrl?: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
        ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : ''}
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
        <strong>${item.name}</strong><br>
        <span style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</span>
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        ${(item.price * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
      </td>
    </tr>
  `).join('')

  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.check} Order Confirmed!</h2>
      <p>Thank you for your purchase! Your order has been confirmed and we're preparing it for shipment.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">Order Date: ${order.orderDate}</div>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">Order Items</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e5e7eb;">Image</th>
            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
            <th style="padding: 15px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;">Subtotal:</td>
            <td style="text-align: right; padding: 8px 0;">${order.subtotal.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Shipping:</td>
            <td style="text-align: right; padding: 8px 0;">${order.shipping.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
          ${order.tax > 0 ? `
          <tr>
            <td style="padding: 8px 0;">Tax:</td>
            <td style="text-align: right; padding: 8px 0;">${order.tax.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #e5e7eb; margin-top: 10px;">
            <td style="padding: 8px 0; font-weight: 600; font-size: 18px;">Total:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; font-size: 18px;">${order.total.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
        </table>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.truck} Shipping Address</div>
        <div class="info-box-content">
          ${order.shippingAddress.fullName || order.shippingAddress.name}<br>
          ${order.shippingAddress.address || order.shippingAddress.address1}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state || order.shippingAddress.region} ${order.shippingAddress.postalCode || order.shippingAddress.postal_code}<br>
          ${order.shippingAddress.country}
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.dollar} Payment Method</div>
        <div class="info-box-content">${order.paymentMethod}</div>
      </div>

      ${order.trackingUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${order.trackingUrl}" class="email-button">Track Your Order</a>
        </div>
      ` : ''}

      ${order.invoiceUrl ? `
        <div style="text-align: center; margin: 20px 0;">
          <a href="${order.invoiceUrl}" class="email-button" style="background-color: #6b7280;">Download Invoice</a>
        </div>
      ` : ''}
    </div>
  `, options)

  const text = `
Order Confirmed!

Thank you for your purchase! Your order has been confirmed.

Order Number: ${order.orderNumber}
Order Date: ${order.orderDate}

Order Items:
${order.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - ${(item.price * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}`).join('\n')}

Subtotal: ${order.subtotal.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
Shipping: ${order.shipping.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
${order.tax > 0 ? `Tax: ${order.tax.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}\n` : ''}Total: ${order.total.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}

Shipping Address:
${order.shippingAddress.fullName || order.shippingAddress.name}
${order.shippingAddress.address || order.shippingAddress.address1}
${order.shippingAddress.city}, ${order.shippingAddress.state || order.shippingAddress.region} ${order.shippingAddress.postalCode || order.shippingAddress.postal_code}
${order.shippingAddress.country}

Payment Method: ${order.paymentMethod}

${order.trackingUrl ? `Track your order: ${order.trackingUrl}` : ''}
${order.invoiceUrl ? `Download invoice: ${order.invoiceUrl}` : ''}
  `.trim()

  return { html, text }
}

// Order Status Update Email Template
export function getOrderStatusUpdateTemplate(order: {
  orderNumber: string
  status: string
  statusMessage: string
  trackingNumber?: string
  trackingUrl?: string
  estimatedDelivery?: string
  items?: Array<{ name: string; quantity: number }>
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const statusIcons: Record<string, string> = {
    confirmed: Icons.check,
    shipped: Icons.truck,
    delivered: Icons.check,
    cancelled: Icons.alert,
  }

  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${statusIcons[order.status.toLowerCase()] || Icons.package} Order Status Update</h2>
      <p>Your order status has been updated.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">
          <strong>Status:</strong> ${order.status}<br>
          ${order.statusMessage}
        </div>
      </div>

      ${order.trackingNumber ? `
        <div class="info-box">
          <div class="info-box-title">${Icons.truck} Tracking Information</div>
          <div class="info-box-content">
            Tracking Number: <strong>${order.trackingNumber}</strong><br>
            ${order.trackingUrl ? `<a href="${order.trackingUrl}" style="color: ${options.primaryColor || '#f59e0b'};">Track Package</a>` : ''}
          </div>
        </div>
      ` : ''}

      ${order.estimatedDelivery ? `
        <div class="info-box">
          <div class="info-box-title">${Icons.calendar} Estimated Delivery</div>
          <div class="info-box-content">${order.estimatedDelivery}</div>
        </div>
      ` : ''}

      ${order.items && order.items.length > 0 ? `
        <h3 style="color: #111827; margin: 30px 0 15px 0;">Order Items</h3>
        <ul style="list-style: none; padding: 0;">
          ${order.items.map(item => `
            <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
              ${item.name} (Qty: ${item.quantity})
            </li>
          `).join('')}
        </ul>
      ` : ''}

      ${order.trackingUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${order.trackingUrl}" class="email-button">Track Your Order</a>
        </div>
      ` : ''}
    </div>
  `, options)

  const text = `
Order Status Update

Your order status has been updated.

Order Number: ${order.orderNumber}
Status: ${order.status}
${order.statusMessage}

${order.trackingNumber ? `Tracking Number: ${order.trackingNumber}\n${order.trackingUrl ? `Track Package: ${order.trackingUrl}` : ''}` : ''}
${order.estimatedDelivery ? `Estimated Delivery: ${order.estimatedDelivery}` : ''}
  `.trim()

  return { html, text }
}

// Shipping Notification Email Template
export function getShippingNotificationTemplate(order: {
  orderNumber: string
  trackingNumber: string
  carrier: string
  trackingUrl: string
  estimatedDelivery: string
  shippingAddress: any
  items: Array<{ name: string; quantity: number; image?: string }>
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.truck} Your Order Has Shipped!</h2>
      <p>Great news! Your order has been shipped and is on its way to you.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">
          <strong>Tracking Number:</strong> ${order.trackingNumber}<br>
          <strong>Carrier:</strong> ${order.carrier}<br>
          <strong>Estimated Delivery:</strong> ${order.estimatedDelivery}
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${order.trackingUrl}" class="email-button">Track Your Package</a>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">Shipped Items</h3>
      <ul style="list-style: none; padding: 0;">
        ${order.items.map(item => `
          <li style="padding: 15px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 15px;">` : ''}
            <div>
              <strong>${item.name}</strong><br>
              <span style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</span>
            </div>
          </li>
        `).join('')}
      </ul>

      <div class="info-box">
        <div class="info-box-title">${Icons.truck} Delivery Address</div>
        <div class="info-box-content">
          ${order.shippingAddress.fullName || order.shippingAddress.name}<br>
          ${order.shippingAddress.address || order.shippingAddress.address1}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state || order.shippingAddress.region} ${order.shippingAddress.postalCode || order.shippingAddress.postal_code}<br>
          ${order.shippingAddress.country}
        </div>
      </div>
    </div>
  `, options)

  const text = `
Your Order Has Shipped!

Great news! Your order has been shipped and is on its way to you.

Order Number: ${order.orderNumber}
Tracking Number: ${order.trackingNumber}
Carrier: ${order.carrier}
Estimated Delivery: ${order.estimatedDelivery}

Track your package: ${order.trackingUrl}

Shipped Items:
${order.items.map(item => `- ${item.name} (Qty: ${item.quantity})`).join('\n')}

Delivery Address:
${order.shippingAddress.fullName || order.shippingAddress.name}
${order.shippingAddress.address || order.shippingAddress.address1}
${order.shippingAddress.city}, ${order.shippingAddress.state || order.shippingAddress.region} ${order.shippingAddress.postalCode || order.shippingAddress.postal_code}
${order.shippingAddress.country}
  `.trim()

  return { html, text }
}

// Delivery Confirmation Email Template
export function getDeliveryConfirmationTemplate(order: {
  orderNumber: string
  deliveryDate: string
  items: Array<{ name: string; quantity: number; image?: string }>
  reviewUrl?: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.check} Order Delivered!</h2>
      <p>Your order has been successfully delivered. We hope you're happy with your purchase!</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">Delivered on: ${order.deliveryDate}</div>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">Delivered Items</h3>
      <ul style="list-style: none; padding: 0;">
        ${order.items.map(item => `
          <li style="padding: 15px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 15px;">` : ''}
            <div>
              <strong>${item.name}</strong><br>
              <span style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</span>
            </div>
          </li>
        `).join('')}
      </ul>

      ${order.reviewUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${order.reviewUrl}" class="email-button">Leave a Review</a>
        </div>
      ` : ''}

      <div class="info-box">
        <div class="info-box-title">${Icons.mail} Need Help?</div>
        <div class="info-box-content">
          If you have any questions or concerns about your order, please contact our support team.
        </div>
      </div>
    </div>
  `, options)

  const text = `
Order Delivered!

Your order has been successfully delivered.

Order Number: ${order.orderNumber}
Delivered on: ${order.deliveryDate}

Delivered Items:
${order.items.map(item => `- ${item.name} (Qty: ${item.quantity})`).join('\n')}

${order.reviewUrl ? `Leave a review: ${order.reviewUrl}` : ''}
  `.trim()

  return { html, text }
}

// Invoice Email Template
export function getInvoiceEmailTemplate(invoice: {
  invoiceNumber: string
  invoiceDate: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  tax: number
  total: number
  billingAddress: any
  invoiceUrl: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.dollar} Invoice</h2>
      <p>Please find your invoice attached below.</p>
      
      <div class="info-box">
        <div class="info-box-title">Invoice Number: ${invoice.invoiceNumber}</div>
        <div class="info-box-content">
          Invoice Date: ${invoice.invoiceDate}<br>
          Order Number: ${invoice.orderNumber}
        </div>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">Invoice Items</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 15px; text-align: right; border-bottom: 2px solid #e5e7eb;">Quantity</th>
            <th style="padding: 15px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map(item => `
            <tr>
              <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
              <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
              <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(item.price * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;">Subtotal:</td>
            <td style="text-align: right; padding: 8px 0;">${invoice.subtotal.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
          ${invoice.tax > 0 ? `
          <tr>
            <td style="padding: 8px 0;">Tax:</td>
            <td style="text-align: right; padding: 8px 0;">${invoice.tax.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: 600; font-size: 18px;">Total:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; font-size: 18px;">${invoice.total.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${invoice.invoiceUrl}" class="email-button">Download Invoice</a>
      </div>
    </div>
  `, options)

  const text = `
Invoice

Invoice Number: ${invoice.invoiceNumber}
Invoice Date: ${invoice.invoiceDate}
Order Number: ${invoice.orderNumber}

Items:
${invoice.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - ${(item.price * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}`).join('\n')}

Subtotal: ${invoice.subtotal.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
${invoice.tax > 0 ? `Tax: ${invoice.tax.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}\n` : ''}Total: ${invoice.total.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}

Download invoice: ${invoice.invoiceUrl}
  `.trim()

  return { html, text }
}

// Welcome Email Template (User)
export function getWelcomeUserTemplate(user: {
  name: string
  accountUrl: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.check} Welcome to ${options.companyName || 'Honic Company Store'}!</h2>
      <p>Hi ${user.name},</p>
      <p>Thank you for joining us! We're excited to have you as part of our community.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.user} Get Started</div>
        <div class="info-box-content">
          Your account has been successfully created. You can now browse our products, place orders, and track your purchases.
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${user.accountUrl}" class="email-button">View Your Account</a>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">What's Next?</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.package} Browse our wide selection of products</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.star} Save items to your wishlist</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.truck} Enjoy fast and secure delivery</li>
        <li style="padding: 10px 0;">${Icons.mail} Get support whenever you need it</li>
      </ul>
    </div>
  `, options)

  const text = `
Welcome to ${options.companyName || 'Honic Company Store'}!

Hi ${user.name},

Thank you for joining us! We're excited to have you as part of our community.

Your account has been successfully created. You can now browse our products, place orders, and track your purchases.

View your account: ${user.accountUrl}

What's Next?
- Browse our wide selection of products
- Save items to your wishlist
- Enjoy fast and secure delivery
- Get support whenever you need it
  `.trim()

  return { html, text }
}

// Welcome Email Template (Supplier)
export function getWelcomeSupplierTemplate(supplier: {
  name: string
  companyName: string
  dashboardUrl: string
  commissionRate: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.check} Welcome to ${options.companyName || 'Honic Company Store'} Supplier Program!</h2>
      <p>Hi ${supplier.name},</p>
      <p>Thank you for joining our supplier program! We're excited to partner with <strong>${supplier.companyName}</strong>.</p>
      
      <div class="info-box" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <div class="info-box-title" style="font-weight: 600; color: #92400e; margin-bottom: 8px;">${Icons.alert} Important Account Notice</div>
        <div class="info-box-content" style="color: #78350f; line-height: 1.6;">
          Your supplier account has been created and your company information has been submitted successfully. Your account is currently <strong>under review</strong> by our administration team. You will receive a notification once your account is activated and you can start listing products.
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.user} Your Supplier Account</div>
        <div class="info-box-content">
          <strong>Company Name:</strong> ${supplier.companyName}<br>
          Your supplier account is ready. Once activated, you can start adding products and managing your inventory.
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.dollar} Commission Structure</div>
        <div class="info-box-content">
          Your commission rate: <strong>${supplier.commissionRate}</strong> per product sale
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${supplier.dashboardUrl}" class="email-button">Access Supplier Dashboard</a>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">What's Next?</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.check} Wait for account activation (you'll be notified via email)</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.package} Add your products to the marketplace</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.truck} Manage orders and shipping</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.dollar} Track your earnings and commissions</li>
        <li style="padding: 10px 0;">${Icons.mail} Get support from our team</li>
      </ul>

      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #4b5563; font-size: 14px;">
          <strong>Need Help?</strong><br>
          If you have any questions or need assistance, please don't hesitate to contact our support team. We're here to help you succeed!
        </p>
      </div>
    </div>
  `, options)

  const text = `
Welcome to ${options.companyName || 'Honic Company Store'} Supplier Program!

Hi ${supplier.name},

Thank you for joining our supplier program! We're excited to partner with ${supplier.companyName}.

IMPORTANT ACCOUNT NOTICE:
Your supplier account has been created and your company information has been submitted successfully. Your account is currently UNDER REVIEW by our administration team. You will receive a notification once your account is activated and you can start listing products.

Company Name: ${supplier.companyName}
Commission Rate: ${supplier.commissionRate} per product sale

Access Supplier Dashboard: ${supplier.dashboardUrl}

What's Next?
- Wait for account activation (you'll be notified via email)
- Add your products to the marketplace
- Manage orders and shipping
- Track your earnings and commissions
- Get support from our team

Need Help?
If you have any questions or need assistance, please don't hesitate to contact our support team. We're here to help you succeed!
  `.trim()

  return { html, text }
}

// Price Drop Alert Email Template
export function getPriceDropAlertTemplate(product: {
  name: string
  image: string
  originalPrice: number
  newPrice: number
  discountPercent: number
  productUrl: string
  targetPrice?: number
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.dollar} Price Drop Alert!</h2>
      <p>The price of an item on your watchlist has dropped!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <img src="${product.image}" alt="${product.name}" style="max-width: 300px; height: auto; border-radius: 8px;">
      </div>

      <div class="info-box">
        <div class="info-box-title">${product.name}</div>
        <div class="info-box-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin: 10px 0;">
            <span style="text-decoration: line-through; color: #6b7280;">${product.originalPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</span>
            <span style="font-size: 24px; font-weight: 600; color: #dc2626;">${product.newPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</span>
          </div>
          <div style="color: #dc2626; font-weight: 600; margin-top: 10px;">
            ${product.discountPercent}% OFF!
          </div>
          ${product.targetPrice ? `
            <div style="margin-top: 10px; color: #059669;">
              Your target price: ${product.targetPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
            </div>
          ` : ''}
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${product.productUrl}" class="email-button">View Product</a>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.alert} Limited Time Offer</div>
        <div class="info-box-content">
          This price drop may be temporary. Don't miss out on this great deal!
        </div>
      </div>
    </div>
  `, options)

  const text = `
Price Drop Alert!

The price of an item on your watchlist has dropped!

${product.name}

Original Price: ${product.originalPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
New Price: ${product.newPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
Discount: ${product.discountPercent}% OFF!

${product.targetPrice ? `Your target price: ${product.targetPrice.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}\n` : ''}View Product: ${product.productUrl}

This price drop may be temporary. Don't miss out on this great deal!
  `.trim()

  return { html, text }
}

// Back in Stock Notification Email Template
export function getBackInStockTemplate(product: {
  name: string
  image: string
  price: number
  productUrl: string
  stockQuantity?: number
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.check} Back in Stock!</h2>
      <p>Great news! An item you were interested in is now back in stock.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <img src="${product.image}" alt="${product.name}" style="max-width: 300px; height: auto; border-radius: 8px;">
      </div>

      <div class="info-box">
        <div class="info-box-title">${product.name}</div>
        <div class="info-box-content">
          <div style="font-size: 24px; font-weight: 600; color: #059669; margin: 10px 0;">
            ${product.price.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
          </div>
          ${product.stockQuantity ? `
            <div style="color: #dc2626; font-weight: 600; margin-top: 10px;">
              Only ${product.stockQuantity} left in stock!
            </div>
          ` : ''}
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${product.productUrl}" class="email-button">Buy Now</a>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.alert} Limited Stock</div>
        <div class="info-box-content">
          ${product.stockQuantity ? 'Stock is limited. Order now to secure your item!' : "Don't miss out on this opportunity!"}
        </div>
      </div>
    </div>
  `, options)

  const text = `
Back in Stock!

Great news! An item you were interested in is now back in stock.

${product.name}
Price: ${product.price.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
${product.stockQuantity ? `Only ${product.stockQuantity} left in stock!\n` : ''}Buy Now: ${product.productUrl}

${product.stockQuantity ? 'Stock is limited. Order now to secure your item!' : "Don't miss out on this opportunity!"}
  `.trim()

  return { html, text }
}

// Abandoned Cart Email Template
export function getAbandonedCartTemplate(cart: {
  items: Array<{ name: string; quantity: number; price: number; image?: string }>
  total: number
  cartUrl: string
  discountCode?: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.package} Don't Forget Your Cart!</h2>
      <p>You left some items in your cart. Complete your purchase now!</p>
      
      <h3 style="color: #111827; margin: 30px 0 15px 0;">Your Cart Items</h3>
      <ul style="list-style: none; padding: 0;">
        ${cart.items.map(item => `
          <li style="padding: 15px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; margin-right: 15px;">` : ''}
            <div style="flex: 1;">
              <strong>${item.name}</strong><br>
              <span style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</span>
            </div>
            <div style="font-weight: 600;">
              ${(item.price * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
            </div>
          </li>
        `).join('')}
      </ul>

      <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
        <div style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">
          Total: ${cart.total.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
        </div>
        ${cart.discountCode ? `
          <div style="color: #059669; font-weight: 600; margin-top: 10px;">
            Use code <strong>${cart.discountCode}</strong> for an extra discount!
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${cart.cartUrl}" class="email-button">Complete Your Purchase</a>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.alert} Limited Time</div>
        <div class="info-box-content">
          Items in your cart may sell out. Complete your purchase now to secure your items!
        </div>
      </div>
    </div>
  `, options)

  const text = `
Don't Forget Your Cart!

You left some items in your cart. Complete your purchase now!

Your Cart Items:
${cart.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - ${(item.price * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}`).join('\n')}

Total: ${cart.total.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
${cart.discountCode ? `Use code ${cart.discountCode} for an extra discount!\n` : ''}Complete Your Purchase: ${cart.cartUrl}

Items in your cart may sell out. Complete your purchase now to secure your items!
  `.trim()

  return { html, text }
}

// Order Cancellation Email Template
export function getOrderCancellationTemplate(order: {
  orderNumber: string
  cancellationReason: string
  refundAmount?: number
  refundMethod?: string
  refundTimeline?: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.alert} Order Cancelled</h2>
      <p>We're sorry to inform you that your order has been cancelled.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">
          <strong>Reason:</strong> ${order.cancellationReason}
        </div>
      </div>

      ${order.refundAmount ? `
        <div class="info-box">
          <div class="info-box-title">${Icons.dollar} Refund Information</div>
          <div class="info-box-content">
            Refund Amount: <strong>${order.refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</strong><br>
            ${order.refundMethod ? `Refund Method: ${order.refundMethod}<br>` : ''}
            ${order.refundTimeline ? `Refund Timeline: ${order.refundTimeline}` : ''}
          </div>
        </div>
      ` : ''}

      <div class="info-box">
        <div class="info-box-title">${Icons.mail} Need Help?</div>
        <div class="info-box-content">
          If you have any questions about this cancellation, please contact our support team.
        </div>
      </div>
    </div>
  `, options)

  const text = `
Order Cancelled

We're sorry to inform you that your order has been cancelled.

Order Number: ${order.orderNumber}
Reason: ${order.cancellationReason}

${order.refundAmount ? `
Refund Information:
Refund Amount: ${order.refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
${order.refundMethod ? `Refund Method: ${order.refundMethod}\n` : ''}${order.refundTimeline ? `Refund Timeline: ${order.refundTimeline}` : ''}
` : ''}If you have any questions about this cancellation, please contact our support team.
  `.trim()

  return { html, text }
}

// Refund Confirmation Email Template
export function getRefundConfirmationTemplate(refund: {
  orderNumber: string
  refundAmount: number
  refundMethod: string
  refundTimeline: string
  transactionId?: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.check} Refund Processed</h2>
      <p>Your refund has been successfully processed.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${refund.orderNumber}</div>
        <div class="info-box-content">
          Refund Amount: <strong style="font-size: 20px; color: #059669;">${refund.refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}</strong>
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.dollar} Refund Details</div>
        <div class="info-box-content">
          Refund Method: ${refund.refundMethod}<br>
          Refund Timeline: ${refund.refundTimeline}<br>
          ${refund.transactionId ? `Transaction ID: ${refund.transactionId}` : ''}
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.calendar} What's Next?</div>
        <div class="info-box-content">
          The refund will appear in your account according to the timeline above. If you don't see the refund within the expected timeframe, please contact our support team.
        </div>
      </div>
    </div>
  `, options)

  const text = `
Refund Processed

Your refund has been successfully processed.

Order Number: ${refund.orderNumber}
Refund Amount: ${refund.refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}

Refund Details:
Refund Method: ${refund.refundMethod}
Refund Timeline: ${refund.refundTimeline}
${refund.transactionId ? `Transaction ID: ${refund.transactionId}` : ''}

The refund will appear in your account according to the timeline above. If you don't see the refund within the expected timeframe, please contact our support team.
  `.trim()

  return { html, text }
}

// Newsletter Welcome Email Template
export function getNewsletterWelcomeTemplate(options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.mail} Welcome to Our Newsletter!</h2>
      <p>Thank you for subscribing to our newsletter!</p>
      
      <div class="info-box">
        <div class="info-box-title">What to Expect</div>
        <div class="info-box-content">
          You'll receive exclusive offers, product updates, and industry insights delivered straight to your inbox.
        </div>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">What You'll Get</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.star} Exclusive deals and discounts</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.package} New product announcements</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${Icons.dollar} Special promotions</li>
        <li style="padding: 10px 0;">${Icons.mail} Industry insights and tips</li>
      </ul>

      ${options.unsubscribeUrl ? `
        <div style="text-align: center; margin: 30px 0; font-size: 12px; color: #6b7280;">
          <a href="${options.unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a> from this newsletter at any time.
        </div>
      ` : ''}
    </div>
  `, options)

  const text = `
Welcome to Our Newsletter!

Thank you for subscribing to our newsletter!

What to Expect:
You'll receive exclusive offers, product updates, and industry insights delivered straight to your inbox.

What You'll Get:
- Exclusive deals and discounts
- New product announcements
- Special promotions
- Industry insights and tips

${options.unsubscribeUrl ? `Unsubscribe: ${options.unsubscribeUrl}` : ''}
  `.trim()

  return { html, text }
}

// Security Alert Email Template
export function getSecurityAlertTemplate(alert: {
  alertType: string
  activity: string
  location?: string
  ipAddress?: string
  timestamp: string
  actionTaken: string
  supportUrl: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #dc2626; margin-bottom: 20px;">${Icons.alert} Security Alert</h2>
      <p>We detected unusual activity on your account.</p>
      
      <div class="info-box" style="border-left-color: #dc2626;">
        <div class="info-box-title">${Icons.lock} Alert Type: ${alert.alertType}</div>
        <div class="info-box-content">
          Activity: ${alert.activity}<br>
          ${alert.location ? `Location: ${alert.location}<br>` : ''}
          ${alert.ipAddress ? `IP Address: ${alert.ipAddress}<br>` : ''}
          Timestamp: ${alert.timestamp}
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Action Taken</div>
        <div class="info-box-content">${alert.actionTaken}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.alert} Security Recommendations</div>
        <div class="info-box-content">
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>If this wasn't you, change your password immediately</li>
            <li>Enable two-factor authentication for added security</li>
            <li>Review your account activity regularly</li>
            <li>Contact support if you notice any suspicious activity</li>
          </ul>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${alert.supportUrl}" class="email-button" style="background-color: #dc2626;">Report Suspicious Activity</a>
      </div>
    </div>
  `, options)

  const text = `
Security Alert

We detected unusual activity on your account.

Alert Type: ${alert.alertType}
Activity: ${alert.activity}
${alert.location ? `Location: ${alert.location}\n` : ''}${alert.ipAddress ? `IP Address: ${alert.ipAddress}\n` : ''}Timestamp: ${alert.timestamp}

Action Taken: ${alert.actionTaken}

Security Recommendations:
- If this wasn't you, change your password immediately
- Enable two-factor authentication for added security
- Review your account activity regularly
- Contact support if you notice any suspicious activity

Report Suspicious Activity: ${alert.supportUrl}
  `.trim()

  return { html, text }
}

// Review Request Email Template
export function getReviewRequestTemplate(order: {
  orderNumber: string
  productName: string
  productImage: string
  productUrl: string
  reviewUrl: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.star} How Was Your Purchase?</h2>
      <p>We'd love to hear about your experience!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <img src="${order.productImage}" alt="${order.productName}" style="max-width: 200px; height: auto; border-radius: 8px;">
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">
          Product: ${order.productName}
        </div>
      </div>

      <p style="margin: 20px 0;">Your feedback helps us improve and helps other customers make informed decisions.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${order.reviewUrl}" class="email-button">Leave a Review</a>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${order.productUrl}" style="color: ${options.primaryColor || '#f59e0b'}; text-decoration: none;">View Product</a>
      </div>
    </div>
  `, options)

  const text = `
How Was Your Purchase?

We'd love to hear about your experience!

Order Number: ${order.orderNumber}
Product: ${order.productName}

Your feedback helps us improve and helps other customers make informed decisions.

Leave a Review: ${order.reviewUrl}
View Product: ${order.productUrl}
  `.trim()

  return { html, text }
}

// Order Placed Welcome Email Template (Simple Thank You)
export function getOrderPlacedWelcomeTemplate(order: {
  orderNumber: string
  orderDate: string
  totalAmount: number
  itemsCount: number
  orderUrl: string
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.checkCircle} Thank You for Your Order!</h2>
      <p>We've received your order and we're excited to process it for you.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Details</div>
        <div class="info-box-content">
          <div style="display: flex; justify-content: space-between; margin: 10px 0;">
            <span style="color: #6b7280;">Order Number:</span>
            <span style="font-weight: 600; color: #111827;">#${order.orderNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 10px 0;">
            <span style="color: #6b7280;">Order Date:</span>
            <span style="color: #111827;">${order.orderDate}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 10px 0;">
            <span style="color: #6b7280;">Items:</span>
            <span style="color: #111827;">${order.itemsCount} item(s)</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 10px 0; padding-top: 10px; border-top: 1px solid #e5e7eb;">
            <span style="font-weight: 600; color: #111827;">Total Amount:</span>
            <span style="font-size: 18px; font-weight: 600; color: #059669;">
              ${order.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}
            </span>
          </div>
        </div>
      </div>

      <div class="info-box" style="background: #fef3c7; border-color: #f59e0b;">
        <div class="info-box-title" style="color: #92400e;">${Icons.clock} What Happens Next?</div>
        <div class="info-box-content" style="color: #78350f;">
          <ol style="margin: 0; padding-left: 20px;">
            <li style="margin: 8px 0;">We're reviewing your order and will confirm it shortly</li>
            <li style="margin: 8px 0;">Once confirmed, you'll receive a payment link</li>
            <li style="margin: 8px 0;">After payment, we'll prepare your items for shipment</li>
            <li style="margin: 8px 0;">You'll receive tracking information when your order ships</li>
          </ol>
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.alert} Important Information</div>
        <div class="info-box-content">
          <p style="margin: 10px 0;">
            <strong>Please wait for order confirmation</strong> before making payment. You will receive a confirmation email with payment instructions shortly.
          </p>
          <p style="margin: 10px 0;">
            If you have any questions about your order, please don't hesitate to contact our support team.
          </p>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${order.orderUrl}" class="email-button">View Order Status</a>
      </div>

      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          <strong>Need Help?</strong><br>
          Contact our support team at ${options.supportEmail || 'support@honiccompanystore.com'} or visit our help center.
        </p>
      </div>
    </div>
  `, options)

  const text = `
Thank You for Your Order!

We've received your order and we're excited to process it for you.

Order Details:
- Order Number: #${order.orderNumber}
- Order Date: ${order.orderDate}
- Items: ${order.itemsCount} item(s)
- Total Amount: ${order.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS' })}

What Happens Next?
1. We're reviewing your order and will confirm it shortly
2. Once confirmed, you'll receive a payment link
3. After payment, we'll prepare your items for shipment
4. You'll receive tracking information when your order ships

Important Information:
Please wait for order confirmation before making payment. You will receive a confirmation email with payment instructions shortly.

If you have any questions about your order, please don't hesitate to contact our support team.

View Order Status: ${order.orderUrl}

Need Help?
Contact our support team at ${options.supportEmail || 'support@honiccompanystore.com'} or visit our help center.
  `.trim()

  return { html, text }
}

// Pickup Reminder Email Template
export function getPickupReminderTemplate(order: {
  orderNumber: string
  pickupId: string
  pickupLocation: string
  pickupInstructions: string
  availableTimes: string
  items: Array<{ name: string; quantity: number }>
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.package} Your Order is Ready for Pickup!</h2>
      <p>Your order is ready for pickup at our store.</p>
      
      <div class="info-box">
        <div class="info-box-title">${Icons.package} Order Number: ${order.orderNumber}</div>
        <div class="info-box-content">
          Pickup ID: <strong>${order.pickupId}</strong>
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.truck} Pickup Location</div>
        <div class="info-box-content">
          ${order.pickupLocation}
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">${Icons.calendar} Available Pickup Times</div>
        <div class="info-box-content">${order.availableTimes}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Pickup Instructions</div>
        <div class="info-box-content">${order.pickupInstructions}</div>
      </div>

      <h3 style="color: #111827; margin: 30px 0 15px 0;">Items Ready for Pickup</h3>
      <ul style="list-style: none; padding: 0;">
        ${order.items.map(item => `
          <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            ${item.name} (Qty: ${item.quantity})
          </li>
        `).join('')}
      </ul>

      <div class="info-box">
        <div class="info-box-title">${Icons.mail} Need Help?</div>
        <div class="info-box-content">
          If you have any questions about pickup, please contact our support team.
        </div>
      </div>
    </div>
  `, options)

  const text = `
Your Order is Ready for Pickup!

Your order is ready for pickup at our store.

Order Number: ${order.orderNumber}
Pickup ID: ${order.pickupId}

Pickup Location:
${order.pickupLocation}

Available Pickup Times:
${order.availableTimes}

Pickup Instructions:
${order.pickupInstructions}

Items Ready for Pickup:
${order.items.map(item => `- ${item.name} (Qty: ${item.quantity})`).join('\n')}

If you have any questions about pickup, please contact our support team.
  `.trim()

  return { html, text }
}

// Password Change OTP Email Template
export function getPasswordChangeOTPTemplate(data: {
  otpCode: string
  expiresInMinutes: number
}, options: EmailTemplateOptions = {}): { html: string; text: string } {
  const html = getBaseEmailTemplate(`
    <div class="email-content">
      <h2 style="color: #111827; margin-bottom: 20px;">${Icons.lock} Password Change Verification</h2>
      <p>Hello,</p>
      <p>You requested to change your password. To complete this action, please use the verification code below:</p>
      
      <div class="info-box" style="border-left-color: #f59e0b; text-align: center; padding: 30px;">
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827; margin: 20px 0;">
          ${data.otpCode}
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">
          This code will expire in ${data.expiresInMinutes} minutes
        </p>
      </div>

      <div class="info-box" style="border-left-color: #dc2626;">
        <div class="info-box-title">${Icons.alert} Security Notice</div>
        <div class="info-box-content">
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Never share this code with anyone</li>
            <li>If you didn't request a password change, please ignore this email</li>
            <li>Your password will not be changed until you complete the verification</li>
          </ul>
        </div>
      </div>

      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        If you're having trouble, please contact our support team for assistance.
      </p>
    </div>
  `, options)

  const text = `
Password Change Verification

Hello,

You requested to change your password. To complete this action, please use the verification code below:

Verification Code: ${data.otpCode}

This code will expire in ${data.expiresInMinutes} minutes.

Security Notice:
- Never share this code with anyone
- If you didn't request a password change, please ignore this email
- Your password will not be changed until you complete the verification

If you're having trouble, please contact our support team for assistance.
  `.trim()

  return { html, text }
}



