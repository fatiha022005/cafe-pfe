import { Product } from '../types';

export const CATEGORIES = ['Boissons Chaudes', 'Boissons Froides', 'Petit Dejeuner', 'Viennoiseries', 'Plats'];

export const PRODUITS: Product[] = [
  {
    id: '1',
    name: 'Cafe Expresso',
    price: 15,
    category: 'Boissons Chaudes',
    image: 'https://via.placeholder.com/150',
  },
  {
    id: '2',
    name: 'Jus Orange',
    price: 25,
    category: 'Boissons Froides',
    image: 'https://via.placeholder.com/150',
  },
  {
    id: '3',
    name: 'Croissant',
    price: 12,
    category: 'Viennoiseries',
    image: 'https://via.placeholder.com/150',
  },
];
