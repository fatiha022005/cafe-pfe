import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackScreenProps } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import MenuGrid from '../components/MenuGrid';
import OrderSummary from '../components/OrderSummary';
import { apiService } from '../services/api';
import { DrawerParamList, Product, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import { useScale } from '../hooks/useScale';

type GrilleScreenProps = CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'Vente'>,
  StackScreenProps<RootStackParamList>
>;

export default function GrilleScreen({ navigation }: GrilleScreenProps) {
  const { cart, addToCart, removeFromCart, clearOrder, user, activeTable, activeSession, setActiveSession } =
    useGlobal();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { theme } = useTheme();
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, s, insets);

  useEffect(() => {
    loadProducts();
  }, []);

  const refreshSession = useCallback(async () => {
    if (!user?.id) return null;
    const { data } = await apiService.getOpenSession(user.id);
    setActiveSession(data ?? null);
    return data ?? null;
  }, [user?.id, setActiveSession]);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const loadProducts = async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const { data, error } = await apiService.getProducts();
    if (!error && data) {
      setProducts(data);
    } else {
      console.error('Products fetch error', error);
    }
    if (opts?.refresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };
  const handleValidate = async () => {
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Le panier est vide');
      return;
    }

    const latestSession = await refreshSession();
    if (!latestSession) {
      Alert.alert('Session requise', 'Ouvrez une session de caisse avant de vendre.');
      navigation.navigate('Session');
      return;
    }

    navigation.navigate('Ticket');
  };

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" />
      <QuickNav current="Vente" />

      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {activeTable ? `Table ${activeTable.label}` : 'Vente Directe'}
          </Text>
          <Text style={styles.serverName}>{user?.name}</Text>
          <Text style={styles.sessionText}>{activeSession ? 'Session ouverte' : 'Session fermee'}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              loadProducts({ refresh: true });
              refreshSession();
            }}
          >
            <Text style={styles.refreshText}>REFRESH</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Options', 'Choisir une action', [
                { text: 'Vider Panier', onPress: clearOrder, style: 'destructive' },
                { text: 'Annuler', style: 'cancel' },
              ]);
            }}
          >
            <Text style={styles.icon}>...</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {loading && products.length === 0 ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <MenuGrid
            items={products}
            onAddItem={addToCart}
            refreshing={refreshing}
            onRefresh={() => {
              loadProducts({ refresh: true });
              refreshSession();
            }}
          />
        )}
      </View>

      <OrderSummary items={cart} onRemove={removeFromCart} onValidate={handleValidate} bottomOffset={insets.bottom} />
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
      backgroundColor: theme.bgBody,
      paddingTop: insets.top + s(20),
      paddingBottom: insets.bottom,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 12,
      backgroundColor: theme.surfaceGlass,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      borderRadius: 14,
      marginHorizontal: 10,
      marginBottom: 10,
    },
    headerTitleContainer: { alignItems: 'flex-start' },
    headerTitle: { color: theme.textMain, fontWeight: '700', fontSize: 16 },
    serverName: { color: theme.textMuted, fontSize: 12 },
    sessionText: { color: theme.accent, fontSize: 11, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    refreshBtn: {
      backgroundColor: theme.surfaceCardStrong,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
    },
    refreshText: { color: theme.textMain, fontSize: 11, fontWeight: '700' },
    icon: { color: theme.textMain, fontSize: 14, paddingHorizontal: 10 },
    content: { flex: 1, paddingBottom: 60 },
  });




