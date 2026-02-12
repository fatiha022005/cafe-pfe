-- ============================================================
--  CAFEPOS - PENDING ORDER ITEM DAMAGE (MOBILE)
--  Safe re-run migration for Supabase
-- ============================================================

-- 1) Table: damaged items from pending orders
CREATE TABLE IF NOT EXISTS public.order_item_damages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID,
    product_id UUID NOT NULL REFERENCES public.products(id),
    user_id UUID REFERENCES public.users(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    reason_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_item_damages_order ON public.order_item_damages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_damages_product ON public.order_item_damages(product_id);

ALTER TABLE public.order_item_damages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF to_regclass('public.order_item_damages') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins can read item damages" ON public.order_item_damages;
        DROP POLICY IF EXISTS "Admins can insert item damages" ON public.order_item_damages;
        DROP POLICY IF EXISTS "Admins can update item damages" ON public.order_item_damages;
        DROP POLICY IF EXISTS "Admins can delete item damages" ON public.order_item_damages;
    END IF;
END $$;

CREATE POLICY "Admins can read item damages" ON public.order_item_damages
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert item damages" ON public.order_item_damages
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update item damages" ON public.order_item_damages
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete item damages" ON public.order_item_damages
FOR DELETE USING (public.is_admin());

-- 2) RPC: get pending order items
DROP FUNCTION IF EXISTS public.get_pending_order_items(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_pending_order_items(
    p_order_id uuid,
    p_user_id uuid
)
RETURNS TABLE (
    id uuid,
    product_id uuid,
    product_name text,
    quantity int,
    unit_price numeric,
    subtotal numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT oi.id,
           oi.product_id,
           p.name AS product_name,
           oi.quantity,
           oi.unit_price,
           oi.subtotal
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.id = p_order_id
      AND o.user_id = p_user_id
      AND o.status = 'pending'
    ORDER BY oi.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_order_items(uuid, uuid) TO anon, authenticated;

-- 3) RPC: remove item from pending order as damage
DROP FUNCTION IF EXISTS public.remove_pending_order_item_damage(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.remove_pending_order_item_damage(
    p_order_id uuid,
    p_item_id uuid,
    p_user_id uuid,
    p_reason_note text DEFAULT NULL
)
RETURNS TABLE (
    order_id uuid,
    order_number int,
    total_amount numeric,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item public.order_items%ROWTYPE;
    v_remaining int;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_required';
    END IF;

    SELECT * INTO v_order
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.user_id = p_user_id
      AND o.status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order_not_found_or_not_pending';
    END IF;

    SELECT * INTO v_item
    FROM public.order_items oi
    WHERE oi.id = p_item_id
      AND oi.order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'item_not_found';
    END IF;

    DELETE FROM public.order_items
    WHERE id = p_item_id;

    INSERT INTO public.order_item_damages (order_id, order_item_id, product_id, user_id, quantity, reason_note)
    VALUES (p_order_id, v_item.id, v_item.product_id, p_user_id, v_item.quantity, p_reason_note);

    SELECT COUNT(*) INTO v_remaining
    FROM public.order_items
    WHERE order_id = p_order_id;

    IF v_remaining = 0 THEN
        UPDATE public.orders
        SET status = 'cancelled',
            total_amount = 0,
            cancel_reason = 'damage',
            cancel_note = COALESCE(NULLIF(p_reason_note, ''), 'Tous les articles supprimes pour degat'),
            cancelled_at = now()
        WHERE id = p_order_id
        RETURNING * INTO v_order;
    ELSE
        UPDATE public.orders o
        SET total_amount = (
            SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
            FROM public.order_items oi
            WHERE oi.order_id = p_order_id
        )
        WHERE o.id = p_order_id
        RETURNING * INTO v_order;
    END IF;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_pending_order_item_damage(uuid, uuid, uuid, text) TO anon, authenticated;
