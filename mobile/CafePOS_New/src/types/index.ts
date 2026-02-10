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
  id: number | string;
  name: string;
  status: 'libre' | 'occupe' | 'reserve';
}

export interface User {
  id: string;
  name: string;
  role?: 'admin' | 'server';
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
}

// Navigation param lists.
export type RootStackParamList = {
  Login: undefined;
  Tables: undefined;
  Main: undefined;
  Ticket: undefined;
  Paiement: { total: number };
};

export type DrawerParamList = {
  Vente: undefined;
  History: undefined;
  Settings: undefined;
};
