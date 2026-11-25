-- Check if trigger exists for updating sold_count
-- Run this in Supabase SQL Editor to check current triggers

-- 1. Check existing triggers on orders table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'orders'
ORDER BY trigger_name;

-- 2. Check existing triggers on order_items table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'order_items'
ORDER BY trigger_name;

-- 3. Check if sold_count column exists in products table
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('sold_count', 'buyers_count');

-- 4. Check existing functions that might update sold_count
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_definition ILIKE '%sold_count%' 
    OR routine_definition ILIKE '%buyers_count%'
)
ORDER BY routine_name;
