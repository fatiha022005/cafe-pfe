-- ============================================================
--  CAFEPOS - SCRIPT UNIQUE FINAL (RE-EXECUTABLE) - SUPABASE/PG
--  Includes:
--   - users/products/tables/orders/order_items/stock_logs
--   - sessions_serveurs + orders.session_id FK
--   - triggers updated_at
--   - RLS + policies (admin + mobile read products/tables)
--   - RPC: login_with_pin, create_order_with_items (stock+session),
--         get_orders_by_user, open/get/close_server_session
--   - Seed data
-- ============================================================

-- 0) EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1) CLEANUP (safe re-run)
-- ============================================================

-- 1.1 Drop RPC functions (drop both signatures where relevant)
DROP FUNCTION IF EXISTS public.login_with_pin(text);
DROP FUNCTION IF EXISTS public.get_orders_by_user(uuid);
DROP FUNCTION IF EXISTS public.get_order_items_by_order(uuid);
DROP FUNCTION IF EXISTS public.get_order_items_by_order(uuid, uuid);
DROP FUNCTION IF EXISTS public.open_server_session(uuid);
DROP FUNCTION IF EXISTS public.open_server_session(uuid, numeric);
DROP FUNCTION IF EXISTS public.get_open_session(uuid);
DROP FUNCTION IF EXISTS public.close_server_session(uuid);
DROP FUNCTION IF EXISTS public.close_server_session(uuid, numeric);
DROP FUNCTION IF EXISTS public.adjust_stock(uuid, uuid, int, text, text);
DROP FUNCTION IF EXISTS public.get_pending_order_items(uuid, uuid);
DROP FUNCTION IF EXISTS public.remove_pending_order_item_damage(uuid, uuid, uuid, text);

DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb, uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.upsert_pending_order_with_items(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.upsert_pending_order_with_items(uuid, uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.get_pending_orders(uuid);
DROP FUNCTION IF EXISTS public.complete_pending_order(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.complete_pending_order(uuid, uuid, text, uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.cancel_pending_order(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.cancel_order_item(uuid, uuid, int, text, text);

-- 1.2 Drop helper + trigger function
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- 1.3 Drop triggers (before dropping tables)
DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS update_users_modtime ON public.users;
    END IF;
    IF to_regclass('public.products') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS update_products_modtime ON public.products;
    END IF;
    IF to_regclass('public.tables') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS update_tables_modtime ON public.tables;
    END IF;
    IF to_regclass('public.orders') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS update_orders_modtime ON public.orders;
    END IF;
END $$;

-- 1.4 Drop tables in dependency order
DROP TABLE IF EXISTS public.stock_logs CASCADE;
DROP TABLE IF EXISTS public.order_item_damages CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.sessions_serveurs CASCADE;
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================
-- 2) TABLES
-- ============================================================

-- 2.1 USERS
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id), -- Supabase Auth link (optional)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'server')),
    pin_code TEXT UNIQUE CHECK (pin_code ~ '^[0-9]{4}$'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.2 PRODUCTS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    stock_quantity INT NOT NULL DEFAULT 0,
    min_stock_alert INT DEFAULT 10,
    description TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.3 TABLES (restaurant tables)
CREATE TABLE public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL UNIQUE,
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.4 SESSIONS SERVEURS (sans cash)
CREATE TABLE public.sessions_serveurs (
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

-- Unique open session per user
CREATE UNIQUE INDEX sessions_serveurs_open_unique
ON public.sessions_serveurs(user_id)
WHERE end_time IS NULL;

-- 2.5 ORDERS (add session_id)
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number SERIAL,
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'other', 'split')),
    cash_amount DECIMAL(10, 2) DEFAULT 0,
    card_amount DECIMAL(10, 2) DEFAULT 0,
    cancel_reason TEXT,
    cancel_note TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT orders_order_number_key UNIQUE (order_number)
);

-- Ensure session_id exists for existing databases
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

-- 2.6 ORDER ITEMS
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    cancelled_quantity INT NOT NULL DEFAULT 0 CHECK (cancelled_quantity >= 0 AND cancelled_quantity <= quantity),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    cancel_reason TEXT,
    cancel_note TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    net_quantity INT GENERATED ALWAYS AS (GREATEST(quantity - cancelled_quantity, 0)) STORED,
    net_subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (GREATEST(quantity - cancelled_quantity, 0) * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.7 ORDER ITEM DAMAGES
CREATE TABLE public.order_item_damages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID,
    product_id UUID NOT NULL REFERENCES public.products(id),
    user_id UUID REFERENCES public.users(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    reason_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.8 STOCK LOGS
CREATE TABLE public.stock_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    change_amount INT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('sale', 'restock', 'correction', 'damage', 'waste', 'cancel')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================
-- 3) INDEXES
-- ============================================================
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_pin ON public.users(pin_code);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_tables_label ON public.tables(label);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_table ON public.orders(table_id);
CREATE INDEX idx_orders_session ON public.orders(session_id);
CREATE INDEX idx_orders_date ON public.orders(created_at);
CREATE INDEX idx_order_item_damages_order ON public.order_item_damages(order_id);
CREATE INDEX idx_order_item_damages_product ON public.order_item_damages(product_id);
CREATE INDEX idx_stock_logs_product ON public.stock_logs(product_id);

-- ============================================================
-- 4) TRIGGERS updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_products_modtime
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_tables_modtime
BEFORE UPDATE ON public.tables
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_orders_modtime
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ============================================================
-- 5) RLS ENABLE
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions_serveurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6) HELPER: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users
        WHERE auth_user_id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$$;

-- ============================================================
-- 7) POLICIES (drop + create)
-- ============================================================

-- USERS
DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
        DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
        DROP POLICY IF EXISTS "Admins can update users" ON public.users;
        DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
    END IF;
END $$;

CREATE POLICY "Users can read own profile" ON public.users
FOR SELECT USING (auth.uid() = auth_user_id OR public.is_admin());

CREATE POLICY "Admins can insert users" ON public.users
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update users" ON public.users
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users
FOR DELETE USING (public.is_admin());

-- PRODUCTS (mobile read)
DO $$
BEGIN
    IF to_regclass('public.products') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Mobile can read products" ON public.products;
        DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
        DROP POLICY IF EXISTS "Admins can update products" ON public.products;
        DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
    END IF;
END $$;

CREATE POLICY "Mobile can read products" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Admins can insert products" ON public.products
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products" ON public.products
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete products" ON public.products
FOR DELETE USING (public.is_admin());

-- TABLES (mobile read)
DO $$
BEGIN
    IF to_regclass('public.tables') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Mobile can read tables" ON public.tables;
        DROP POLICY IF EXISTS "Admins can insert tables" ON public.tables;
        DROP POLICY IF EXISTS "Admins can update tables" ON public.tables;
        DROP POLICY IF EXISTS "Admins can delete tables" ON public.tables;
    END IF;
END $$;

CREATE POLICY "Mobile can read tables" ON public.tables
FOR SELECT USING (true);

CREATE POLICY "Admins can insert tables" ON public.tables
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update tables" ON public.tables
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tables" ON public.tables
FOR DELETE USING (public.is_admin());

-- SESSIONS (admin only)
DO $$
BEGIN
    IF to_regclass('public.sessions_serveurs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins can read sessions" ON public.sessions_serveurs;
        DROP POLICY IF EXISTS "Admins can insert sessions" ON public.sessions_serveurs;
        DROP POLICY IF EXISTS "Admins can update sessions" ON public.sessions_serveurs;
        DROP POLICY IF EXISTS "Admins can delete sessions" ON public.sessions_serveurs;
    END IF;
END $$;

CREATE POLICY "Admins can read sessions" ON public.sessions_serveurs
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert sessions" ON public.sessions_serveurs
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update sessions" ON public.sessions_serveurs
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete sessions" ON public.sessions_serveurs
FOR DELETE USING (public.is_admin());

-- ORDERS (admin only)
DO $$
BEGIN
    IF to_regclass('public.orders') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
        DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
        DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
        DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
    END IF;
END $$;

CREATE POLICY "Admins can read orders" ON public.orders
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE USING (public.is_admin());

-- ORDER ITEMS (admin only)
DO $$
BEGIN
    IF to_regclass('public.order_items') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins can read items" ON public.order_items;
        DROP POLICY IF EXISTS "Admins can insert items" ON public.order_items;
        DROP POLICY IF EXISTS "Admins can update items" ON public.order_items;
        DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;
    END IF;
END $$;

CREATE POLICY "Admins can read items" ON public.order_items
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert items" ON public.order_items
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update items" ON public.order_items
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete items" ON public.order_items
FOR DELETE USING (public.is_admin());

-- ORDER ITEM DAMAGES (admin only)
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

-- STOCK LOGS (admin only)
DO $$
BEGIN
    IF to_regclass('public.stock_logs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins can read stock logs" ON public.stock_logs;
        DROP POLICY IF EXISTS "Admins can insert stock logs" ON public.stock_logs;
        DROP POLICY IF EXISTS "Admins can update stock logs" ON public.stock_logs;
        DROP POLICY IF EXISTS "Admins can delete stock logs" ON public.stock_logs;
    END IF;
END $$;

CREATE POLICY "Admins can read stock logs" ON public.stock_logs
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert stock logs" ON public.stock_logs
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update stock logs" ON public.stock_logs
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete stock logs" ON public.stock_logs
FOR DELETE USING (public.is_admin());

-- ============================================================
-- 8) RPC FUNCTIONS (MOBILE)
-- ============================================================

-- 8.1 Login by PIN
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

-- 8.2 Open server session (reuse existing open)
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
    FROM public.sessions_serveurs
    WHERE user_id = p_user_id AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY
        SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
               v_session.total_collecte;
        RETURN;
    END IF;

    INSERT INTO public.sessions_serveurs (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_session;

    RETURN QUERY
    SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
           v_session.total_collecte;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_server_session(uuid) TO anon, authenticated;

-- 8.3 Get open session
CREATE OR REPLACE FUNCTION public.get_open_session(p_user_id uuid)
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

-- 8.4 Close session (recalculate total_collecte from orders)
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

    RETURN QUERY
    SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
           v_session.total_collecte;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_server_session(uuid) TO anon, authenticated;

-- 8.5 Create order + items (updates stock + stock_logs + session_id)
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
    v_cash numeric;
    v_card numeric;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_required';
    END IF;
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'session_required';
    END IF;
    IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'card', 'other', 'split') THEN
        RAISE EXCEPTION 'invalid_payment_method';
    END IF;
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

    v_cash := COALESCE(p_cash_amount, CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END);
    v_card := COALESCE(p_card_amount, CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END);
    IF p_payment_method = 'split' THEN
        v_cash := COALESCE(p_cash_amount, 0);
        v_card := COALESCE(p_card_amount, 0);
    END IF;

    INSERT INTO public.orders (user_id, table_id, status, total_amount, payment_method, session_id, cash_amount, card_amount)
    VALUES (p_user_id, p_table_id, 'completed', v_total, p_payment_method, p_session_id, v_cash, v_card)
    RETURNING * INTO v_order;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        v_price := (v_item->>'unit_price')::numeric;

        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order.id, v_product_id, v_qty, v_price);

        UPDATE public.products
        SET stock_quantity = COALESCE(stock_quantity, 0) - v_qty
        WHERE id = v_product_id
          AND COALESCE(stock_quantity, 0) >= v_qty;

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

-- 8.6 Pending order upsert (mobile)
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
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_required';
    END IF;
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'session_required';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items_required';
    END IF;

    PERFORM 1
    FROM public.users u
    WHERE u.id = p_user_id AND u.is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'user_not_active';
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

    SELECT *
    INTO v_order
    FROM public.orders
    WHERE status = 'pending'
      AND user_id = p_user_id
      AND table_id IS NOT DISTINCT FROM p_table_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.orders
        SET total_amount = v_total,
            table_id = p_table_id,
            session_id = p_session_id,
            updated_at = now()
        WHERE id = v_order.id
        RETURNING * INTO v_order;

        DELETE FROM public.order_items WHERE order_id = v_order.id;
    ELSE
        INSERT INTO public.orders (user_id, table_id, status, total_amount, session_id)
        VALUES (p_user_id, p_table_id, 'pending', v_total, p_session_id)
        RETURNING * INTO v_order;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        v_price := (v_item->>'unit_price')::numeric;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;

        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order.id, v_product_id, v_qty, v_price);
    END LOOP;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.payment_method, v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_pending_order_with_items(uuid, uuid, jsonb, uuid) TO anon, authenticated;

-- 8.7 Pending orders list
CREATE OR REPLACE FUNCTION public.get_pending_orders(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    order_number int,
    total_amount numeric,
    created_at timestamptz,
    status text,
    user_id uuid,
    table_id uuid,
    table_label text,
    session_id uuid,
    cancel_reason text,
    cancel_note text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id, o.order_number, o.total_amount, o.created_at, o.status,
           o.user_id, o.table_id, t.label as table_label, o.session_id,
           o.cancel_reason, o.cancel_note
    FROM public.orders o
    LEFT JOIN public.tables t ON t.id = o.table_id
    WHERE o.status = 'pending'
      AND (p_user_id IS NULL OR o.user_id = p_user_id)
    ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_orders(uuid) TO anon, authenticated;

-- 8.8 Complete pending order (payment + stock)
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
    v_item record;
    v_cash numeric;
    v_card numeric;
    v_session uuid;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'order_required';
    END IF;
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_required';
    END IF;
    IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'card', 'other', 'split') THEN
        RAISE EXCEPTION 'invalid_payment_method';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order_not_found_or_not_pending';
    END IF;

    v_session := COALESCE(p_session_id, v_order.session_id);
    IF v_session IS NULL THEN
        RAISE EXCEPTION 'session_required';
    END IF;

    SELECT COALESCE(SUM(oi.net_subtotal), 0)
    INTO v_total
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id;

    IF EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
          AND COALESCE(p.stock_quantity, 0) < COALESCE(oi.net_quantity, 0)
    ) THEN
        RAISE EXCEPTION 'insufficient_stock';
    END IF;

    v_cash := COALESCE(p_cash_amount, CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END);
    v_card := COALESCE(p_card_amount, CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END);
    IF p_payment_method = 'split' THEN
        v_cash := COALESCE(p_cash_amount, 0);
        v_card := COALESCE(p_card_amount, 0);
    END IF;

    UPDATE public.orders
    SET status = 'completed',
        total_amount = v_total,
        payment_method = p_payment_method,
        session_id = v_session,
        cash_amount = v_cash,
        card_amount = v_card,
        updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    FOR v_item IN
        SELECT oi.product_id, oi.net_quantity AS qty
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.net_quantity > 0
    LOOP
        UPDATE public.products
        SET stock_quantity = COALESCE(stock_quantity, 0) - v_item.qty
        WHERE id = v_item.product_id
          AND COALESCE(stock_quantity, 0) >= v_item.qty;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_stock';
        END IF;

        INSERT INTO public.stock_logs (product_id, user_id, change_amount, reason, notes)
        VALUES (v_item.product_id, p_user_id, -v_item.qty, 'sale', 'Mobile POS');
    END LOOP;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.payment_method, v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_pending_order(uuid, uuid, text, uuid, numeric, numeric) TO anon, authenticated;

-- 8.9 Cancel pending order (no stock movement)
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
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'order_required';
    END IF;
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_required';
    END IF;

    UPDATE public.orders
    SET status = 'cancelled',
        cancel_reason = p_reason,
        cancel_note = p_note,
        cancelled_at = now(),
        cancelled_by = p_user_id,
        updated_at = now()
    WHERE id = p_order_id AND status = 'pending'
    RETURNING * INTO v_order;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order_not_found_or_not_pending';
    END IF;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.payment_method, v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_pending_order(uuid, uuid, text, text) TO anon, authenticated;

-- 8.10 Get order items (mobile/admin)
CREATE OR REPLACE FUNCTION public.get_order_items_by_order(
    p_order_id uuid,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    order_id uuid,
    product_id uuid,
    product_name text,
    quantity int,
    cancelled_quantity int,
    unit_price numeric,
    net_quantity int,
    net_subtotal numeric,
    status text,
    cancel_reason text,
    cancel_note text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_user uuid;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'order_required';
    END IF;

    SELECT user_id INTO v_order_user
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order_user IS NULL THEN
        RAISE EXCEPTION 'order_not_found';
    END IF;

    IF NOT public.is_admin() THEN
        IF p_user_id IS NULL OR p_user_id <> v_order_user THEN
            RAISE EXCEPTION 'not_authorized';
        END IF;
        PERFORM 1 FROM public.users u WHERE u.id = p_user_id AND u.is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'not_authorized';
        END IF;
    END IF;

    RETURN QUERY
    SELECT oi.id, oi.order_id, oi.product_id, p.name, oi.quantity, oi.cancelled_quantity,
           oi.unit_price, oi.net_quantity, oi.net_subtotal, oi.status,
           oi.cancel_reason, oi.cancel_note, oi.created_at
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
    ORDER BY oi.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_items_by_order(uuid, uuid) TO anon, authenticated;

-- 8.11 Cancel item from completed order (partial possible)
CREATE OR REPLACE FUNCTION public.cancel_order_item(
    p_order_item_id uuid,
    p_user_id uuid,
    p_cancel_qty int DEFAULT NULL,
    p_reason text DEFAULT NULL,
    p_note text DEFAULT NULL
)
RETURNS TABLE (
    order_id uuid,
    order_item_id uuid,
    total_amount numeric,
    status text,
    cancelled_quantity int,
    net_quantity int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item record;
    v_order record;
    v_remaining int;
    v_cancel int;
    v_open_items int;
BEGIN
    IF p_order_item_id IS NULL THEN
        RAISE EXCEPTION 'item_required';
    END IF;

    SELECT oi.*, o.id AS order_id, o.status AS order_status, o.total_amount AS order_total, o.user_id AS order_user_id
    INTO v_item
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = p_order_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'item_not_found';
    END IF;

    IF v_item.order_status <> 'completed' THEN
        RAISE EXCEPTION 'order_not_completed';
    END IF;

    IF NOT public.is_admin() THEN
        IF p_user_id IS NULL OR p_user_id <> v_item.order_user_id THEN
            RAISE EXCEPTION 'not_authorized';
        END IF;
        PERFORM 1 FROM public.users u WHERE u.id = p_user_id AND u.is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'not_authorized';
        END IF;
    END IF;

    v_remaining := COALESCE(v_item.quantity, 0) - COALESCE(v_item.cancelled_quantity, 0);
    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'item_already_cancelled';
    END IF;

    v_cancel := COALESCE(p_cancel_qty, v_remaining);
    IF v_cancel <= 0 OR v_cancel > v_remaining THEN
        RAISE EXCEPTION 'invalid_cancel_qty';
    END IF;

    UPDATE public.order_items
    SET cancelled_quantity = cancelled_quantity + v_cancel,
        cancel_reason = p_reason,
        cancel_note = p_note,
        cancelled_at = now(),
        cancelled_by = p_user_id,
        status = CASE WHEN cancelled_quantity + v_cancel >= quantity THEN 'cancelled' ELSE status END
    WHERE id = p_order_item_id;

    UPDATE public.orders
    SET total_amount = GREATEST(total_amount - (v_cancel * v_item.unit_price), 0),
        updated_at = now()
    WHERE id = v_item.order_id
    RETURNING * INTO v_order;

    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_cancel
    WHERE id = v_item.product_id;

    INSERT INTO public.stock_logs (product_id, user_id, change_amount, reason, notes)
    VALUES (v_item.product_id, p_user_id, v_cancel, 'cancel', COALESCE(p_note, 'Annulation article'));

    SELECT COUNT(*) INTO v_open_items
    FROM public.order_items
    WHERE order_id = v_item.order_id AND net_quantity > 0;

    IF v_open_items = 0 THEN
        UPDATE public.orders
        SET status = 'cancelled',
            cancel_reason = COALESCE(p_reason, cancel_reason),
            cancel_note = COALESCE(p_note, cancel_note),
            cancelled_at = now(),
            cancelled_by = p_user_id,
            updated_at = now()
        WHERE id = v_item.order_id;
    END IF;

    RETURN QUERY
    SELECT v_item.order_id, v_item.id, v_order.total_amount, v_order.status,
           v_item.cancelled_quantity + v_cancel, GREATEST(v_item.quantity - (v_item.cancelled_quantity + v_cancel), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order_item(uuid, uuid, int, text, text) TO anon, authenticated;

-- 8.12 Orders history by user
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
    table_label text,
    session_id uuid,
    cash_amount numeric,
    card_amount numeric,
    cancel_reason text,
    cancel_note text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id, o.order_number, o.total_amount, o.created_at, o.payment_method, o.status,
           o.user_id, o.table_id, t.label as table_label, o.session_id,
           o.cash_amount, o.card_amount, o.cancel_reason, o.cancel_note
    FROM public.orders o
    LEFT JOIN public.tables t ON t.id = o.table_id
    WHERE o.user_id = p_user_id
      AND o.status = 'completed'
    ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_by_user(uuid) TO anon, authenticated;

-- 8.13 Pending order items (mobile)
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

-- 8.14 Adjust stock + log (admin only)
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_user_id uuid,
    p_product_id uuid,
    p_change_amount int,
    p_reason text,
    p_notes text DEFAULT NULL
)
RETURNS TABLE (
    product_id uuid,
    stock_quantity int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock int;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    IF p_change_amount IS NULL OR p_change_amount = 0 THEN
        RAISE EXCEPTION 'change_amount_required';
    END IF;

    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + p_change_amount
    WHERE id = p_product_id
    RETURNING stock_quantity INTO v_stock;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product_not_found';
    END IF;

    INSERT INTO public.stock_logs (product_id, user_id, change_amount, reason, notes)
    VALUES (p_product_id, p_user_id, p_change_amount, p_reason, p_notes);

    RETURN QUERY SELECT p_product_id, v_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, int, text, text) TO authenticated;

-- ============================================================
-- 9) SEED DATA
-- ============================================================

-- Admin (auth user must be created separately in Supabase Auth)
INSERT INTO public.users (first_name, last_name, email, role, pin_code)
VALUES ('Admin', 'Principal', 'admin@cafepos.com', 'admin', '0000');

-- Servers
INSERT INTO public.users (first_name, last_name, role, pin_code) VALUES
('Thomas', 'Serveur', 'server', '1234'),
('Sarah', 'Matin', 'server', '5678');

-- Tables
INSERT INTO public.tables (label, capacity) VALUES
('T1', 2), ('T2', 2), ('T3', 4), ('T4', 4), ('T5', 6),
('T6', 2), ('T7', 4), ('T8', 6), ('T9', 2), ('T10', 4);

-- Products
INSERT INTO public.products (name, category, price, cost, stock_quantity) VALUES
('Espresso', 'Café', 2.00, 0.40, 500),
('Cappuccino', 'Café', 3.50, 0.80, 200),
('Croissant', 'Nourriture', 2.50, 0.50, 40),
('Jus d''Orange', 'Boissons Froides', 4.00, 1.00, 50);
