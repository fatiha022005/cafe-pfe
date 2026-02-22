import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { CartItem } from '../types';
import { useTheme } from '../context/ThemeContext';

interface OrderSummaryProps {
  items: CartItem[];
  onRemove: (id: string | number) => void;
  onValidate: () => void;
  bottomOffset?: number;
}

export default function OrderSummary({ items, onRemove, onValidate, bottomOffset = 0 }: OrderSummaryProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme, bottomOffset);
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
              <Text style={styles.btnText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme'], bottomOffset: number) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surfaceCardStrong,
      borderTopWidth: 1,
      borderColor: theme.border,
      position: 'absolute',
      bottom: bottomOffset,
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
      backgroundColor: theme.surfaceCard,
    },
    title: { color: theme.textMain, fontSize: 18, fontWeight: '700' },
    totalPreview: { color: theme.primary, fontSize: 18, fontWeight: '700' },
    list: { flex: 1, padding: 15 },
    emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 20 },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: 10,
    },
    itemName: { color: theme.textMain, fontSize: 16, fontWeight: '600' },
    itemQty: { color: theme.textMuted, fontSize: 14 },
    priceRow: { flexDirection: 'row', alignItems: 'center' },
    itemPrice: { color: theme.primary, marginRight: 15, fontWeight: '700' },
    deleteBtn: {
      backgroundColor: theme.danger,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    footer: { padding: 20, borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceCard },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    label: { color: theme.textMuted },
    val: { color: theme.textMain },
    totalLabel: { color: theme.textMain, fontSize: 20, fontWeight: '700' },
    totalVal: { color: theme.primary, fontSize: 24, fontWeight: '700' },
    payBtn: { backgroundColor: theme.primary, padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
