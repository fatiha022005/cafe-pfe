const COLOR_BY_CATEGORY: Record<string, string> = {
  'Café': '#c85c2a',
  'Boissons': '#2563eb',
  'Boissons Chaudes': '#c85c2a',
  'Boissons Froides': '#2563eb',
  'Snack': '#16a34a',
  'Nourriture': '#16a34a',
  'Viennoiseries': '#b45309',
  'Petit Dejeuner': '#9333ea',
  'Plats': '#dc2626',
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const buildProductImage = (name?: string | null, category?: string | null) => {
  const safeName = (name || 'Produit').trim() || 'Produit';
  const bg = COLOR_BY_CATEGORY[category || ''] || '#6b7280';
  const initials = getInitials(safeName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect width="200" height="200" rx="24" fill="${bg}"/>
  <text x="100" y="115" font-family="Sora, Arial" font-size="72" font-weight="700" text-anchor="middle" fill="#fffaf4">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
