import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ListRenderItem, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import { RootStackParamList, CartItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import BottomBar from '../components/BottomBar';
import { apiService } from '../services/api';

type CheckoutScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Ticket'>;

interface Props {
  navigation: CheckoutScreenNavigationProp;
}

export default function CheckoutScreen({ navigation }: Props) {
  const { cart, removeFromCart, user, activeTable, activeSession, clearOrder } = useGlobal();
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const confirmRemove = (item: CartItem) => {
    Alert.alert('Supprimer ?', `Voulez-vous retirer ${item.name} ?`, [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', onPress: () => removeFromCart(item.id), style: 'destructive' },
    ]);
  };

  const handleConfirmOrder = async () => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Utilisateur manquant');
      return;
    }
    if (!activeSession?.id) {
      Alert.alert('Session requise', 'Ouvrez une session de caisse avant de confirmer.');
      navigation.navigate('Session');
      return;
    }
    if (!activeTable?.id) {
      Alert.alert('Table requise', 'Selectionnez une table pour enregistrer la commande.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Le panier est vide');
      return;
    }

    setLoading(true);
    const { data, error } = await apiService.createOrAppendPendingOrder({
      userId: user.id,
      sessionId: activeSession.id,
      tableId: activeTable.id,
      items: cart,
    });
    setLoading(false);

    if (error || !data) {
      Alert.alert('Erreur', error?.message || 'Impossible de confirmer la commande');
      return;
    }

    clearOrder();
    Alert.alert('Commande en attente', `Commande #${data.order_number} enregistree.`);
    navigation.navigate('Main', { screen: 'Commandes' });
  };

  const renderItem: ListRenderItem<CartItem> = ({ item }) => (
    <TouchableOpacity style={styles.itemRow} onLongPress={() => confirmRemove(item)}>
      <View>
        <Text style={styles.itemText}>{item.name}</Text>
        <Text style={styles.itemSubText}>x {item.quantity}</Text>
      </View>
      <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)} DH</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" subtitle={user?.role === 'admin' ? 'ADMIN' : 'SERVEUR'} />
      <QuickNav current="Vente" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'<-'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ticket en cours</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={cart}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun article</Text>}
      />

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.confirmBtn, (cart.length === 0 || !activeTable) && styles.disabledBtn]}
          onPress={handleConfirmOrder}
          disabled={cart.length === 0 || !activeTable || loading}
        >
          <Text style={styles.btnTextSecondary}>CONFIRMER (ATTENTE)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chargeBtn, cart.length === 0 && styles.disabledBtn]}
          onPress={() => cart.length > 0 && navigation.navigate('Paiement', { total })}
          disabled={cart.length === 0 || loading}
        >
          <Text style={styles.btnTextPrimary}>ENCAISSER {total.toFixed(2)} DH</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 10 }} />}
      <BottomBar current="Vente" />
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBody, paddingHorizontal: 10, paddingTop: 50, paddingBottom: 90 },
    header: {
      padding: 16,
      backgroundColor: theme.surfaceGlass,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      borderRadius: 14,
      marginBottom: 8,
    },
    backIcon: { color: theme.textMain, fontSize: 20 },
    title: { color: theme.textMain, fontSize: 20, fontWeight: '700' },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      alignItems: 'center',
      backgroundColor: theme.surfaceCardStrong,
      marginHorizontal: 5,
      marginTop: 12,
      borderRadius: 12,
    },
    itemText: { color: theme.textMain, fontSize: 16, fontWeight: '700' },
    itemSubText: { color: theme.textMuted, fontSize: 14 },
    itemPrice: { color: theme.primary, fontWeight: '700', fontSize: 16 },
    emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 50, fontSize: 18 },
    actionsRow: { gap: 10, paddingHorizontal: 10, marginBottom: 16 },
    chargeBtn: {
      backgroundColor: theme.primary,
      padding: 18,
      alignItems: 'center',
      borderRadius: 12,
    },
    confirmBtn: {
      backgroundColor: theme.surfaceCardStrong,
      padding: 18,
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    disabledBtn: { backgroundColor: theme.border },
    btnTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnTextSecondary: { color: theme.textMain, fontWeight: '700', fontSize: 14 },
  });
