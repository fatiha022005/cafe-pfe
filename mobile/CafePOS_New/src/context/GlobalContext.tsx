import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Product, CartItem, Table, User, GlobalContextType } from '../types';

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

interface GlobalProviderProps {
  children: ReactNode;
}

export const GlobalProvider: React.FC<GlobalProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTable, setActiveTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string | number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearOrder = () => {
    setCart([]);
    setActiveTable(null);
  };

  return (
    <GlobalContext.Provider value={{ user, setUser, activeTable, setActiveTable, cart, addToCart, removeFromCart, clearOrder }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
};
