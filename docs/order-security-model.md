# Complete Order Security Model Documentation

## 🔒 **Comprehensive Security Architecture**

### **📋 Table Structure**

#### **Orders Table Columns:**
```sql
CREATE TABLE public.orders (
  -- Primary key (ADMIN ONLY)
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Customer-facing identifiers (READ-ONLY after creation)
  order_number VARCHAR(255) NOT NULL,        -- Customer reference
  reference_id VARCHAR(255) UNIQUE NOT NULL, -- Payment gateway ID
  pickup_id VARCHAR(255),                     -- Customer pickup ID
  
  -- User information
  user_id UUID REFERENCES auth.users(id),
  
  -- Order details (IMMUTABLE after creation)
  total_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TZS',
  delivery_option VARCHAR(20) DEFAULT 'shipping',
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  
  -- Payment information (SYSTEM/WEBHOOK updatable)
  payment_method VARCHAR(50) DEFAULT 'clickpesa',
  payment_status VARCHAR(20) DEFAULT 'pending',
  clickpesa_transaction_id VARCHAR(255),
  payment_timestamp TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  
  -- Order status (ADMIN updatable)
  status VARCHAR(20) DEFAULT 'pending',
  tracking_number VARCHAR(100),
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🛡️ **RLS Policies Breakdown**

### **1. INSERT Policy: `orders_insert_creation_only`**

#### **✅ ALLOWED:**
```sql
-- Customer creates their own order
INSERT INTO orders (order_number, reference_id, user_id, total_amount, shipping_address)
VALUES ('ORD-123', 'ref-456', auth.uid(), 100000, '{"address": "123 Main St"}');

-- System creates guest order
INSERT INTO orders (order_number, reference_id, total_amount, shipping_address)
VALUES ('ORD-123', 'ref-456', 100000, '{"address": "123 Main St"}');
```

#### **❌ FORBIDDEN:**
```sql
-- Missing required fields
INSERT INTO orders (order_number) VALUES ('ORD-123');  -- Missing reference_id, total_amount, shipping_address

-- Invalid amount
INSERT INTO orders (order_number, reference_id, total_amount, shipping_address)
VALUES ('ORD-123', 'ref-456', 0, '{"address": "123 Main St"}');  -- total_amount must be > 0

-- Creating order for another user
INSERT INTO orders (order_number, reference_id, user_id, total_amount, shipping_address)
VALUES ('ORD-123', 'ref-456', 'other-user-uuid', 100000, '{"address": "123 Main St"}');
```

---

### **2. SELECT Policy: `orders_select_granular_access`**

#### **✅ CUSTOMER ACCESS:**
```sql
-- Customer can read their own orders
SELECT * FROM orders WHERE user_id = auth.uid();
-- Returns: All orders belonging to the authenticated user
```

#### **✅ ADMIN ACCESS:**
```sql
-- Admin can read all orders
SELECT * FROM orders;
-- Returns: All orders in the system (admin role required)
```

#### **✅ SYSTEM ACCESS:**
```sql
-- Webhook/system can read orders (no user context)
SELECT * FROM orders WHERE reference_id = 'webhook-reference';
-- Returns: Orders for webhook processing
```

#### **❌ FORBIDDEN:**
```sql
-- Customer cannot read other users' orders
SELECT * FROM orders WHERE user_id != auth.uid();
-- Returns: Empty result (policy blocks access)

-- Non-admin cannot read all orders
SELECT * FROM orders;  -- If user is not admin
-- Returns: Only user's own orders
```

---

### **3. UPDATE Policy: `orders_update_field_restrictions`**

#### **✅ CUSTOMER UPDATES (Limited):**
```sql
-- Customer can only update notes on their pending/failed orders
UPDATE orders 
SET notes = 'Updated notes', updated_at = NOW()
WHERE id = 'order-uuid' 
AND user_id = auth.uid() 
AND status IN ('pending', 'failed');
```

#### **✅ ADMIN UPDATES (Order Management):**
```sql
-- Admin can update order status and tracking
UPDATE orders 
SET status = 'shipped', 
    tracking_number = 'TRK123456789',
    estimated_delivery = '2025-01-25',
    updated_at = NOW()
WHERE id = 'order-uuid';
```

#### **✅ SYSTEM UPDATES (Payment Processing):**
```sql
-- Webhook can update payment information
UPDATE orders 
SET payment_status = 'paid',
    clickpesa_transaction_id = 'CP123456789',
    payment_timestamp = NOW(),
    updated_at = NOW()
WHERE reference_id = 'webhook-reference';
```

#### **❌ FORBIDDEN UPDATES:**

**Customer cannot modify:**
```sql
-- Cannot change payment status
UPDATE orders SET payment_status = 'paid' WHERE id = 'order-uuid';
-- Error: Policy violation

-- Cannot change order status
UPDATE orders SET status = 'shipped' WHERE id = 'order-uuid';
-- Error: Policy violation

-- Cannot change total amount
UPDATE orders SET total_amount = 200000 WHERE id = 'order-uuid';
-- Error: Immutable field
```

**Admin cannot modify:**
```sql
-- Cannot change reference_id
UPDATE orders SET reference_id = 'new-ref' WHERE id = 'order-uuid';
-- Error: Immutable field

-- Cannot change pickup_id
UPDATE orders SET pickup_id = 'new-pickup' WHERE id = 'order-uuid';
-- Error: Immutable field

-- Cannot change shipping address
UPDATE orders SET shipping_address = '{"new": "address"}' WHERE id = 'order-uuid';
-- Error: Immutable field
```

**System cannot modify:**
```sql
-- Cannot change order status (only admin)
UPDATE orders SET status = 'confirmed' WHERE id = 'order-uuid';
-- Error: Policy violation (system can only update payment fields)
```

---

### **4. DELETE Policy: `orders_delete_restricted`**

#### **✅ ADMIN DELETES:**
```sql
-- Admin can delete any order
DELETE FROM orders WHERE id = 'any-order-uuid';
-- Success: Admin has full delete access
```

#### **✅ CUSTOMER DELETES (Limited):**
```sql
-- Customer can delete their own failed/unpaid orders
DELETE FROM orders 
WHERE id = 'order-uuid' 
AND user_id = auth.uid() 
AND payment_status IN ('failed', 'unpaid', 'pending')
AND status IN ('pending', 'failed');
```

#### **❌ FORBIDDEN DELETES:**
```sql
-- Customer cannot delete paid orders
DELETE FROM orders 
WHERE id = 'order-uuid' 
AND user_id = auth.uid() 
AND payment_status = 'paid';
-- Error: Policy violation

-- Customer cannot delete other users' orders
DELETE FROM orders 
WHERE id = 'other-user-order-uuid' 
AND user_id != auth.uid();
-- Error: Policy violation
```

---

## 🔐 **Immutable Fields Protection**

### **Database Trigger: `validate_order_immutability()`**

#### **Fields Protected by Trigger:**
```sql
-- These fields CANNOT be modified by ANYONE after creation:
- id                    -- Primary key
- order_number          -- Customer reference
- reference_id          -- Payment gateway ID
- pickup_id             -- Customer pickup ID
- user_id               -- Order owner
- total_amount          -- Order total
- currency              -- Order currency
- delivery_option       -- Shipping/pickup choice
- shipping_address      -- Delivery address
- billing_address       -- Billing address
- created_at            -- Creation timestamp
```

#### **Trigger Behavior:**
```sql
-- Any attempt to modify immutable fields raises exception
UPDATE orders SET reference_id = 'new-ref' WHERE id = 'order-uuid';
-- Error: Reference ID cannot be modified after creation

UPDATE orders SET total_amount = 200000 WHERE id = 'order-uuid';
-- Error: Total amount cannot be modified after creation

UPDATE orders SET shipping_address = '{"new": "address"}' WHERE id = 'order-uuid';
-- Error: Shipping address cannot be modified after creation
```

---

## 📊 **Access Matrix**

| Field | Customer | Admin | System/Webhook | Notes |
|-------|----------|-------|----------------|-------|
| **id** | ❌ Never | ✅ Read | ✅ Read | Primary key, never exposed to customers |
| **order_number** | ✅ Read | ✅ Read | ✅ Read | Customer-facing identifier |
| **reference_id** | ✅ Read | ✅ Read | ✅ Read | Payment gateway ID |
| **pickup_id** | ✅ Read | ✅ Read | ✅ Read | Customer pickup reference |
| **user_id** | ✅ Read | ✅ Read | ✅ Read | Order owner |
| **total_amount** | ✅ Read | ✅ Read | ✅ Read | Immutable after creation |
| **payment_status** | ✅ Read | ✅ Read | ✅ Update | System updates via webhook |
| **status** | ✅ Read | ✅ Update | ❌ No | Admin manages order status |
| **tracking_number** | ✅ Read | ✅ Update | ❌ No | Admin sets tracking |
| **notes** | ✅ Update | ✅ Update | ❌ No | Customer/Admin can update |
| **shipping_address** | ✅ Read | ✅ Read | ✅ Read | Immutable after creation |

---

## 🔍 **Audit Logging**

### **All Operations Logged:**
```sql
-- Every INSERT, UPDATE, DELETE is logged
INSERT INTO audit_log (
  table_name, operation, old_values, new_values, user_id, timestamp, ip_address
) VALUES (
  'orders', 'UPDATE', 
  '{"status": "pending"}', 
  '{"status": "shipped"}', 
  'admin-user-uuid', 
  NOW(), 
  '192.168.1.1'
);
```

### **Security Monitoring:**
```sql
-- Find all reference_id modification attempts
SELECT * FROM audit_log 
WHERE operation = 'UPDATE' 
AND old_values->>'reference_id' != new_values->>'reference_id';

-- Find all admin operations
SELECT * FROM audit_log 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'admin'
);

-- Find all failed order deletions
SELECT * FROM audit_log 
WHERE operation = 'DELETE' 
AND old_values->>'payment_status' = 'paid';
```

---

## 🎯 **Security Benefits**

### **1. Complete Data Protection:**
- **Immutable Fields**: Cannot be modified after creation
- **Role-Based Access**: Different permissions for different user types
- **Audit Trail**: Complete history of all operations

### **2. Granular Control:**
- **Field-Level Security**: Each field has specific access rules
- **Operation-Level Security**: Different rules for SELECT, INSERT, UPDATE, DELETE
- **Context-Aware Security**: Rules change based on user role and order state

### **3. Defense in Depth:**
- **RLS Policies**: Database-level protection
- **Triggers**: Function-level protection
- **Audit Logging**: Monitoring and alerting
- **API Validation**: Application-level protection

### **4. Compliance Ready:**
- **Data Integrity**: Immutable critical fields
- **Access Control**: Role-based permissions
- **Audit Trail**: Complete operation history
- **Security Monitoring**: Real-time violation detection

This comprehensive security model ensures that orders are completely protected with multiple layers of security! 🔒✨
