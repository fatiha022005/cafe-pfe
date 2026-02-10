import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { CartItem } from '../types';

interface OrderSummaryProps {
  items: CartItem[];
  onRemove: (id: string | number) => void;
  onValidate: () => void;
}

export default function OrderSummary({ items, onRemove, onValidate }: OrderSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = subtotal * 0.0;
  const total = subtotal + tax;

  return (
    <View style={[styles.container, isExpanded ? styles.expanded : styles.collapsed]}>
      <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.header}>
        <Text style={styles.title}>Panier ({items.length})</Text>
        <Text style={styles.totalPreview}>
          {total.toFixed(2)} DH {isExpanded ? 'v' : '^'}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <>
          <ScrollView style={styles.list}>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>Panier vide</Text>
            ) : (
              items.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>x{item.quantity}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteText}>X</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.row}>
              <Text style={styles.label}>Sous-total</Text>
              <Text style={styles.val}>{subtotal.toFixed(2)} DH</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>{total.toFixed(2)} DH</Text>
            </View>

            <TouchableOpacity style={styles.payBtn} onPress={onValidate}>
              <Text style={styles.btnText}>Payer / Ticket</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1c1c1e',
    borderTopWidth: 1,
    borderColor: '#333',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 500,
  },
  collapsed: { height: 60 },
  expanded: { height: '80%', borderTopRightRadius: 20, borderTopLeftRadius: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2C2C2E',
  },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  totalPreview: { color: '#32D74B', fontSize: 18, fontWeight: 'bold' },
  list: { flex: 1, padding: 15 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 20 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  itemName: { color: 'white', fontSize: 16 },
  itemQty: { color: '#888', fontSize: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  itemPrice: { color: '#FF9F0A', marginRight: 15, fontWeight: 'bold' },
  deleteBtn: {
    backgroundColor: '#FF453A',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  footer: { padding: 20, borderTopWidth: 1, borderColor: '#333', backgroundColor: '#2C2C2E' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { color: '#aaa' },
  val: { color: 'white' },
  totalLabel: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  totalVal: { color: '#32D74B', fontSize: 24, fontWeight: 'bold' },
  payBtn: { backgroundColor: '#32D74B', padding: 15, borderRadius: 10, marginTop: 15, alignItems: 'center' },
  btnText: { color: 'black', fontWeight: 'bold', fontSize: 18 },
});
