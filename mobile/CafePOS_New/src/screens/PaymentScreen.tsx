import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import { apiService } from '../services/api';
import { RootStackParamList } from '../types';

type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Paiement'>;

interface Props {
  navigation: PaymentScreenNavigationProp;
}

export default function PaymentScreen({ navigation }: Props) {
  const { cart, clearOrder, activeTable, user } = useGlobal();
  const [loading, setLoading] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleFinalize = async (modeLabel: 'ESPECES' | 'CB') => {
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Panier vide');
      return;
    }

    const paymentMethod = modeLabel === 'CB' ? 'card' : 'cash';
    setLoading(true);
    const { data, error } = await apiService.createOrder({
      userId: user?.id ?? null,
      items: cart,
      paymentMethod,
      tableNumber: activeTable?.id ? Number(activeTable.id) : null,
    });
    setLoading(false);

    if (error || !data) {
      Alert.alert('Erreur', 'Impossible de sauvegarder la commande');
      return;
    }

    console.log(`Payment ${paymentMethod} validated for table ${activeTable?.id ?? 'N/A'}`);

    Alert.alert(
      'Paiement Reussi',
      `Montant: ${total.toFixed(2)} DH\nMode: ${modeLabel}\nCommande #${data.order_number}`,
      [
        {
          text: 'OK',
          onPress: () => {
            clearOrder();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Tables' }],
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.icon}>{'<-'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Info', 'Fonctionnalite Split a venir')}>
          <Text style={styles.split}>DIVISER</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amountText}>{total.toFixed(2)} DH</Text>
        <Text style={styles.subtext}>Total a payer</Text>
        {activeTable && <Text style={styles.tableInfo}>Table {activeTable.id}</Text>}
      </View>

      <TouchableOpacity style={styles.payBtn} onPress={() => handleFinalize('ESPECES')} disabled={loading}>
        <Text style={styles.payIcon}>CASH</Text>
        <Text style={styles.payText}>ESPECES</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.payBtn} onPress={() => handleFinalize('CB')} disabled={loading}>
        <Text style={styles.payIcon}>CB</Text>
        <Text style={styles.payText}>CARTE BANCAIRE</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="small" color="#4CAF50" style={{ marginTop: 10 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  icon: { color: 'white', fontSize: 20 },
  split: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16, marginTop: 5 },
  amountContainer: { alignItems: 'center', marginVertical: 60 },
  amountText: { color: 'white', fontSize: 48, fontWeight: 'bold' },
  subtext: { color: '#888', fontSize: 16, marginTop: 10 },
  tableInfo: { color: '#4CAF50', fontSize: 18, marginTop: 5, fontWeight: 'bold' },
  payBtn: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 25,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  payIcon: { fontSize: 16, marginRight: 20, color: 'white' },
  payText: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },
});
