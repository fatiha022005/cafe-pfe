import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTheme, Theme, ThemeMode, THEMES } from '../theme/theme';

const THEME_KEY = 'cafepos_theme';

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(THEMES.LIGHT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_KEY)
      .then(saved => {
        if (!mounted) return;
        if (saved === THEMES.DARK || saved === THEMES.LIGHT) {
          setModeState(saved as ThemeMode);
        }
      })
      .finally(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  };

  const toggleTheme = () => {
    setMode(mode === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
  };

  const value = useMemo(
    () => ({
      theme: buildTheme(mode),
      mode,
      setMode,
      toggleTheme,
      ready,
    }),
    [mode, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
