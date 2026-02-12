export const THEMES = {
  LIGHT: 'latte',
  DARK: 'noir',
} as const;

export type ThemeMode = typeof THEMES[keyof typeof THEMES];

export type Theme = {
  mode: ThemeMode;
  bgBody: string;
  bgSurface: string;
  bgSurface2: string;
  surfaceGlass: string;
  surfaceCard: string;
  surfaceCardStrong: string;
  primary: string;
  primaryHover: string;
  primaryGlow: string;
  accent: string;
  accentSoft: string;
  textMain: string;
  textMuted: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  border: string;
  radius: number;
  fontMain: string;
  fontDisplay: string;
};

const palettes: Record<ThemeMode, Omit<Theme, 'mode'>> = {
  latte: {
    bgBody: '#f6f1ea',
    bgSurface: '#fffaf4',
    bgSurface2: '#fff4e6',
    surfaceGlass: 'rgba(255, 255, 255, 0.7)',
    surfaceCard: 'rgba(255, 255, 255, 0.85)',
    surfaceCardStrong: 'rgba(255, 255, 255, 0.92)',
    primary: '#c85c2a',
    primaryHover: '#b94e21',
    primaryGlow: 'rgba(200, 92, 42, 0.25)',
    accent: '#2f6f6a',
    accentSoft: 'rgba(47, 111, 106, 0.15)',
    textMain: '#111827',
    textMuted: '#6b7280',
    success: '#16a34a',
    danger: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
    border: 'rgba(15, 23, 42, 0.08)',
    radius: 16,
    fontMain: 'Sora',
    fontDisplay: 'SpaceGrotesk',
  },
  noir: {
    bgBody: '#0b0a0a',
    bgSurface: '#141217',
    bgSurface2: '#1f1b24',
    surfaceGlass: 'rgba(20, 18, 23, 0.8)',
    surfaceCard: 'rgba(18, 16, 22, 0.85)',
    surfaceCardStrong: 'rgba(18, 16, 22, 0.92)',
    primary: '#e07a3d',
    primaryHover: '#d06a2f',
    primaryGlow: 'rgba(224, 122, 61, 0.3)',
    accent: '#3fb7aa',
    accentSoft: 'rgba(63, 183, 170, 0.2)',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    success: '#16a34a',
    danger: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
    border: 'rgba(148, 163, 184, 0.16)',
    radius: 16,
    fontMain: 'Sora',
    fontDisplay: 'SpaceGrotesk',
  },
};

export const buildTheme = (mode: ThemeMode): Theme => ({
  mode,
  ...palettes[mode],
});
