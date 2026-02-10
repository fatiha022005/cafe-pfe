const CONFIG = {
    SUPABASE_URL: 'https://gxweofraymbcwqxbcsln.supabase.co',
    // NOTE: En production, utilisez des variables d'environnement ou un backend proxy.
    // La clé publique est acceptable ici si les RLS (Row Level Security) sont bien configurés en base.
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4d2VvZnJheW1iY3dxeGJjc2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzA5NjQsImV4cCI6MjA4NTcwNjk2NH0.7bNRXmW0mcnvGT9DhowlzvM3EpWZ_cX-sX2MQc_Z3hk',
    CURRENCY: 'MAD',
    LOCALE: 'fr-MA'
};

const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Theme
const THEME_KEY = 'cafepos_theme';
const THEMES = { LIGHT: 'latte', DARK: 'noir' };
const getTheme = () => localStorage.getItem(THEME_KEY) || THEMES.LIGHT;
const setTheme = (theme) => {
    const next = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    return next;
};

window.getTheme = getTheme;
window.setTheme = setTheme;
window.THEMES = THEMES;

setTheme(getTheme());

// Chart.js global theme
if (window.Chart) {
    Chart.defaults.color = '#475569';
    Chart.defaults.font.family = "'Sora', 'Space Grotesk', sans-serif";
    Chart.defaults.borderColor = 'rgba(15, 23, 42, 0.08)';
}

// Helpers globaux
const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMoney = (amount) => new Intl.NumberFormat(CONFIG.LOCALE, { style: 'currency', currency: CONFIG.CURRENCY }).format(toNumber(amount));
const formatDate = (dateString) => new Date(dateString).toLocaleString(CONFIG.LOCALE, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
