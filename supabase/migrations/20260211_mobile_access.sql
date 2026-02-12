-- Mobile access: login + orders RPC + read-only products/tables
-- Run this in Supabase SQL editor (same project as the web dashboard).

-- 1) Allow mobile to read products & tables
DROP POLICY IF EXISTS "Mobile can read products" ON public.products;
CREATE POLICY "Mobile can read products" ON public.products
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mobile can read tables" ON public.tables;
CREATE POLICY "Mobile can read tables" ON public.tables
FOR SELECT USING (true);

-- 2) Login with PIN (no direct select on users from client)
CREATE OR REPLACE FUNCTION public.login_with_pin(p_pin text)
RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    role text,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.first_name, u.last_name, u.role, u.is_active
    FROM public.users u
    WHERE u.pin_code = p_pin
      AND u.is_active = true
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_with_pin(text) TO anon, authenticated;

-- NOTE: create_order_with_items is defined in 20260211_mobile_stock_sessions.sql

-- 3) History by user (bypass RLS)
CREATE OR REPLACE FUNCTION public.get_orders_by_user(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    order_number int,
    total_amount numeric,
    created_at timestamptz,
    payment_method text,
    status text,
    user_id uuid,
    table_id uuid,
    table_label text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id, o.order_number, o.total_amount, o.created_at, o.payment_method, o.status,
           o.user_id, o.table_id, t.label as table_label
    FROM public.orders o
    LEFT JOIN public.tables t ON t.id = o.table_id
    WHERE o.user_id = p_user_id
      AND o.status = 'completed'
    ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_by_user(uuid) TO anon, authenticated;
