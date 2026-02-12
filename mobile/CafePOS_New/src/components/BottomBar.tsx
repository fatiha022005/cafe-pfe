import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

type NavKey = 'Tables' | 'Vente' | 'Commandes' | 'History' | 'Settings' | 'Session';

interface BottomBarProps {
  current?: NavKey;
}

export default function BottomBar({ current }: BottomBarProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const styles = getStyles(theme);

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
            style={[styles.btn, active && styles.btnActive]}
            onPress={item.onPress}
          >
            <Text style={[styles.btnText, active && styles.btnTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: theme.surfaceCardStrong,
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      elevation: 6,
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
      borderRadius: 12,
      marginHorizontal: 4,
      backgroundColor: 'transparent',
    },
    btnActive: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    btnText: { color: theme.textMuted, fontWeight: '600', fontSize: 10 },
    btnTextActive: { color: theme.textMain, fontWeight: '700' },
  });
