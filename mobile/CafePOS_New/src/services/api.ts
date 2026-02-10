import { supabase } from '../lib/supabase';
import { CartItem, Product, User } from '../types';
import { PRODUITS } from '../data/produits';

export interface OrderHistoryItem {
  id: string;
  order_number: number;
  total_amount: number;
  created_at: string;
  payment_method: 'cash' | 'card' | 'other' | null;
  status?: 'pending' | 'completed' | 'cancelled';
  user_id?: string | null;
  table_number?: number | null;
}

interface LoginUserRow {
  id: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'server';
  pin_code: string | null;
  is_active: boolean | null;
}

const mockOrders = (): OrderHistoryItem[] => [
  {
    id: '1',
    order_number: 101,
    total_amount: 150.0,
    created_at: new Date().toISOString(),
    payment_method: 'cash',
    status: 'completed',
    table_number: 5,
  },
  {
    id: '2',
    order_number: 102,
    total_amount: 45.5,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    payment_method: 'card',
    status: 'completed',
    table_number: 2,
  },
  {
    id: '3',
    order_number: 103,
    total_amount: 320.0,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    payment_method: 'cash',
    status: 'completed',
    table_number: null,
  },
];

const normalizeOrder = (order: any): OrderHistoryItem => ({
  id: order.id,
  order_number: Number(order.order_number ?? 0),
  total_amount: Number(order.total_amount ?? 0),
  created_at: order.created_at,
  payment_method: order.payment_method ?? null,
  status: order.status,
  user_id: order.user_id ?? null,
  table_number: order.table_number ?? null,
});

export const apiService = {
  loginWithPin: async (pin: string) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (pin === '1111') {
        return { data: { id: 'S01', name: 'Ahmed', role: 'server' } as User, error: null };
      }
      return { data: null, error: new Error('PIN incorrect') };
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, pin_code, is_active')
      .eq('pin_code', pin)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }
    if (!data || data.is_active === false) {
      return { data: null, error: new Error('PIN incorrect ou utilisateur inactif') };
    }

    const row = data as LoginUserRow;
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Utilisateur';
    return { data: { id: row.id, name, role: row.role } as User, error: null };
  },

  getProducts: async () => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: PRODUITS, error: null };
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, price, is_available')
      .eq('is_available', true)
      .order('name', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    const products: Product[] =
      data?.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.price ?? 0),
      })) ?? [];

    return { data: products, error: null };
  },

  createOrder: async (input: {
    userId?: string | null;
    items: CartItem[];
    paymentMethod: 'cash' | 'card' | 'other';
    tableNumber?: number | null;
  }) => {
    const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 400));
      return {
        data: {
          id: String(Date.now()),
          order_number: Math.floor(100 + Math.random() * 900),
          total_amount: total,
          created_at: new Date().toISOString(),
          payment_method: input.paymentMethod,
          status: 'completed',
          table_number: input.tableNumber ?? null,
        } as OrderHistoryItem,
        error: null,
      };
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: input.userId ?? null,
          status: 'completed',
          total_amount: total,
          payment_method: input.paymentMethod,
          table_number: input.tableNumber ?? null,
        },
      ])
      .select('id, order_number, total_amount, created_at, payment_method, status, table_number')
      .single();

    if (orderError || !order) {
      return { data: null, error: orderError ?? new Error('Order creation failed') };
    }

    const orderItems = input.items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    const normalized = normalizeOrder(order);
    if (itemsError) {
      return { data: normalized, error: itemsError };
    }

    return { data: normalized, error: null };
  },

  getOrdersByUser: async (userId: string | undefined) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return { data: mockOrders(), error: null };
    }

    if (!userId) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, created_at, payment_method, status, user_id, table_number')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const normalized = (data ?? []).map(item => normalizeOrder(item));
    return { data: normalized, error: null };
  },
};
