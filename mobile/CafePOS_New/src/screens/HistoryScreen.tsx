import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useGlobal } from '../context/GlobalContext';
import { apiService, OrderHistoryItem } from '../services/api';
import { DrawerParamList } from '../types';

type HistoryScreenProps = DrawerScreenProps<DrawerParamList, 'History'>;

export default function HistoryScreen({ navigation }: HistoryScreenProps) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useGlobal();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await apiService.getOrdersByUser(user?.id);
    if (!error && data) {
      setOrders(data);
    } else {
      console.error('History fetch error', error);
    }
    setLoading(false);
  };

  const renderItem: ListRenderItem<OrderHistoryItem> = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.tableText}>
          {item.table_number ? `Table ${item.table_number}` : 'Vente Directe'} - Commande #{item.order_number}
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Text style={styles.menuIcon}>MENU</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historique des Ventes</Text>
        <TouchableOpacity onPress={fetchHistory}>
          <Text style={styles.refresh}>REFRESH</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune vente enregistree.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#212121',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  menuIcon: { color: 'white', fontSize: 14 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  refresh: { fontSize: 12, color: '#4CAF50' },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#1E1E1E',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  tableText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  dateText: { color: '#888', fontSize: 12 },
  totalText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 18 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50 },
});
