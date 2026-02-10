import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackScreenProps } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import MenuGrid from '../components/MenuGrid';
import OrderSummary from '../components/OrderSummary';
import { apiService } from '../services/api';
import { DrawerParamList, Product, RootStackParamList } from '../types';

type GrilleScreenProps = CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'Vente'>,
  StackScreenProps<RootStackParamList>
>;

export default function GrilleScreen({ navigation }: GrilleScreenProps) {
  const { cart, addToCart, removeFromCart, clearOrder, user, activeTable } = useGlobal();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await apiService.getProducts();
    if (!error && data) {
      setProducts(data);
    } else {
      console.error('Products fetch error', error);
    }
    setLoading(false);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const handleValidate = () => {
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Le panier est vide');
      return;
    }
    navigation.navigate('Ticket');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
          <Text style={styles.icon}>MENU</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {activeTable ? `Table ${activeTable.id}` : 'Vente Directe'}
          </Text>
          <Text style={styles.serverName}>{user?.name}</Text>
        </View>

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

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : (
          <MenuGrid items={products} categories={categories} onAddItem={addToCart} />
        )}
      </View>

      <OrderSummary items={cart} onRemove={removeFromCart} onValidate={handleValidate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  serverName: { color: '#888', fontSize: 12 },
  icon: { color: 'white', fontSize: 16, paddingHorizontal: 10 },
  content: { flex: 1, paddingBottom: 60 },
});
