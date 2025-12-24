# Manual Payment Status Update

## How to manually update payment status to "paid" for an order

### Using the Manual Webhook Trigger API

Send a POST request to `/api/webhooks/manual-trigger` with the following payload:

```json
{
  "orderReference": "552b68cd16e540f693671bd4a5c88ed3",
  "transactionId": "MANUAL-TXN-1234567890",
  "amount": "1000.00",
  "currency": "TZS"
}
```

### Example using cURL:

```bash
curl -X POST https://your-domain.com/api/webhooks/manual-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "orderReference": "552b68cd16e540f693671bd4a5c88ed3",
    "transactionId": "MANUAL-TXN-1234567890",
    "amount": "1000.00",
    "currency": "TZS"
  }'
```

### Example using JavaScript/Node.js:

```javascript
const response = await fetch('/api/webhooks/manual-trigger', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderReference: '552b68cd16e540f693671bd4a5c88ed3',
    transactionId: 'MANUAL-TXN-1234567890',
    amount: '1000.00',
    currency: 'TZS'
  })
})

const result = await response.json()
console.log(result)
```

### Notes:

1. **No signature required**: The manual trigger skips signature verification
2. **No API verification**: The webhook handler will skip ClickPesa API verification for manual triggers
3. **Order Reference**: Use the order reference ID (with or without hyphens)
4. **Transaction ID**: Optional - if not provided, a timestamp-based ID will be generated
5. **Amount**: Optional - if not provided, defaults to "500.00"
6. **Currency**: Optional - defaults to "TZS"

### What happens:

1. The manual trigger creates a mock ClickPesa webhook payload
2. It forwards the payload to `/api/webhooks/clickpesa` with `X-Manual-Trigger: true` header
3. The webhook handler detects the manual trigger flag and skips API verification
4. The order payment status is updated to "paid"
5. Stock is reduced (if payment is successful)
6. Cart is cleared (for authenticated users)

### Response:

```json
{
  "success": true,
  "message": "Manual webhook triggered",
  "webhookResponse": {
    "success": true,
    "message": "Initial payment processed successfully",
    "order_id": "...",
    "order_number": "...",
    "reference_id": "552b68cd16e540f693671bd4a5c88ed3",
    "payment_status": "paid",
    "order_status": "pending",
    "is_retry_payment": false,
    "previous_payment_status": "pending",
    "failure_reason": null,
    "timestamp": "2024-..."
  },
  "webhookStatus": 200
}
```




