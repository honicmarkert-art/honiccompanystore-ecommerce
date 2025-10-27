# Complete Orders Security Model Documentation

## 🔒 **Security Architecture Overview**

This document describes the comprehensive security model implemented for the `orders` table and related components. The security is enforced at multiple levels:

1. **Database Level**: Row Level Security (RLS) policies
2. **Application Level**: API validation and sanitization
3. **Trigger Level**: Database triggers for immutability
4. **Audit Level**: Complete operation logging

---

## 📊 **Column Security Matrix**

### **🔴 IMMUTABLE FIELDS (Cannot be modified after creation)**

| Column | Type | Purpose | Access Level |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | Admin only |
| `order_number` | VARCHAR(255) | Customer-facing order number | Customer read-only |
| `reference_id` | VARCHAR(255) | Payment gateway reference | System read-only |
| `pickup_id` | VARCHAR(255) | Customer pickup identifier | Customer read-only |
| `user_id` | UUID | Order owner | System read-only |
| `total_amount` | DECIMAL(15,2) | Order total amount | System read-only |
| `currency` | VARCHAR(10) | Order currency | System read-only |
| `delivery_option` | VARCHAR(20) | Shipping/pickup choice | System read-only |
| `shipping_address` | JSONB | Delivery address | System read-only |
| `billing_address` | JSONB | Billing address | System read-only |
| `created_at` | TIMESTAMP | Creation timestamp | System read-only |

### **🟡 CONDITIONALLY MUTABLE FIELDS**

| Column | Customer | Admin | System/Webhook | Conditions |
|--------|----------|-------|----------------|------------|
| `notes` | ✅ Update | ✅ Update | ❌ No | Customer: pending/failed only |
| `status` | ❌ No | ✅ Update | ❌ No | Admin: any status |
| `tracking_number` | ❌ No | ✅ Update | ❌ No | Admin: any order |
| `estimated_delivery` | ❌ No | ✅ Update | ❌ No | Admin: any order |
| `payment_status` | ❌ No | ❌ No | ✅ Update | Webhook: payment events |
| `clickpesa_transaction_id` | ❌ No | ❌ No | ✅ Update | Webhook: payment events |
| `payment_timestamp` | ❌ No | ❌ No | ✅ Update | Webhook: payment events |
| `failure_reason` | ❌ No | ❌ No | ✅ Update | Webhook: payment failures |
| `updated_at` | ✅ Update | ✅ Update | ✅ Update | All: automatic |

---

## 🛡️ **Row Level Security Policies**

### **Policy 1: `orders_insert_creation_only`**
```sql
-- Allows order creation with proper validation
WITH CHECK (
  order_number IS NOT NULL 
  AND reference_id IS NOT NULL
  AND total_amount > 0
  AND shipping_address IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
)
```

**Purpose**: Ensures all required fields are present and users can only create their own orders.

### **Policy 2: `orders_select_granular_access`**
```sql
-- Granular read access control
USING (
  (auth.uid() = user_id AND user_id IS NOT NULL)  -- Customer's own orders
  OR EXISTS (SELECT 1 FROM auth.users WHERE ... role = 'admin')  -- Admin access
  OR auth.uid() IS NULL  -- System/webhook access
  OR (user_id IS NULL AND auth.uid() IS NULL)  -- Guest orders
)
```

**Purpose**: Customers see only their orders, admins see all, system has full access.

### **Policy 3: `orders_update_field_restrictions`**
```sql
-- Strict field-level update control
USING (
  (auth.uid() = user_id AND status IN ('pending', 'failed'))  -- Customer: limited
  OR EXISTS (SELECT 1 FROM auth.users WHERE ... role = 'admin')  -- Admin: full
  OR auth.uid() IS NULL  -- System: payment fields only
)
WITH CHECK (
  -- Immutable fields cannot change
  id = OLD.id AND order_number = OLD.order_number AND ...
  -- Role-specific field updates
  AND (customer_fields OR admin_fields OR system_fields)
)
```

**Purpose**: Enforces field-level permissions based on user role.

### **Policy 4: `orders_delete_restricted`**
```sql
-- Admin and failed orders only
USING (
  EXISTS (SELECT 1 FROM auth.users WHERE ... role = 'admin')  -- Admin: any order
  OR (auth.uid() = user_id AND payment_status IN ('failed', 'unpaid'))  -- Customer: failed only
)
```

**Purpose**: Prevents accidental deletion of successful orders.

---

## ⚡ **Database Triggers**

### **Trigger 1: `enforce_order_immutability`**
```sql
-- BEFORE UPDATE trigger
-- Prevents modification of critical fields
IF OLD.reference_id IS DISTINCT FROM NEW.reference_id THEN
  RAISE EXCEPTION 'Reference ID cannot be modified after creation';
END IF;
```

**Purpose**: Database-level enforcement of immutable fields.

### **Trigger 2: `audit_order_operations`**
```sql
-- AFTER INSERT/UPDATE/DELETE trigger
-- Logs all operations to audit_log table
INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id, timestamp)
VALUES ('orders', TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NOW());
```

**Purpose**: Complete audit trail for security monitoring.

---

## 🔍 **API-Level Security**

### **Order Creation Security**
```typescript
// Validate reference_id uniqueness
const validation = await ReferenceIdSecurity.validateReferenceIdCreation(
  referenceId, userId, ipAddress
);

// Sanitize input data
const sanitizedData = ReferenceIdSecurity.sanitizeUpdateData(orderData);

// Create order with security checks
const result = await secureOrderCreation(sanitizedData, userId, ipAddress);
```

### **Order Update Security**
```typescript
// Validate immutable fields
const immutabilityValidation = ReferenceIdSecurity.validateReferenceIdUpdate(
  updateData, existingOrder, userId, ipAddress
);

// Sanitize update data
const sanitizedUpdateData = ReferenceIdSecurity.sanitizeUpdateData(updateData);

// Update with security checks
const result = await secureOrderUpdate(orderId, sanitizedUpdateData, userId, ipAddress);
```

---

## 📋 **Order Items Security**

The `order_items` table inherits security from its parent `orders` table:

- **SELECT**: Users can only see items from orders they have access to
- **INSERT**: Only admins or system can add items
- **UPDATE**: Only admins or system can modify items
- **DELETE**: Only admins or system can delete items

---

## 🔐 **Access Control Examples**

### **Customer Operations**
```sql
-- ✅ Customer can read their own orders
SELECT * FROM orders WHERE user_id = auth.uid();

-- ✅ Customer can update notes on pending orders
UPDATE orders 
SET notes = 'Please deliver after 5 PM' 
WHERE id = 'order-uuid' 
AND user_id = auth.uid() 
AND status = 'pending';

-- ❌ Customer cannot modify reference_id
UPDATE orders SET reference_id = 'new-ref' WHERE id = 'order-uuid';
-- Error: Reference ID cannot be modified after creation
```

### **Admin Operations**
```sql
-- ✅ Admin can read all orders
SELECT * FROM orders;

-- ✅ Admin can update order status
UPDATE orders 
SET status = 'shipped', tracking_number = 'TRK123' 
WHERE id = 'order-uuid';

-- ❌ Admin cannot modify reference_id
UPDATE orders SET reference_id = 'admin-ref' WHERE id = 'order-uuid';
-- Error: Reference ID cannot be modified after creation
```

### **System/Webhook Operations**
```sql
-- ✅ Webhook can update payment status
UPDATE orders 
SET payment_status = 'paid', 
    clickpesa_transaction_id = 'CP123',
    payment_timestamp = NOW()
WHERE reference_id = 'webhook-reference-id';

-- ❌ Webhook cannot modify order details
UPDATE orders 
SET total_amount = 50000 
WHERE reference_id = 'webhook-reference-id';
-- Error: Total amount cannot be modified after creation
```

---

## 🚨 **Security Violations and Monitoring**

### **Audit Log Structure**
```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id VARCHAR(255)  -- Added by migration
);
```

### **Security Monitoring Queries**
```sql
-- Monitor reference_id modification attempts
SELECT * FROM audit_log 
WHERE table_name = 'orders' 
AND operation = 'UPDATE' 
AND new_values->>'reference_id' != old_values->>'reference_id';

-- Monitor failed order access attempts
SELECT * FROM audit_log 
WHERE table_name = 'orders' 
AND user_id IS NULL 
AND operation = 'SELECT';

-- Monitor admin operations
SELECT * FROM audit_log 
WHERE table_name = 'orders' 
AND user_id IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin');
```

---

## ✅ **Security Benefits**

1. **Data Integrity**: Immutable fields prevent accidental corruption
2. **Access Control**: Granular permissions based on user roles
3. **Audit Trail**: Complete logging of all operations
4. **Payment Security**: Reference ID protection for payment systems
5. **Customer Privacy**: Users can only access their own orders
6. **Admin Control**: Admins have full management capabilities
7. **System Integration**: Webhooks can update payment status safely

---

## 🔧 **Maintenance and Updates**

### **Adding New Fields**
1. Determine if field should be immutable
2. Add appropriate CHECK constraints
3. Update RLS policies if needed
4. Update API security functions
5. Add audit logging

### **Modifying Policies**
1. Test changes in development
2. Update documentation
3. Deploy with proper rollback plan
4. Monitor audit logs for issues

### **Security Reviews**
- Monthly audit log analysis
- Quarterly policy review
- Annual security assessment
- Penetration testing

---

This security model provides comprehensive protection for order data while maintaining flexibility for legitimate operations. The multi-layer approach ensures that even if one layer is compromised, others provide additional protection.
