export interface Product {
  id: string | number;
  name: string;
  price: number;
  category: string;
  image?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Table {
  id: string;
  label: string;
  capacity: number;
  is_active: boolean | null;
}

export interface ServerSession {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string | null;
  total_collecte?: number | null;
}

export interface User {
  id: string;
  name: string;
  role?: 'admin' | 'server';
}

export type PaymentMethod = 'cash' | 'card' | 'other' | 'split';

export interface PendingOrder {
  id: string;
  order_number: number;
  total_amount: number;
  created_at: string;
  status: 'pending' | 'completed' | 'cancelled';
  table_id?: string | null;
  table_label?: string | null;
  session_id?: string | null;
  cancel_reason?: 'damage' | 'loss' | 'cancel' | null;
  cancel_note?: string | null;
  kitchen_status?: 'new' | 'ready' | 'rejected' | null;
  kitchen_reason?: string | null;
  kitchen_note?: string | null;
  kitchen_updated_at?: string | null;
}

export interface OrderItemDetail {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  cancelled_quantity: number;
  unit_price: number;
  net_quantity: number;
  net_subtotal: number;
  status: 'active' | 'cancelled';
  cancel_reason?: string | null;
  cancel_note?: string | null;
  created_at?: string;
}

export interface GlobalContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  activeTable: Table | null;
  setActiveTable: (table: Table | null) => void;
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (id: string | number) => void;
  clearOrder: () => void;
  activeSession: ServerSession | null;
  setActiveSession: (session: ServerSession | null) => void;
}

// Navigation param lists.
export type RootStackParamList = {
  Login: undefined;
  Tables: undefined;
  Main: undefined;
  Ticket: undefined;
  Paiement: { total?: number; orderId?: string };
  Session: undefined;
};

export type DrawerParamList = {
  Vente: undefined;
  Commandes: undefined;
  History: undefined;
  Settings: undefined;
};
