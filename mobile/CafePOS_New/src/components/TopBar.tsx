import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../theme/theme';

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
  logoSource = require('../../assets/icon.png'),
}: TopBarProps) {
  const { theme, mode, toggleTheme } = useTheme();
  const styles = getStyles(theme);
  const themeLabel = mode === THEMES.DARK ? 'Latte' : 'Noir Cafe';

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
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

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surfaceGlass,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.bgSurface2,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logo: { width: 30, height: 30 },
    title: { color: theme.textMain, fontSize: 18, fontWeight: '700' },
    subtitle: { color: theme.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    themeBtn: {
      backgroundColor: theme.surfaceCardStrong,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    themeText: { color: theme.textMain, fontWeight: '700' },
  });
