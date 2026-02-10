import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ListRenderItem } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import { RootStackParamList, CartItem } from '../types';

type CheckoutScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Ticket'>;

interface Props {
  navigation: CheckoutScreenNavigationProp;
}

export default function CheckoutScreen({ navigation }: Props) {
  const { cart, removeFromCart } = useGlobal();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const confirmRemove = (item: CartItem) => {
    Alert.alert('Supprimer ?', `Voulez-vous retirer ${item.name} ?`, [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', onPress: () => removeFromCart(item.id), style: 'destructive' },
    ]);
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

      <TouchableOpacity
        style={[styles.chargeBtn, cart.length === 0 && styles.disabledBtn]}
        onPress={() => cart.length > 0 && navigation.navigate('Paiement', { total })}
        disabled={cart.length === 0}
      >
        <Text style={styles.btnText}>ENCAISSER {total.toFixed(2)} DH</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#212121',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backIcon: { color: 'white', fontSize: 20 },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  itemText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  itemSubText: { color: '#888', fontSize: 14 },
  itemPrice: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 18 },
  chargeBtn: {
    backgroundColor: '#4CAF50',
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 10,
  },
  disabledBtn: { backgroundColor: '#333' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
});
