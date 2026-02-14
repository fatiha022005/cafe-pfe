import { Product } from '../types';
import { buildProductImage } from '../utils/productImage';

export const CATEGORIES = ['Boissons Chaudes', 'Boissons Froides', 'Petit Dejeuner', 'Viennoiseries', 'Plats'];

export const PRODUITS: Product[] = [
  {
    id: '1',
    name: 'Cafe Expresso',
    price: 15,
    category: 'Boissons Chaudes',
    image: buildProductImage('Cafe Expresso', 'Boissons Chaudes'),
  },
  {
    id: '2',
    name: 'Jus Orange',
    price: 25,
    category: 'Boissons Froides',
    image: buildProductImage('Jus Orange', 'Boissons Froides'),
  },
  {
    id: '3',
    name: 'Croissant',
    price: 12,
    category: 'Viennoiseries',
    image: buildProductImage('Croissant', 'Viennoiseries'),
  },
];
