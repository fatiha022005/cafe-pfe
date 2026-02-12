-- ============================================================
--  CAFEPOS - SPLIT PAYMENTS (CASH + CARD)
--  Safe re-run migration for Supabase
-- ============================================================

-- 1) Orders: add split columns
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS cash_amount numeric,
    ADD COLUMN IF NOT EXISTS card_amount numeric;

-- 2) Expand payment_method check to include 'split'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'orders'
          AND constraint_name = 'orders_payment_method_check'
    ) THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_payment_method_check;
    END IF;
END $$;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'other', 'split') OR payment_method IS NULL);

-- 3) RPC: create order + items (adds split amounts)
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb, uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_user_id uuid,
    p_table_id uuid,
    p_payment_method text,
    p_items jsonb,
    p_session_id uuid DEFAULT NULL,
    p_cash_amount numeric DEFAULT NULL,
    p_card_amount numeric DEFAULT NULL
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

    IF p_payment_method NOT IN ('cash', 'card', 'other', 'split') THEN
        RAISE EXCEPTION 'invalid_payment_method';
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

    IF p_payment_method = 'split' THEN
        IF p_cash_amount IS NULL OR p_card_amount IS NULL THEN
            RAISE EXCEPTION 'split_amount_required';
        END IF;
        IF p_cash_amount < 0 OR p_card_amount < 0 THEN
            RAISE EXCEPTION 'invalid_split_amount';
        END IF;
        IF abs((p_cash_amount + p_card_amount) - v_total) > 0.01 THEN
            RAISE EXCEPTION 'split_amount_mismatch';
        END IF;
    END IF;

    INSERT INTO public.orders (user_id, table_id, status, total_amount, payment_method, session_id, cash_amount, card_amount)
    VALUES (
        p_user_id,
        p_table_id,
        'completed',
        v_total,
        p_payment_method,
        p_session_id,
        CASE
            WHEN p_payment_method = 'cash' THEN v_total
            WHEN p_payment_method = 'split' THEN p_cash_amount
            WHEN p_payment_method = 'card' THEN 0
            ELSE NULL
        END,
        CASE
            WHEN p_payment_method = 'card' THEN v_total
            WHEN p_payment_method = 'split' THEN p_card_amount
            WHEN p_payment_method = 'cash' THEN 0
            ELSE NULL
        END
    )
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

GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid, uuid, text, jsonb, uuid, numeric, numeric) TO anon, authenticated;

-- 4) RPC: complete pending order (adds split amounts)
DROP FUNCTION IF EXISTS public.complete_pending_order(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.complete_pending_order(uuid, uuid, text, uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.complete_pending_order(
    p_order_id uuid,
    p_user_id uuid,
    p_payment_method text,
    p_session_id uuid DEFAULT NULL,
    p_cash_amount numeric DEFAULT NULL,
    p_card_amount numeric DEFAULT NULL
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
BEGIN
    IF p_payment_method NOT IN ('cash', 'card', 'other', 'split') THEN
        RAISE EXCEPTION 'invalid_payment_method';
    END IF;

    SELECT o.total_amount INTO v_total
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.user_id = p_user_id
      AND o.status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order_not_found_or_not_pending';
    END IF;

    IF p_payment_method = 'split' THEN
        IF p_cash_amount IS NULL OR p_card_amount IS NULL THEN
            RAISE EXCEPTION 'split_amount_required';
        END IF;
        IF p_cash_amount < 0 OR p_card_amount < 0 THEN
            RAISE EXCEPTION 'invalid_split_amount';
        END IF;
        IF abs((p_cash_amount + p_card_amount) - v_total) > 0.01 THEN
            RAISE EXCEPTION 'split_amount_mismatch';
        END IF;
    END IF;

    UPDATE public.orders o
    SET status = 'completed',
        payment_method = p_payment_method,
        cash_amount = CASE
            WHEN p_payment_method = 'cash' THEN v_total
            WHEN p_payment_method = 'split' THEN p_cash_amount
            WHEN p_payment_method = 'card' THEN 0
            ELSE NULL
        END,
        card_amount = CASE
            WHEN p_payment_method = 'card' THEN v_total
            WHEN p_payment_method = 'split' THEN p_card_amount
            WHEN p_payment_method = 'cash' THEN 0
            ELSE NULL
        END,
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

GRANT EXECUTE ON FUNCTION public.complete_pending_order(uuid, uuid, text, uuid, numeric, numeric) TO anon, authenticated;
