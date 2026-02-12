import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useGlobal } from '../context/GlobalContext';
import { apiService, OrderHistoryItem } from '../services/api';
import { DrawerParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import BottomBar from '../components/BottomBar';

type HistoryScreenProps = DrawerScreenProps<DrawerParamList, 'History'>;

export default function HistoryScreen({ navigation }: HistoryScreenProps) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { user } = useGlobal();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const { data, error } = await apiService.getOrdersByUser(user?.id);
    if (!error && data) {
      setOrders(data);
    } else {
      console.error('History fetch error', error);
    }
    if (opts?.refresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const renderItem: ListRenderItem<OrderHistoryItem> = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.tableText}>
          {item.table_label ? `Table ${item.table_label}` : 'Vente Directe'} - Commande #{item.order_number}
        </Text>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' - '}
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.totalText}>{item.total_amount.toFixed(2)} DH</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar title="CafePOS" subtitle={user?.role === 'admin' ? 'ADMIN' : 'SERVEUR'} />
      <QuickNav current="History" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Text style={styles.menuIcon}>MENU</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historique des Ventes</Text>
        <TouchableOpacity onPress={() => fetchHistory({ refresh: true })}>
          <Text style={styles.refresh}>REFRESH</Text>
        </TouchableOpacity>
      </View>

      {loading && orders.length === 0 ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune vente enregistree.</Text>}
          refreshing={refreshing}
          onRefresh={() => fetchHistory({ refresh: true })}
        />
      )}

      <BottomBar current="History" />
    </SafeAreaView>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBody, paddingHorizontal: 10, paddingBottom: 90 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      alignItems: 'center',
      backgroundColor: theme.surfaceGlass,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      borderRadius: 14,
      marginBottom: 8,
    },
    menuIcon: { color: theme.textMain, fontSize: 14 },
    title: { color: theme.textMain, fontSize: 18, fontWeight: '700' },
    refresh: { fontSize: 12, color: theme.accent },
    card: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 18,
      backgroundColor: theme.surfaceCardStrong,
      marginHorizontal: 5,
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tableText: { color: theme.textMain, fontWeight: '700', fontSize: 16, marginBottom: 5 },
    dateText: { color: theme.textMuted, fontSize: 12 },
    totalText: { color: theme.primary, fontWeight: '700', fontSize: 18 },
    emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 50 },
  });
