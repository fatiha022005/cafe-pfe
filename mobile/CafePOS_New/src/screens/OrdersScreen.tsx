import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ListRenderItem,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';
import { useGlobal } from '../context/GlobalContext';
import { apiService, PendingOrderItem, PendingOrderLineItem } from '../services/api';
import { DrawerParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import { useScale } from '../hooks/useScale';

type OrdersScreenProps = DrawerScreenProps<DrawerParamList, 'Commandes'>;

type CancelReason = 'cancel' | 'damage' | 'loss' | null;
type ItemCancelReason = 'damage' | 'loss' | null;

export default function OrdersScreen({ navigation }: OrdersScreenProps) {
  const [orders, setOrders] = useState<PendingOrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelReason>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [targetOrder, setTargetOrder] = useState<PendingOrderItem | null>(null);
  const [itemsModalVisible, setItemsModalVisible] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<PendingOrderLineItem[]>([]);
  const [itemsOrder, setItemsOrder] = useState<PendingOrderItem | null>(null);
  const [damageModalVisible, setDamageModalVisible] = useState(false);
  const [damageNote, setDamageNote] = useState('');
  const [damageSubmitting, setDamageSubmitting] = useState(false);
  const [damageError, setDamageError] = useState<string | null>(null);
  const [itemCancelReason, setItemCancelReason] = useState<ItemCancelReason>(null);
  const [targetItem, setTargetItem] = useState<PendingOrderLineItem | null>(null);
  const [returnToItemsAfterDamage, setReturnToItemsAfterDamage] = useState(false);
  const [itemCancelQty, setItemCancelQty] = useState('1');
  const notifiedRef = useRef(new Set<string>());
  const { user } = useGlobal();
  const { theme } = useTheme();
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, s, insets);
  const itemsTotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '--';
  const formatSession = (value?: string | null) => (value ? value.slice(0, 8) : '--');

  useEffect(() => {
    fetchOrders();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders({ refresh: true });
    }, [user?.id])
  );

  useEffect(() => {
    if (!user?.id) return;
    const timer = setInterval(() => fetchOrders({ silent: true }), 10000);
    return () => clearInterval(timer);
  }, [user?.id]);

  const clampQty = (value: number, max: number) => Math.max(1, Math.min(value, max));
  const parseQty = (value: string, max: number) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return 1;
    return clampQty(parsed, max);
  };
  const updateItemCancelQty = (value: number) => {
    if (!targetItem) return;
    const max = targetItem.quantity || 1;
    const next = clampQty(value, max);
    setItemCancelQty(String(next));
  };
  const normalizeItemCancelQty = () => {
    if (!targetItem) return;
    const max = targetItem.quantity || 1;
    const next = parseQty(itemCancelQty, max);
    setItemCancelQty(String(next));
  };

  const kitchenReasonLabel = (reason?: string | null) => {
    if (!reason) return '';
    const map: Record<string, string> = {
      rupture: 'Rupture de stock',
      panne: 'Panne matériel',
      autre: 'Autre',
    };
    return map[reason] || reason;
  };

  const notifyKitchenUpdates = (data: PendingOrderItem[]) => {
    data.forEach((order) => {
      if (order.kitchen_status !== 'ready' && order.kitchen_status !== 'rejected') return;
      const key = `${order.id}:${order.kitchen_status}:${order.kitchen_note || ''}`;
      if (notifiedRef.current.has(key)) return;

      if (order.kitchen_status === 'ready') {
        Alert.alert(
          'Commande prête',
          `Commande #${order.order_number} ${order.table_label ? `(Table ${order.table_label})` : ''} est prête.`
        );
      } else {
        const reason = kitchenReasonLabel(order.kitchen_reason);
        const note = order.kitchen_note ? `\nNote: ${order.kitchen_note}` : '';
        Alert.alert(
          'Commande refusée',
          `Commande #${order.order_number} ${reason ? `• ${reason}` : ''}${note}`
        );
      }

      notifiedRef.current.add(key);
    });
  };

  const fetchOrders = async (opts?: { refresh?: boolean; silent?: boolean }) => {
    if (opts?.refresh) {
      setRefreshing(true);
    } else if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error } = await apiService.getPendingOrders(user?.id);
      if (!error && data) {
        notifyKitchenUpdates(data);
        setOrders(data);
      } else {
        console.error('Pending orders fetch error', error);
        setOrders([]);
        setError('Impossible de charger les commandes.');
      }
    } catch (err) {
      console.error('Pending orders fetch error', err);
      setOrders([]);
      setError('Impossible de charger les commandes.');
    } finally {
      if (opts?.refresh) {
        setRefreshing(false);
      } else if (!opts?.silent) {
        setLoading(false);
      }
    }
  };

  const openCancelModal = (order: PendingOrderItem) => {
    setTargetOrder(order);
    const ready = order.kitchen_status === 'ready';
    setCancelReason(ready ? null : 'cancel');
    setCancelNote('');
    setModalVisible(true);
  };

  const handleCancel = async () => {
    if (!targetOrder || !user?.id) {
      setModalVisible(false);
      return;
    }
    if (!cancelReason) {
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await apiService.cancelPendingOrder({
        orderId: targetOrder.id,
        userId: user.id,
        reason: cancelReason,
        note: cancelNote.trim() || null,
      });
      if (error) {
        Alert.alert('Erreur', error.message || "Erreur lors de l'annulation");
        return;
      }
      setModalVisible(false);
      fetchOrders({ refresh: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Erreur', message || "Erreur lors de l'annulation");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = (order: PendingOrderItem) => {
    navigation.navigate('Paiement', { orderId: order.id, total: order.total_amount });
  };

  const fetchOrderItems = async (orderId: string) => {
    if (!user?.id) {
      return;
    }
    setItemsLoading(true);
    setItemsError(null);
    try {
      const { data, error } = await apiService.getPendingOrderItems(orderId, user.id);
      if (error) {
        const message = String(error.message || '');
        if (message.includes('order_not_pending')) {
          // The order was finalized on another device; refresh and exit cleanly.
          setOrderItems([]);
          setItemsModalVisible(false);
          await fetchOrders({ refresh: true });
          Alert.alert('Info', 'Cette commande est deja cloturee.');
          return;
        }
        console.error('Pending order items fetch error', error);
        setOrderItems([]);
        setItemsError(message || "Impossible de charger les articles.");
      } else {
        setOrderItems(data ?? []);
      }
    } catch (err) {
      console.error('Pending order items fetch error', err);
      setOrderItems([]);
      const message = err instanceof Error ? err.message : String(err);
      setItemsError(message || "Impossible de charger les articles.");
    } finally {
      setItemsLoading(false);
    }
  };

  const openItemsModal = (order: PendingOrderItem) => {
    setItemsOrder(order);
    setOrderItems([]);
    setItemsError(null);
    setItemsModalVisible(true);
    fetchOrderItems(order.id);
  };

  const openDamageModal = (item: PendingOrderLineItem) => {
    setTargetItem(item);
    setItemCancelReason(null);
    setDamageNote('');
    setDamageError(null);
    setItemCancelQty('1');
    setReturnToItemsAfterDamage(itemsModalVisible);
    if (itemsModalVisible) {
      setItemsModalVisible(false);
    }
    setDamageModalVisible(true);
  };

  const closeDamageModal = (opts?: { reopenItems?: boolean }) => {
    setDamageModalVisible(false);
    setItemCancelReason(null);
    if (opts?.reopenItems && itemsOrder) {
      setItemsModalVisible(true);
    }
    setReturnToItemsAfterDamage(false);
  };

  const handleRemoveDamage = async () => {
    if (!itemsOrder || !targetItem || !user?.id) {
      closeDamageModal({ reopenItems: returnToItemsAfterDamage });
      return;
    }
    const ready = itemsOrder.kitchen_status === 'ready';
    const maxQty = targetItem.quantity || 1;
    const qty = Number.parseInt(itemCancelQty, 10);
    if (!qty || qty < 1 || qty > maxQty) {
      const message = 'Quantite invalide.';
      setDamageError(message);
      Alert.alert('Erreur', message);
      return;
    }
    if (ready && !itemCancelReason) {
      Alert.alert('Erreur', 'Merci de choisir Degat ou Perte.');
      return;
    }
    const reason = ready ? itemCancelReason : 'cancel';
    const note = damageNote.trim();

    setDamageSubmitting(true);
    setDamageError(null);
    try {
      const { data, error } = await apiService.cancelPendingOrderItem({
        orderId: itemsOrder.id,
        itemId: targetItem.id,
        userId: user.id,
        reason,
        note: note || null,
        cancelQty: qty,
      });

      if (error) {
        setDamageError(error.message);
        Alert.alert('Erreur', error.message || "Impossible de supprimer l'article.");
        return;
      }

      await fetchOrderItems(itemsOrder.id);
      await fetchOrders({ refresh: true });

      const orderCancelled = data?.status === 'cancelled';
      if (orderCancelled) {
        setItemsModalVisible(false);
      } else if (returnToItemsAfterDamage && itemsOrder) {
        setItemsModalVisible(true);
      }
      setReturnToItemsAfterDamage(false);
      setDamageModalVisible(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDamageError(message || 'Erreur lors du degat.');
      Alert.alert('Erreur', message || 'Erreur lors du degat.');
    } finally {
      setDamageSubmitting(false);
    }
  };

  const handleItemCancelPress = (item: PendingOrderLineItem) => {
    if (!itemsOrder || !user?.id) return;
    openDamageModal(item);
  };

  const renderItem: ListRenderItem<PendingOrderItem> = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.tableText}>
          {item.table_label ? `Table ${item.table_label}` : 'Vente Directe'} - Commande #{item.order_number}
        </Text>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' - '}
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        {item.kitchen_status === 'ready' && <Text style={[styles.kitchenTag, styles.kitchenReady]}>PRETE</Text>}
        {item.kitchen_status === 'rejected' && (
          <Text style={[styles.kitchenTag, styles.kitchenRejected]}>
            REFUSEE {item.kitchen_reason ? `• ${kitchenReasonLabel(item.kitchen_reason)}` : ''}
          </Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.totalText}>{item.total_amount.toFixed(2)} DH</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(item)}>
            <Text style={styles.actionText}>PAYER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailBtn} onPress={() => openItemsModal(item)}>
            <Text style={styles.actionTextAlt}>DETAILS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => openCancelModal(item)}>
            <Text style={styles.actionTextAlt}>ANNULER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" />
      <QuickNav current="Commandes" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Text style={styles.menuIcon}>MENU</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Commandes en attente</Text>
        <TouchableOpacity onPress={() => fetchOrders({ refresh: true })}>
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
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune commande en attente.</Text>}
          refreshing={refreshing}
          onRefresh={() => fetchOrders({ refresh: true })}
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Annuler la commande</Text>
            <Text style={styles.modalSub}>
              {targetOrder?.kitchen_status === 'ready'
                ? 'Commande prête: choisir Dégât ou Perte'
                : 'Commande pas encore prête: annulation simple'}
            </Text>
            <View style={styles.adjustRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => {
                  if (targetOrder) {
                    setModalVisible(false);
                    openItemsModal(targetOrder);
                  }
                }}
              >
                <Text style={styles.adjustBtnText}>Ajuster quantites</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reasonRow}>
              {targetOrder?.kitchen_status === 'ready' ? (
                <>
                  <TouchableOpacity
                    style={[styles.reasonBtn, cancelReason === 'damage' && styles.reasonBtnActive]}
                    onPress={() => setCancelReason('damage')}
                  >
                    <Text style={styles.reasonText}>Degat (casse/renverse)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reasonBtn, cancelReason === 'loss' && styles.reasonBtnActive]}
                    onPress={() => setCancelReason('loss')}
                  >
                    <Text style={styles.reasonText}>Perte (client parti)</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.reasonBtn, cancelReason === 'cancel' && styles.reasonBtnActive]}
                  onPress={() => setCancelReason('cancel')}
                >
                  <Text style={styles.reasonText}>Annuler</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder={targetOrder?.kitchen_status === 'ready' ? 'Note (optionnel)' : 'Note (optionnel, ex: client annule)'}
              placeholderTextColor={theme.textMuted}
              value={cancelNote}
              onChangeText={setCancelNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)} disabled={submitting}>
                <Text style={styles.modalBtnText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, !cancelReason && styles.modalBtnDisabled]}
                onPress={handleCancel}
                disabled={!cancelReason || submitting}
              >
                <Text style={styles.modalBtnTextPrimary}>Confirmer</Text>
              </TouchableOpacity>
            </View>
            {submitting && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} />}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={itemsModalVisible}
        animationType="fade"
        onRequestClose={() => setItemsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Articles en attente</Text>
            <Text style={styles.modalSub}>{itemsOrder ? `Commande #${itemsOrder.order_number}` : 'Commande'}</Text>
            {itemsOrder && (
              <View style={styles.summaryBlock}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>
                    {itemsOrder.table_label ? `Table ${itemsOrder.table_label}` : 'Vente Directe'}
                  </Text>
                  <Text style={styles.summaryText}>Total: {itemsTotal.toFixed(2)} DH</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Date: {formatDateTime(itemsOrder.created_at)}</Text>
                  <Text style={styles.summaryText}>Serveur: {user?.name ?? '--'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Paiement: En attente</Text>
                  <Text style={styles.summaryText}>Session: {formatSession(itemsOrder.session_id)}</Text>
                </View>
              </View>
            )}

            {itemsLoading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} />
            ) : (
              <FlatList
                data={orderItems}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun article.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.product_name}</Text>
                      <Text style={styles.itemMeta}>
                        {item.quantity} x {item.unit_price.toFixed(2)} DH
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>{item.subtotal.toFixed(2)} DH</Text>
                    <TouchableOpacity style={styles.damageBtn} onPress={() => handleItemCancelPress(item)}>
                      <Text style={styles.damageText}>ANNULER</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            {itemsError && <Text style={styles.errorText}>{itemsError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setItemsModalVisible(false)}>
                <Text style={styles.modalBtnText}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  if (!itemsOrder) return;
                  setItemsModalVisible(false);
                  openCancelModal(itemsOrder);
                }}
              >
                <Text style={styles.modalBtnTextPrimary}>Annuler commande</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={damageModalVisible}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => closeDamageModal({ reopenItems: returnToItemsAfterDamage })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Annuler un article</Text>
            <Text style={styles.modalSub}>
              {targetItem ? `${targetItem.product_name} (x${targetItem.quantity})` : ''}
            </Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateItemCancelQty(parseQty(itemCancelQty, targetItem?.quantity || 1) - 1)}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                keyboardType="numeric"
                value={itemCancelQty}
                onChangeText={(textValue) => setItemCancelQty(textValue.replace(/[^0-9]/g, ''))}
                onBlur={normalizeItemCancelQty}
              />
              <Text style={styles.qtyMax}>/ {targetItem?.quantity ?? 1}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateItemCancelQty(parseQty(itemCancelQty, targetItem?.quantity || 1) + 1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {itemsOrder?.kitchen_status === 'ready' ? (
              <>
                <Text style={styles.modalSub}>Commande prete: choisir Degat ou Perte</Text>
                <View style={styles.reasonRow}>
                  <TouchableOpacity
                    style={[styles.reasonBtn, itemCancelReason === 'damage' && styles.reasonBtnActive]}
                    onPress={() => setItemCancelReason('damage')}
                  >
                    <Text style={styles.reasonText}>Degat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reasonBtn, itemCancelReason === 'loss' && styles.reasonBtnActive]}
                    onPress={() => setItemCancelReason('loss')}
                  >
                    <Text style={styles.reasonText}>Perte</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.modalSub}>Commande pas encore prete: annulation simple</Text>
            )}
            <TextInput
              style={styles.noteInput}
              placeholder="Note (optionnel)"
              placeholderTextColor={theme.textMuted}
              value={damageNote}
              onChangeText={setDamageNote}
            />
            <View style={styles.modalActions}>

              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => closeDamageModal({ reopenItems: returnToItemsAfterDamage })}
                disabled={damageSubmitting}
              >
                <Text style={styles.modalBtnText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  itemsOrder?.kitchen_status === 'ready' && !itemCancelReason && styles.modalBtnDisabled,
                ]}
                onPress={handleRemoveDamage}
                disabled={(itemsOrder?.kitchen_status === 'ready' && !itemCancelReason) || damageSubmitting}
              >
                <Text style={styles.modalBtnTextPrimary}>Confirmer</Text>
              </TouchableOpacity>
            </View>
            {damageError && <Text style={styles.errorText}>{damageError}</Text>}
            {damageSubmitting && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} />}
          </View>
        </View>
      </Modal>

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
      paddingHorizontal: s(10),
      paddingTop: insets.top + s(20),
      paddingBottom: insets.bottom,
    },
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
      padding: 16,
      backgroundColor: theme.surfaceCardStrong,
      marginHorizontal: 5,
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    cardRight: { alignItems: 'flex-end', gap: 8 },
    tableText: { color: theme.textMain, fontWeight: '700', fontSize: 15, marginBottom: 5 },
    dateText: { color: theme.textMuted, fontSize: 12 },
    kitchenTag: {
      marginTop: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },
    kitchenReady: { backgroundColor: theme.success },
    kitchenRejected: { backgroundColor: theme.danger },
    totalText: { color: theme.primary, fontWeight: '700', fontSize: 18 },
    actionRow: { flexDirection: 'row', gap: 8 },
    payBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    detailBtn: {
      backgroundColor: theme.surfaceGlass,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelBtn: {
      backgroundColor: theme.surfaceGlass,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    actionTextAlt: { color: theme.textMain, fontWeight: '700', fontSize: 12 },
    emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 50 },
    errorText: { color: theme.warning, textAlign: 'center', marginTop: 10 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      backgroundColor: theme.surfaceCardStrong,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { color: theme.textMain, fontSize: 18, fontWeight: '700' },
    modalSub: { color: theme.textMuted, marginTop: 6 },
    summaryBlock: {
      marginTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 6,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryText: { color: theme.textMain, fontWeight: '600', fontSize: 12 },
    adjustRow: { marginTop: 10 },
    adjustBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.surfaceGlass,
      borderWidth: 1,
      borderColor: theme.border,
    },
    adjustBtnText: { color: theme.textMain, fontWeight: '600', fontSize: 12 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    qtyBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.surfaceGlass,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyBtnText: { color: theme.textMain, fontWeight: '700' },
    qtyInput: {
      minWidth: 50,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      textAlign: 'center',
      color: theme.textMain,
      backgroundColor: theme.bgSurface,
    },
    qtyMax: { color: theme.textMuted, fontWeight: '600' },
    reasonRow: { gap: 10, marginTop: 14 },
    reasonBtn: {
      backgroundColor: theme.surfaceGlass,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    reasonBtnActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
    reasonText: { color: theme.textMain, fontWeight: '600' },
    noteInput: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      color: theme.textMain,
      backgroundColor: theme.bgSurface,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    modalBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.surfaceGlass,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalBtnPrimary: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    modalBtnDisabled: {
      opacity: 0.5,
    },
    modalBtnText: { color: theme.textMain, fontWeight: '600' },
    modalBtnTextPrimary: { color: '#fff', fontWeight: '700' },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    itemTitle: { color: theme.textMain, fontWeight: '700', fontSize: 14 },
    itemMeta: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
    itemTotal: { color: theme.primary, fontWeight: '700', fontSize: 13 },
    damageBtn: {
      backgroundColor: theme.warning,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    damageText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  });
