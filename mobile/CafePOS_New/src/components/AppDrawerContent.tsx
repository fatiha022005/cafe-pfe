import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentComponentProps, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useScale } from '../hooks/useScale';
import { useGlobal } from '../context/GlobalContext';
import { apiService } from '../services/api';
import CafeLogo from './CafeLogo';

export default function AppDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useTheme();
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const { setUser, activeSession, setActiveSession } = useGlobal();
  const styles = getStyles(theme, s, insets);

  const handleLogout = () => {
    Alert.alert('Deconnexion', 'Etes-vous sur de vouloir quitter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          if (activeSession?.id) {
            const { error } = await apiService.closeSession(activeSession.id);
            if (error) {
              console.error('Close session error', error);
            }
          }

          setActiveSession(null);
          setUser(null);
          const parent = props.navigation.getParent();
          if (parent) {
            parent.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } else {
            props.navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <CafeLogo size={s(34)} />
        </View>
        <View>
          <Text style={styles.brand}>CafePOS</Text>
        </View>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.menuScroll}>
        <View style={styles.menu}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Deconnexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  s: (value: number) => number,
  insets: { top: number; bottom: number }
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgSurface,
      paddingTop: insets.top + s(10),
      paddingBottom: insets.bottom + s(12),
    },
    header: {
      paddingHorizontal: s(18),
      paddingVertical: s(16),
      marginHorizontal: s(14),
      marginBottom: s(8),
      borderRadius: s(16),
      backgroundColor: theme.surfaceGlass,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(12),
    },
    logoBox: {
      width: s(44),
      height: s(44),
      borderRadius: s(14),
      backgroundColor: theme.bgSurface2,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brand: { color: theme.textMain, fontSize: s(18), fontWeight: '700' },
    menuScroll: {
      flexGrow: 1,
      paddingHorizontal: s(8),
      paddingTop: s(10),
      paddingBottom: s(12),
    },
    menu: {
      paddingHorizontal: s(6),
    },
    footer: {
      paddingHorizontal: s(18),
      paddingTop: s(6),
    },
    logout: {
      backgroundColor: theme.danger,
      paddingVertical: s(12),
      borderRadius: s(12),
      alignItems: 'center',
    },
    logoutText: { color: '#fff', fontWeight: '700', fontSize: s(14) },
  });
