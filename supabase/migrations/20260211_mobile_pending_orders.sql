-- ============================================================
--  CAFEPOS - PENDING ORDERS + CANCELLATION REASONS (MOBILE)
--  Safe re-run migration for Supabase
-- ============================================================

-- 1) Orders: cancellation fields
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS cancel_reason text,
    ADD COLUMN IF NOT EXISTS cancel_note text,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'orders'
          AND constraint_name = 'orders_cancel_reason_check'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_cancel_reason_check
            CHECK (cancel_reason IN ('damage', 'loss') OR cancel_reason IS NULL);
    END IF;
END $$;

-- 2) RPC: get pending orders for a user
DROP FUNCTION IF EXISTS public.get_pending_orders(uuid);

CREATE OR REPLACE FUNCTION public.get_pending_orders(
    p_user_id uuid
)
RETURNS TABLE (
    id uuid,
    order_number int,
    total_amount numeric,
    created_at timestamptz,
    status text,
    user_id uuid,
    table_id uuid,
    table_label text,
    session_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id,
           o.order_number,
           o.total_amount,
           o.created_at,
           o.status,
           o.user_id,
           o.table_id,
           t.label AS table_label,
           o.session_id
    FROM public.orders o
    LEFT JOIN public.tables t ON t.id = o.table_id
    WHERE o.user_id = p_user_id
      AND o.status = 'pending'
    ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_orders(uuid) TO anon, authenticated;

-- 3) RPC: create or append a pending order (merge by same table + user)
DROP FUNCTION IF EXISTS public.upsert_pending_order_with_items(uuid, uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.upsert_pending_order_with_items(
    p_user_id uuid,
    p_table_id uuid,
    p_items jsonb,
    p_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    order_number int,
    total_amount numeric,
    created_at timestamptz,
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
    v_has_order boolean := false;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_required';
    END IF;

    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'session_required';
    END IF;

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

    IF p_table_id IS NOT NULL THEN
        SELECT * INTO v_order
        FROM public.orders o
        WHERE o.table_id = p_table_id
          AND o.user_id = p_user_id
          AND o.status = 'pending'
          AND (p_session_id IS NULL OR o.session_id = p_session_id)
        ORDER BY o.created_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_has_order := true;
        END IF;
    END IF;

    IF NOT v_has_order THEN
        INSERT INTO public.orders (user_id, table_id, status, total_amount, payment_method, session_id)
        VALUES (p_user_id, p_table_id, 'pending', 0, NULL, p_session_id)
        RETURNING * INTO v_order;
    END IF;

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
        VALUES (v_product_id, p_user_id, -v_qty, 'sale', 'Mobile POS (pending)');
    END LOOP;

    SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
    INTO v_total
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id;

    UPDATE public.orders o
    SET total_amount = v_total
    WHERE o.id = v_order.id
    RETURNING * INTO v_order;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_pending_order_with_items(uuid, uuid, jsonb, uuid) TO anon, authenticated;

-- 4) RPC: complete pending order (payment)
DROP FUNCTION IF EXISTS public.complete_pending_order(uuid, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.complete_pending_order(
    p_order_id uuid,
    p_user_id uuid,
    p_payment_method text,
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
BEGIN
    IF p_payment_method NOT IN ('cash', 'card', 'other') THEN
        RAISE EXCEPTION 'invalid_payment_method';
    END IF;

    UPDATE public.orders o
    SET status = 'completed',
        payment_method = p_payment_method,
        session_id = COALESCE(o.session_id, p_session_id)
    WHERE o.id = p_order_id
      AND o.user_id = p_user_id
      AND o.status = 'pending'
    RETURNING * INTO v_order;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order_not_found_or_not_pending';
    END IF;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.payment_method, v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_pending_order(uuid, uuid, text, uuid) TO anon, authenticated;

-- 5) RPC: cancel pending order with reason
DROP FUNCTION IF EXISTS public.cancel_pending_order(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.cancel_pending_order(
    p_order_id uuid,
    p_user_id uuid,
    p_reason text,
    p_note text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    order_number int,
    total_amount numeric,
    created_at timestamptz,
    status text,
    user_id uuid,
    table_id uuid,
    session_id uuid,
    cancel_reason text,
    cancel_note text,
    cancelled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
BEGIN
    IF p_reason NOT IN ('damage', 'loss') THEN
        RAISE EXCEPTION 'invalid_reason';
    END IF;

    UPDATE public.orders o
    SET status = 'cancelled',
        cancel_reason = p_reason,
        cancel_note = p_note,
        cancelled_at = now()
    WHERE o.id = p_order_id
      AND o.user_id = p_user_id
      AND o.status = 'pending'
    RETURNING * INTO v_order;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order_not_found_or_not_pending';
    END IF;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.status, v_order.user_id, v_order.table_id, v_order.session_id,
           v_order.cancel_reason, v_order.cancel_note, v_order.cancelled_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_pending_order(uuid, uuid, text, text) TO anon, authenticated;
