import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ListRenderItem,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useGlobal } from '../context/GlobalContext';
import { apiService, OrderHistoryItem } from '../services/api';
import { DrawerParamList, OrderItemDetail } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import BottomBar from '../components/BottomBar';

type HistoryScreenProps = DrawerScreenProps<DrawerParamList, 'History'>;

export default function HistoryScreen({ navigation }: HistoryScreenProps) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryItem | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItemDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
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

  const openOrderDetails = async (order: OrderHistoryItem) => {
    setSelectedOrder(order);
    setDetailsVisible(true);
    setDetailsLoading(true);
    const { data, error } = await apiService.getOrderItems(order.id, user?.id ?? null);
    if (!error && data) {
      setDetailItems(data);
    } else {
      setDetailItems([]);
    }
    setDetailsLoading(false);
  };

  const handleCancelItem = (item: OrderItemDetail) => {
    if (!user?.id) return;
    if (!item.net_quantity || item.net_quantity <= 0) return;

    Alert.alert('Annuler article', 'Annuler cet article de la commande ?', [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await apiService.cancelOrderItem({
            orderItemId: item.id,
            userId: user.id,
            cancelQty: item.net_quantity,
            reason: 'item_cancel',
          });
          if (error) {
            Alert.alert('Erreur', error.message || 'Annulation impossible');
            return;
          }
          if (selectedOrder) {
            const { data } = await apiService.getOrderItems(selectedOrder.id, user.id);
            if (data) setDetailItems(data);
          }
          fetchHistory({ refresh: true });
        },
      },
    ]);
  };

  const renderItem: ListRenderItem<OrderHistoryItem> = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openOrderDetails(item)}>
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
    </TouchableOpacity>
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

      <Modal transparent visible={detailsVisible} animationType="fade" onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Commande #{selectedOrder?.order_number ?? '--'}</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Text style={styles.modalClose}>FERMER</Text>
              </TouchableOpacity>
            </View>

            {detailsLoading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
            ) : (
              <FlatList
                data={detailItems}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun article.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.detailRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{item.product_name || 'Produit'}</Text>
                      <Text style={styles.detailSub}>
                        Qté: {item.quantity} | ANNULE: {item.cancelled_quantity} | Restant: {item.net_quantity}
                      </Text>
                    </View>
                    <View style={styles.detailActions}>
                      <Text style={styles.detailPrice}>{item.net_subtotal.toFixed(2)} DH</Text>
                      {item.net_quantity > 0 ? (
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelItem(item)}>
                          <Text style={styles.cancelBtnText}>ANNULER</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.cancelledText}>ANNULE</Text>
                      )}
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxHeight: '80%',
      backgroundColor: theme.surfaceCardStrong,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: { color: theme.textMain, fontSize: 18, fontWeight: '700' },
    modalClose: { color: theme.accent, fontWeight: '700' },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    detailName: { color: theme.textMain, fontWeight: '700' },
    detailSub: { color: theme.textMuted, fontSize: 12, marginTop: 4 },
    detailActions: { alignItems: 'flex-end', gap: 6 },
    detailPrice: { color: theme.primary, fontWeight: '700' },
    cancelBtn: {
      backgroundColor: theme.surfaceGlass,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelBtnText: { color: theme.textMain, fontWeight: '700', fontSize: 11 },
    cancelledText: { color: theme.textMuted, fontSize: 11 },
  });


