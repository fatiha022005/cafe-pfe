import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useScale } from '../hooks/useScale';

type NavKey = 'Tables' | 'Vente' | 'Commandes' | 'History' | 'Settings' | 'Session';

interface QuickNavProps {
  current?: NavKey;
}

export default function QuickNav({ current }: QuickNavProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { s } = useScale();
  const styles = getStyles(theme, s);

  const goDrawer = (screen: 'Vente' | 'Commandes' | 'History' | 'Settings') => {
    const drawer = navigation.getParent?.('MainDrawer');
    if (drawer?.navigate) {
      drawer.navigate(screen);
      return;
    }
    navigation.navigate('Main', { screen });
  };

  const items: { key: NavKey; label: string; onPress: () => void }[] = [
    { key: 'Tables', label: 'Tables', onPress: () => navigation.navigate('Tables') },
    { key: 'Vente', label: 'Vente', onPress: () => goDrawer('Vente') },
    { key: 'Commandes', label: 'Commandes', onPress: () => goDrawer('Commandes') },
    { key: 'History', label: 'Historique', onPress: () => goDrawer('History') },
    { key: 'Session', label: 'Session', onPress: () => navigation.navigate('Session') },
    { key: 'Settings', label: 'Parametres', onPress: () => goDrawer('Settings') },
  ];

  return (
    <View style={styles.container}>
      {items.map(item => {
        const active = current === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={item.onPress}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme'], s: (value: number) => number) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s(8),
      marginBottom: s(12),
    },
    pill: {
      backgroundColor: theme.surfaceCardStrong,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: s(8),
      paddingHorizontal: s(12),
      borderRadius: 999,
    },
    pillActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
    pillText: { color: theme.textMain, fontWeight: '600', fontSize: s(12) },
    pillTextActive: { color: theme.textMain },
  });
