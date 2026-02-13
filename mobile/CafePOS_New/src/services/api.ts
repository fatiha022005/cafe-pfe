import { supabase } from '../lib/supabase';
import { CartItem, Product, Table, User, ServerSession, PendingOrder, PaymentMethod, OrderItemDetail } from '../types';
import { PRODUITS } from '../data/produits';

export interface OrderHistoryItem {
  id: string;
  order_number: number;
  total_amount: number;
  created_at: string;
  payment_method: PaymentMethod | null;
  status?: 'pending' | 'completed' | 'cancelled';
  user_id?: string | null;
  table_id?: string | null;
  table_label?: string | null;
  session_id?: string | null;
  cancel_reason?: 'damage' | 'loss' | null;
  cancel_note?: string | null;
  cash_amount?: number | null;
  card_amount?: number | null;
}

export interface PendingOrderItem extends PendingOrder {}

export interface PendingOrderLineItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
    table_id: null,
    table_label: 'T5',
  },
  {
    id: '2',
    order_number: 102,
    total_amount: 45.5,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    payment_method: 'card',
    status: 'completed',
    table_id: null,
    table_label: 'T2',
  },
  {
    id: '3',
    order_number: 103,
    total_amount: 320.0,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    payment_method: 'cash',
    status: 'completed',
    table_id: null,
    table_label: null,
  },
];

const mockPendingOrders = (): PendingOrderItem[] => [
  {
    id: 'p1',
    order_number: 201,
    total_amount: 120.0,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    status: 'pending',
    table_id: 'T3',
    table_label: 'T3',
  },
];

const mockTables = (): Table[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    label: `T${i + 1}`,
    capacity: 2,
    is_active: true,
  }));

const normalizeOrder = (order: any): OrderHistoryItem => ({
  id: order.id,
  order_number: Number(order.order_number ?? 0),
  total_amount: Number(order.total_amount ?? 0),
  created_at: order.created_at,
  payment_method: order.payment_method ?? null,
  status: order.status,
  user_id: order.user_id ?? null,
  table_id: order.table_id ?? null,
  table_label: order.table_label ?? order.tables?.label ?? null,
  session_id: order.session_id ?? null,
  cancel_reason: order.cancel_reason ?? null,
  cancel_note: order.cancel_note ?? null,
  cash_amount: order.cash_amount ?? null,
  card_amount: order.card_amount ?? null,
});

const normalizePending = (order: any): PendingOrderItem => ({
  id: order.id,
  order_number: Number(order.order_number ?? 0),
  total_amount: Number(order.total_amount ?? 0),
  created_at: order.created_at,
  status: order.status ?? 'pending',
  table_id: order.table_id ?? null,
  table_label: order.table_label ?? order.tables?.label ?? null,
  session_id: order.session_id ?? null,
  cancel_reason: order.cancel_reason ?? null,
  cancel_note: order.cancel_note ?? null,
});

const toUser = (row: LoginUserRow): User => {
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Utilisateur';
  return { id: row.id, name, role: row.role };
};

export const apiService = {
  loginWithPin: async (pin: string) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (pin === '1111') {
        return { data: { id: 'S01', name: 'Ahmed', role: 'server' } as User, error: null };
      }
      return { data: null, error: new Error('PIN incorrect') };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('login_with_pin', { p_pin: pin });
    if (!rpcError) {
      const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as LoginUserRow | null | undefined;
      if (!row || row.is_active === false) {
        return { data: null, error: new Error('PIN incorrect ou utilisateur inactif') };
      }
      return { data: toUser(row), error: null };
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

    return { data: toUser(data as LoginUserRow), error: null };
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

  getTables: async () => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: mockTables(), error: null };
    }

    const { data, error } = await supabase
      .from('tables')
      .select('id, label, capacity, is_active')
      .eq('is_active', true)
      .order('label', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    const tables: Table[] =
      data?.map(item => ({
        id: item.id,
        label: item.label,
        capacity: Number(item.capacity ?? 0),
        is_active: item.is_active ?? true,
      })) ?? [];

    return { data: tables, error: null };
  },

  openSession: async (userId: string | null | undefined) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        data: {
          id: 'local-session',
          user_id: userId ?? 'local',
          start_time: new Date().toISOString(),
          end_time: null,
          total_collecte: 0,
        } as ServerSession,
        error: null,
      };
    }

    if (!userId) {
      return { data: null, error: new Error('Utilisateur manquant') };
    }

    const { data, error } = await supabase.rpc('open_server_session', {
      p_user_id: userId,
    });

    if (error) {
      return { data: null, error };
    }

    const row = (Array.isArray(data) ? data[0] : data) as ServerSession | null | undefined;
    return { data: row ?? null, error: row ? null : new Error('Session non creee') };
  },

  closeSession: async (sessionId: string | null | undefined) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: null, error: null };
    }

    if (!sessionId) {
      return { data: null, error: new Error('Session manquante') };
    }

    const { data, error } = await supabase.rpc('close_server_session', {
      p_session_id: sessionId,
    });

    if (error) {
      return { data: null, error };
    }

    const row = (Array.isArray(data) ? data[0] : data) as ServerSession | null | undefined;
    return { data: row ?? null, error: null };
  },

  getOpenSession: async (userId: string | null | undefined) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: null, error: null };
    }

    if (!userId) {
      return { data: null, error: new Error('Utilisateur manquant') };
    }

    const { data, error } = await supabase.rpc('get_open_session', { p_user_id: userId });
    if (error) {
      return { data: null, error };
    }

    const row = (Array.isArray(data) ? data[0] : data) as ServerSession | null | undefined;
    return { data: row ?? null, error: null };
  },

  createOrAppendPendingOrder: async (input: {
    userId?: string | null;
    sessionId?: string | null;
    items: CartItem[];
    tableId?: string | null;
  }) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const row = mockPendingOrders()[0];
      return { data: row, error: null };
    }

    const itemsPayload = input.items.map(item => ({
      product_id: String(item.id),
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_pending_order_with_items', {
      p_user_id: input.userId ?? null,
      p_table_id: input.tableId ?? null,
      p_items: itemsPayload,
      p_session_id: input.sessionId ?? null,
    });

    if (!rpcError) {
      const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as PendingOrderItem | null | undefined;
      if (!row) {
        return { data: null, error: new Error('Commande non creee') };
      }
      return { data: normalizePending(row), error: null };
    }

    const msg = String(rpcError.message || '');
    if (msg.includes('insufficient_stock')) {
      return { data: null, error: new Error('Stock insuffisant pour cette commande') };
    }
    if (msg.includes('items_required')) {
      return { data: null, error: new Error('Aucun article selectionne') };
    }
    if (msg.includes('product_not_found')) {
      return { data: null, error: new Error('Produit introuvable dans la base') };
    }
    if (msg.includes('session_required')) {
      return { data: null, error: new Error('Session requise pour confirmer la commande') };
    }

    return { data: null, error: new Error(msg || 'Erreur RPC upsert_pending_order_with_items') };
  },

  getPendingOrders: async (userId: string | undefined) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 400));
      return { data: mockPendingOrders(), error: null };
    }

    if (!userId) {
      return { data: [], error: null };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_pending_orders', { p_user_id: userId });
    if (rpcError) {
      return { data: null, error: rpcError };
    }

    const normalized = (rpcData ?? []).map(item => normalizePending(item));
    return { data: normalized, error: null };
  },

  getPendingOrderItems: async (orderId: string | null | undefined, userId: string | null | undefined) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return { data: [], error: null };
    }

    if (!orderId || !userId) {
      return { data: [], error: new Error('Parametres manquants') };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_pending_order_items', {
      p_order_id: orderId,
      p_user_id: userId,
    });
    if (!rpcError) {
      const items: PendingOrderLineItem[] =
        (rpcData ?? []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          subtotal: Number(item.subtotal ?? 0),
        })) ?? [];

      return { data: items, error: null };
    }

    const msg = String(rpcError.message || '');
    const lower = msg.toLowerCase();
    const missingFn = msg.includes('get_pending_order_items') || lower.includes('does not exist');
    if (!missingFn) {
      return { data: null, error: rpcError };
    }

    const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_order_items_by_order', {
      p_order_id: orderId,
      p_user_id: userId,
    });
    if (fallbackError) {
      return { data: null, error: fallbackError };
    }

    const fallbackItems: PendingOrderLineItem[] =
      (fallbackData ?? []).map((item: any) => {
        const qty = Number(item.quantity ?? item.net_quantity ?? 0);
        const price = Number(item.unit_price ?? 0);
        const subtotal = Number(item.subtotal ?? item.net_subtotal ?? qty * price);
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name ?? item.name ?? 'Produit',
          quantity: qty,
          unit_price: price,
          subtotal,
        };
      }) ?? [];

    return { data: fallbackItems, error: null };
  },

  removePendingOrderItemDamage: async (input: {
    orderId: string;
    itemId: string;
    userId: string;
    reasonNote?: string | null;
  }) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: null, error: null };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('remove_pending_order_item_damage', {
      p_order_id: input.orderId,
      p_item_id: input.itemId,
      p_user_id: input.userId,
      p_reason_note: input.reasonNote ?? null,
    });

    if (rpcError) {
      const msg = String(rpcError.message || '');
      if (msg.includes('order_not_found_or_not_pending')) {
        return { data: null, error: new Error('Commande introuvable ou deja cloturee') };
      }
      if (msg.includes('item_not_found')) {
        return { data: null, error: new Error('Article introuvable') };
      }
      if (msg.includes('user_required')) {
        return { data: null, error: new Error('Utilisateur manquant') };
      }
      return { data: null, error: new Error(msg || 'Erreur lors de la suppression') };
    }

    const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | { order_id?: string; order_number?: number; total_amount?: number; status?: string }
      | null
      | undefined;
    return { data: row ?? null, error: null };
  },

  completePendingOrder: async (input: {
    orderId: string;
    userId: string;
    paymentMethod: PaymentMethod;
    sessionId?: string | null;
    cashAmount?: number | null;
    cardAmount?: number | null;
  }) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: null, error: null };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('complete_pending_order', {
      p_order_id: input.orderId,
      p_user_id: input.userId,
      p_payment_method: input.paymentMethod,
      p_session_id: input.sessionId ?? null,
      p_cash_amount: input.cashAmount ?? null,
      p_card_amount: input.cardAmount ?? null,
    });

    if (rpcError) {
      const msg = String(rpcError.message || '');
      if (msg.includes('order_not_found_or_not_pending')) {
        return { data: null, error: new Error('Commande introuvable ou deja cloturee') };
      }
      if (msg.includes('invalid_payment_method')) {
        return { data: null, error: new Error('Mode de paiement invalide') };
      }
      return { data: null, error: new Error(msg || 'Erreur lors du paiement') };
    }

    const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as OrderHistoryItem | null | undefined;
    return { data: row ? normalizeOrder(row) : null, error: null };
  },

  cancelPendingOrder: async (input: {
    orderId: string;
    userId: string;
    reason: 'damage' | 'loss';
    note?: string | null;
  }) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: null, error: null };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_pending_order', {
      p_order_id: input.orderId,
      p_user_id: input.userId,
      p_reason: input.reason,
      p_note: input.note ?? null,
    });

    if (rpcError) {
      const msg = String(rpcError.message || '');
      if (msg.includes('order_not_found_or_not_pending')) {
        return { data: null, error: new Error('Commande introuvable ou deja cloturee') };
      }
      if (msg.includes('invalid_reason')) {
        return { data: null, error: new Error('Raison invalide') };
      }
      return { data: null, error: new Error(msg || 'Erreur lors de l\'annulation') };
    }

    const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as PendingOrderItem | null | undefined;
    return { data: row ? normalizePending(row) : null, error: null };
  },

  createOrder: async (input: {
    userId?: string | null;
    sessionId?: string | null;
    items: CartItem[];
    paymentMethod: PaymentMethod;
    tableId?: string | null;
    cashAmount?: number | null;
    cardAmount?: number | null;
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
          table_id: input.tableId ?? null,
          table_label: null,
          session_id: input.sessionId ?? null,
          cash_amount: input.cashAmount ?? null,
          card_amount: input.cardAmount ?? null,
        } as OrderHistoryItem,
        error: null,
      };
    }

    const itemsPayload = input.items.map(item => ({
      product_id: String(item.id),
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_with_items', {
      p_user_id: input.userId ?? null,
      p_table_id: input.tableId ?? null,
      p_payment_method: input.paymentMethod,
      p_items: itemsPayload,
      p_session_id: input.sessionId ?? null,
      p_cash_amount: input.cashAmount ?? null,
      p_card_amount: input.cardAmount ?? null,
    });

    if (!rpcError) {
      const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as OrderHistoryItem | null | undefined;
      if (!row) {
        return { data: null, error: new Error('Order creation failed') };
      }
      return { data: normalizeOrder(row), error: null };
    } else {
      const msg = String(rpcError.message || '');
      if (msg.includes('insufficient_stock')) {
        return { data: null, error: new Error('Stock insuffisant pour cette commande') };
      }
      if (msg.includes('items_required')) {
        return { data: null, error: new Error('Aucun article selectionne') };
      }
      if (msg.includes('product_not_found')) {
        return { data: null, error: new Error('Produit introuvable dans la base') };
      }
      if (msg.includes('session_required')) {
        return { data: null, error: new Error('Session requise pour confirmer la commande') };
      }
      if (msg.includes('invalid_payment_method')) {
        return { data: null, error: new Error('Mode de paiement invalide') };
      }
      const missingFn =
        msg.toLowerCase().includes('create_order_with_items') && msg.toLowerCase().includes('does not exist');
      if (!missingFn) {
        return { data: null, error: new Error(msg || 'Erreur RPC create_order_with_items') };
      }
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: input.userId ?? null,
          status: 'completed',
          total_amount: total,
          payment_method: input.paymentMethod,
          table_id: input.tableId ?? null,
          session_id: input.sessionId ?? null,
        },
      ])
      .select('id, order_number, total_amount, created_at, payment_method, status, table_id, session_id')
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

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_orders_by_user', { p_user_id: userId });
    if (!rpcError) {
      const normalized = (rpcData ?? []).map(item => normalizeOrder(item));
      return { data: normalized, error: null };
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, created_at, payment_method, status, user_id, table_id, tables(label)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const normalized = (data ?? []).map(item => normalizeOrder(item));
    return { data: normalized, error: null };
  },

  getOrderItems: async (orderId: string, userId?: string | null) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: [], error: null };
    }

    const { data, error } = await supabase.rpc('get_order_items_by_order', {
      p_order_id: orderId,
      p_user_id: userId ?? null,
    });

    if (error) {
      return { data: null, error };
    }

    const items: OrderItemDetail[] =
      (data ?? []).map((row: any) => ({
        id: row.id,
        order_id: row.order_id,
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: Number(row.quantity ?? 0),
        cancelled_quantity: Number(row.cancelled_quantity ?? 0),
        unit_price: Number(row.unit_price ?? 0),
        net_quantity: Number(row.net_quantity ?? 0),
        net_subtotal: Number(row.net_subtotal ?? 0),
        status: row.status ?? 'active',
        cancel_reason: row.cancel_reason ?? null,
        cancel_note: row.cancel_note ?? null,
        created_at: row.created_at,
      })) ?? [];

    return { data: items, error: null };
  },

  cancelOrderItem: async (input: {
    orderItemId: string;
    userId: string;
    cancelQty?: number | null;
    reason?: string | null;
    note?: string | null;
  }) => {
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: null, error: null };
    }

    const { data, error } = await supabase.rpc('cancel_order_item', {
      p_order_item_id: input.orderItemId,
      p_user_id: input.userId,
      p_cancel_qty: input.cancelQty ?? null,
      p_reason: input.reason ?? null,
      p_note: input.note ?? null,
    });

    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('item_already_cancelled')) {
        return { data: null, error: new Error('Article deja annule') };
      }
      if (msg.includes('invalid_cancel_qty')) {
        return { data: null, error: new Error('Quantite invalide') };
      }
      if (msg.includes('order_not_completed')) {
        return { data: null, error: new Error('Commande non validee') };
      }
      return { data: null, error: new Error(msg || 'Erreur annulation article') };
    }

    return { data, error: null };
  },
};
