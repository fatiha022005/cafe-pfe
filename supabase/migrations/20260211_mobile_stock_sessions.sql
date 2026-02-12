-- Stock + sessions serveurs (mobile) - version sans cash
-- Run this in Supabase SQL editor (same project as the web dashboard).

-- 1) Table sessions_serveurs
CREATE TABLE IF NOT EXISTS public.sessions_serveurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    total_collecte DECIMAL(10,2) DEFAULT 0
);

-- Remove cash columns if they exist from previous version
ALTER TABLE IF EXISTS public.sessions_serveurs
    DROP COLUMN IF EXISTS opening_cash,
    DROP COLUMN IF EXISTS closing_cash;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_serveurs_open_unique
ON public.sessions_serveurs(user_id)
WHERE end_time IS NULL;

ALTER TABLE public.sessions_serveurs ENABLE ROW LEVEL SECURITY;

-- 2) Orders: add session_id + FK
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS session_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'orders_session_id_fkey'
          AND table_name = 'orders'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_session_id_fkey
            FOREIGN KEY (session_id) REFERENCES public.sessions_serveurs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3) RPC: open session (reuse existing open session)
CREATE OR REPLACE FUNCTION public.open_server_session(
    p_user_id uuid
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    start_time timestamptz,
    end_time timestamptz,
    total_collecte numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.sessions_serveurs%ROWTYPE;
BEGIN
    SELECT * INTO v_session
    FROM public.sessions_serveurs s
    WHERE s.user_id = p_user_id AND s.end_time IS NULL
    ORDER BY s.start_time DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
                             v_session.total_collecte;
        RETURN;
    END IF;

    INSERT INTO public.sessions_serveurs (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_session;

    RETURN QUERY SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
                         v_session.total_collecte;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_server_session(uuid) TO anon, authenticated;

-- 4) RPC: get open session
CREATE OR REPLACE FUNCTION public.get_open_session(
    p_user_id uuid
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    start_time timestamptz,
    end_time timestamptz,
    total_collecte numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.id, s.user_id, s.start_time, s.end_time, s.total_collecte
    FROM public.sessions_serveurs s
    WHERE s.user_id = p_user_id AND s.end_time IS NULL
    ORDER BY s.start_time DESC
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_session(uuid) TO anon, authenticated;

-- 5) RPC: close session
CREATE OR REPLACE FUNCTION public.close_server_session(
    p_session_id uuid
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    start_time timestamptz,
    end_time timestamptz,
    total_collecte numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.sessions_serveurs%ROWTYPE;
BEGIN
    UPDATE public.sessions_serveurs s
    SET end_time = now(),
        total_collecte = (
            SELECT COALESCE(SUM(o.total_amount), 0)
            FROM public.orders o
            WHERE o.session_id = s.id AND o.status = 'completed'
        )
    WHERE s.id = p_session_id
    RETURNING * INTO v_session;

    RETURN QUERY SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
                         v_session.total_collecte;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_server_session(uuid) TO anon, authenticated;

-- 6) Replace create_order_with_items: update stock + stock_logs + session_id
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_user_id uuid,
    p_table_id uuid,
    p_payment_method text,
    p_items jsonb,
    p_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    order_number int,
    total_amount numeric,
    created_at timestamptz,
    payment_method text,
    status text,
    user_id uuid,
    table_id uuid,
    session_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_total numeric;
    v_item jsonb;
    v_product_id uuid;
    v_qty int;
    v_price numeric;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items_required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS item
        LEFT JOIN public.products p ON p.id = (item->>'product_id')::uuid
        WHERE p.id IS NULL
    ) THEN
        RAISE EXCEPTION 'product_not_found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS item
        JOIN public.products p ON p.id = (item->>'product_id')::uuid
        WHERE COALESCE(p.stock_quantity, 0) < (item->>'quantity')::int
    ) THEN
        RAISE EXCEPTION 'insufficient_stock';
    END IF;

    SELECT COALESCE(SUM((item->>'quantity')::int * (item->>'unit_price')::numeric), 0)
    INTO v_total
    FROM jsonb_array_elements(p_items) AS item;

    INSERT INTO public.orders (user_id, table_id, status, total_amount, payment_method, session_id)
    VALUES (p_user_id, p_table_id, 'completed', v_total, p_payment_method, p_session_id)
    RETURNING * INTO v_order;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        v_price := (v_item->>'unit_price')::numeric;

        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order.id, v_product_id, v_qty, v_price);

        UPDATE public.products p
        SET stock_quantity = COALESCE(p.stock_quantity, 0) - v_qty
        WHERE p.id = v_product_id
          AND COALESCE(p.stock_quantity, 0) >= v_qty;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_stock';
        END IF;

        INSERT INTO public.stock_logs (product_id, user_id, change_amount, reason, notes)
        VALUES (v_product_id, p_user_id, -v_qty, 'sale', 'Mobile POS');
    END LOOP;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.payment_method, v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid, uuid, text, jsonb, uuid) TO anon, authenticated;
