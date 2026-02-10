-- CONFIGURATION INITIALE
-- Extensions nécessaires pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE DES UTILISATEURS / EMPLOYÉS
-- Cette table étend auth.users pour les admins et sert de table principale pour les serveurs.
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id), -- Lien vers Supabase Auth (NULL pour les serveurs sans email)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE, -- Optionnel pour les serveurs
    role TEXT NOT NULL CHECK (role IN ('admin', 'server')),
    pin_code TEXT UNIQUE CHECK (pin_code ~ '^[0-9]{4}$'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABLE DES PRODUITS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Pourrait être une table séparée
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    stock_quantity INT NOT NULL DEFAULT 0,
    min_stock_alert INT DEFAULT 10,
    description TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABLES DU RESTAURANT
CREATE TABLE public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL UNIQUE,
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE DES COMMANDES (ORDERS)
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number SERIAL, -- Numéro court incrémental plus facile à lire qu'un UUID
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

-- 5. DÉTAILS DES COMMANDES (Lignes de commande)
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL, -- Prix au moment de la vente
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. HISTORIQUE DES STOCKS (Mouvements, Pertes, Dégâts)
CREATE TABLE public.stock_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    change_amount INT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('sale', 'restock', 'correction', 'damage', 'waste')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- INDEXES (Performance)
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_pin ON public.users(pin_code);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_tables_label ON public.tables(label);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_table ON public.orders(table_id);
CREATE INDEX idx_orders_date ON public.orders(created_at);
CREATE INDEX idx_stock_logs_product ON public.stock_logs(product_id);

-- TRIGGER AUTOMATIQUE POUR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tables_modtime BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- SÉCURITÉ (RLS - Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;

-- Fonction helper: admin uniquement
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

-- POLICIES (ADMIN UNIQUEMENT)
-- Users
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT
USING (auth.uid() = auth_user_id OR public.is_admin());
CREATE POLICY "Admins can insert users" ON public.users FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update users" ON public.users FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete users" ON public.users FOR DELETE USING (public.is_admin());

-- Products
CREATE POLICY "Admins can read products" ON public.products FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE USING (public.is_admin());

-- Tables
CREATE POLICY "Admins can read tables" ON public.tables FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert tables" ON public.tables FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update tables" ON public.tables FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete tables" ON public.tables FOR DELETE USING (public.is_admin());

-- Orders
CREATE POLICY "Admins can read orders" ON public.orders FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert orders" ON public.orders FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE USING (public.is_admin());

-- Order items
CREATE POLICY "Admins can read items" ON public.order_items FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert items" ON public.order_items FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update items" ON public.order_items FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete items" ON public.order_items FOR DELETE USING (public.is_admin());

-- Stock logs
CREATE POLICY "Admins can read stock logs" ON public.stock_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert stock logs" ON public.stock_logs FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update stock logs" ON public.stock_logs FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete stock logs" ON public.stock_logs FOR DELETE USING (public.is_admin());

-- DATA DE DÉMARRAGE (SEED)
-- 1. Insérer un Admin (profil public uniquement, le compte Auth doit être créé dans Supabase)
INSERT INTO public.users (first_name, last_name, email, role, pin_code) 
VALUES ('Admin', 'Principal', 'admin@cafepos.com', 'admin', '0000');

-- 2. Insérer des Serveurs
INSERT INTO public.users (first_name, last_name, role, pin_code) VALUES 
('Thomas', 'Serveur', 'server', '1234'),
('Sarah', 'Matin', 'server', '5678');

-- 3. Tables
INSERT INTO public.tables (label, capacity) VALUES
('T1', 2), ('T2', 2), ('T3', 4), ('T4', 4), ('T5', 6),
('T6', 2), ('T7', 4), ('T8', 6), ('T9', 2), ('T10', 4);

-- 4. Produits
INSERT INTO public.products (name, category, price, cost, stock_quantity) VALUES
('Espresso', 'Café', 2.00, 0.40, 500),
('Cappuccino', 'Café', 3.50, 0.80, 200),
('Croissant', 'Nourriture', 2.50, 0.50, 40),
('Jus d''Orange', 'Boissons Froides', 4.00, 1.00, 50);
