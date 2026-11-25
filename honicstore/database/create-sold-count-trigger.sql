-- Create trigger to update sold_count and buyers_count when order is paid
-- This trigger fires when an order's payment_status changes to 'paid' or 'success'

-- Step 1: Create function to update sold_count and buyers_count
CREATE OR REPLACE FUNCTION update_product_sold_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update when payment_status changes to 'paid' or 'success'
    -- AND the previous status was NOT 'paid' or 'success' (to avoid double counting)
    IF (NEW.payment_status IN ('paid', 'success') 
        AND OLD.payment_status NOT IN ('paid', 'success')) THEN
        
        -- Update sold_count and buyers_count for each product in order_items
        UPDATE products
        SET 
            sold_count = COALESCE(sold_count, 0) + (
                SELECT COALESCE(SUM(oi.quantity), 0)
                FROM order_items oi
                WHERE oi.order_id = NEW.id
                AND oi.product_id = products.id
            ),
            buyers_count = (
                SELECT COUNT(DISTINCT o.user_id)
                FROM orders o
                INNER JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.product_id = products.id
                AND o.payment_status IN ('paid', 'success')
                AND o.user_id IS NOT NULL
            ),
            updated_at = NOW()
        WHERE id IN (
            SELECT DISTINCT product_id
            FROM order_items
            WHERE order_id = NEW.id
        );
        
    -- If payment_status changes FROM 'paid'/'success' TO something else (refund/cancellation)
    ELSIF (OLD.payment_status IN ('paid', 'success') 
           AND NEW.payment_status NOT IN ('paid', 'success')) THEN
        
        -- Decrement sold_count (but keep buyers_count as is - once a buyer, always counted)
        UPDATE products
        SET 
            sold_count = GREATEST(0, COALESCE(sold_count, 0) - (
                SELECT COALESCE(SUM(oi.quantity), 0)
                FROM order_items oi
                WHERE oi.order_id = NEW.id
                AND oi.product_id = products.id
            )),
            updated_at = NOW()
        WHERE id IN (
            SELECT DISTINCT product_id
            FROM order_items
            WHERE order_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_update_product_sold_count ON orders;

CREATE TRIGGER trigger_update_product_sold_count
AFTER UPDATE OF payment_status ON orders
FOR EACH ROW
WHEN (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
EXECUTE FUNCTION update_product_sold_count();

-- Step 3: Verify trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_product_sold_count';
