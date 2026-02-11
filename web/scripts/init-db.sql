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
DROP FUNCTION IF EXISTS public.open_server_session(uuid, numeric);
DROP FUNCTION IF EXISTS public.get_open_session(uuid);
DROP FUNCTION IF EXISTS public.close_server_session(uuid, numeric);

DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, jsonb, uuid);

-- 1.2 Drop helper + trigger function
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- 1.3 Drop triggers (before dropping tables)
DROP TRIGGER IF EXISTS update_users_modtime ON public.users;
DROP TRIGGER IF EXISTS update_products_modtime ON public.products;
DROP TRIGGER IF EXISTS update_tables_modtime ON public.tables;
DROP TRIGGER IF EXISTS update_orders_modtime ON public.orders;

-- 1.4 Drop tables in dependency order
DROP TABLE IF EXISTS public.stock_logs CASCADE;
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

-- 2.4 SESSIONS SERVEURS
CREATE TABLE public.sessions_serveurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    total_collecte DECIMAL(10,2) DEFAULT 0,
    opening_cash DECIMAL(10,2) DEFAULT 0,
    closing_cash DECIMAL(10,2)
);

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
    session_id UUID REFERENCES public.sessions_serveurs(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT orders_order_number_key UNIQUE (order_number)
);

-- 2.6 ORDER ITEMS
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.7 STOCK LOGS
CREATE TABLE public.stock_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    change_amount INT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('sale', 'restock', 'correction', 'damage', 'waste')),
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
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

CREATE POLICY "Users can read own profile" ON public.users
FOR SELECT USING (auth.uid() = auth_user_id OR public.is_admin());

CREATE POLICY "Admins can insert users" ON public.users
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update users" ON public.users
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users
FOR DELETE USING (public.is_admin());

-- PRODUCTS (mobile read)
DROP POLICY IF EXISTS "Mobile can read products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Mobile can read products" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Admins can insert products" ON public.products
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products" ON public.products
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete products" ON public.products
FOR DELETE USING (public.is_admin());

-- TABLES (mobile read)
DROP POLICY IF EXISTS "Mobile can read tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can insert tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can update tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can delete tables" ON public.tables;

CREATE POLICY "Mobile can read tables" ON public.tables
FOR SELECT USING (true);

CREATE POLICY "Admins can insert tables" ON public.tables
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update tables" ON public.tables
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tables" ON public.tables
FOR DELETE USING (public.is_admin());

-- SESSIONS (admin only)
DROP POLICY IF EXISTS "Admins can read sessions" ON public.sessions_serveurs;
DROP POLICY IF EXISTS "Admins can insert sessions" ON public.sessions_serveurs;
DROP POLICY IF EXISTS "Admins can update sessions" ON public.sessions_serveurs;
DROP POLICY IF EXISTS "Admins can delete sessions" ON public.sessions_serveurs;

CREATE POLICY "Admins can read sessions" ON public.sessions_serveurs
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert sessions" ON public.sessions_serveurs
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update sessions" ON public.sessions_serveurs
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete sessions" ON public.sessions_serveurs
FOR DELETE USING (public.is_admin());

-- ORDERS (admin only)
DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

CREATE POLICY "Admins can read orders" ON public.orders
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE USING (public.is_admin());

-- ORDER ITEMS (admin only)
DROP POLICY IF EXISTS "Admins can read items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;

CREATE POLICY "Admins can read items" ON public.order_items
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert items" ON public.order_items
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update items" ON public.order_items
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete items" ON public.order_items
FOR DELETE USING (public.is_admin());

-- STOCK LOGS (admin only)
DROP POLICY IF EXISTS "Admins can read stock logs" ON public.stock_logs;
DROP POLICY IF EXISTS "Admins can insert stock logs" ON public.stock_logs;
DROP POLICY IF EXISTS "Admins can update stock logs" ON public.stock_logs;
DROP POLICY IF EXISTS "Admins can delete stock logs" ON public.stock_logs;

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
    p_user_id uuid,
    p_opening_cash numeric DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    start_time timestamptz,
    end_time timestamptz,
    total_collecte numeric,
    opening_cash numeric,
    closing_cash numeric
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
               v_session.total_collecte, v_session.opening_cash, v_session.closing_cash;
        RETURN;
    END IF;

    INSERT INTO public.sessions_serveurs (user_id, opening_cash)
    VALUES (p_user_id, COALESCE(p_opening_cash, 0))
    RETURNING * INTO v_session;

    RETURN QUERY
    SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
           v_session.total_collecte, v_session.opening_cash, v_session.closing_cash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_server_session(uuid, numeric) TO anon, authenticated;

-- 8.3 Get open session
CREATE OR REPLACE FUNCTION public.get_open_session(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    start_time timestamptz,
    end_time timestamptz,
    total_collecte numeric,
    opening_cash numeric,
    closing_cash numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.id, s.user_id, s.start_time, s.end_time, s.total_collecte, s.opening_cash, s.closing_cash
    FROM public.sessions_serveurs s
    WHERE s.user_id = p_user_id AND s.end_time IS NULL
    ORDER BY s.start_time DESC
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_session(uuid) TO anon, authenticated;

-- 8.4 Close session (recalculate total_collecte from orders)
CREATE OR REPLACE FUNCTION public.close_server_session(
    p_session_id uuid,
    p_closing_cash numeric DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    start_time timestamptz,
    end_time timestamptz,
    total_collecte numeric,
    opening_cash numeric,
    closing_cash numeric
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
        closing_cash = COALESCE(p_closing_cash, s.closing_cash),
        total_collecte = (
            SELECT COALESCE(SUM(o.total_amount), 0)
            FROM public.orders o
            WHERE o.session_id = s.id AND o.status = 'completed'
        )
    WHERE s.id = p_session_id
    RETURNING * INTO v_session;

    RETURN QUERY
    SELECT v_session.id, v_session.user_id, v_session.start_time, v_session.end_time,
           v_session.total_collecte, v_session.opening_cash, v_session.closing_cash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_server_session(uuid, numeric) TO anon, authenticated;

-- 8.5 Create order + items (updates stock + stock_logs + session_id)
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

        UPDATE public.products
        SET stock_quantity = COALESCE(stock_quantity, 0) - v_qty
        WHERE id = v_product_id;

        INSERT INTO public.stock_logs (product_id, user_id, change_amount, reason, notes)
        VALUES (v_product_id, p_user_id, -v_qty, 'sale', 'Mobile POS');
    END LOOP;

    RETURN QUERY
    SELECT v_order.id, v_order.order_number, v_order.total_amount, v_order.created_at,
           v_order.payment_method, v_order.status, v_order.user_id, v_order.table_id, v_order.session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid, uuid, text, jsonb, uuid) TO anon, authenticated;

-- 8.6 Orders history by user
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
