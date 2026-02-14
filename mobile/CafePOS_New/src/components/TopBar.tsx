import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../theme/theme';
import { useScale } from '../hooks/useScale';
import CafeLogo from './CafeLogo';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  showThemeToggle?: boolean;
  logoSource?: ImageSourcePropType;
}

export default function TopBar({
  title = 'CafePOS',
  subtitle,
  showThemeToggle = true,
  logoSource,
}: TopBarProps) {
  const { theme, mode, toggleTheme } = useTheme();
  const { s } = useScale();
  const styles = getStyles(theme, s);
  const themeLabel = mode === THEMES.DARK ? 'Latte' : 'Noir Cafe';

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          {logoSource ? <Image source={logoSource} style={styles.logo} resizeMode="contain" /> : <CafeLogo size={s(30)} />}
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {showThemeToggle ? (
        <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme}>
          <Text style={styles.themeText}>{themeLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme'], s: (value: number) => number) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: s(16),
      paddingVertical: s(12),
      backgroundColor: theme.surfaceGlass,
      borderRadius: s(16),
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: s(12),
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: s(12) },
    logoBox: {
      width: s(44),
      height: s(44),
      borderRadius: s(14),
      backgroundColor: theme.bgSurface2,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logo: { width: s(30), height: s(30) },
    title: { color: theme.textMain, fontSize: s(18), fontWeight: '700' },
    subtitle: { color: theme.primary, fontSize: s(12), fontWeight: '700', letterSpacing: 1 },
    themeBtn: {
      backgroundColor: theme.surfaceCardStrong,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingVertical: s(8),
      paddingHorizontal: s(14),
    },
    themeText: { color: theme.textMain, fontWeight: '700', fontSize: s(12) },
  });
