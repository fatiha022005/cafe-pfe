import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ListRenderItem, RefreshControl } from 'react-native';
import { Product } from '../types';
import { useTheme } from '../context/ThemeContext';

interface MenuGridProps {
  items: Product[];
  onAddItem: (product: Product) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function MenuGrid({ items, onAddItem, refreshing = false, onRefresh }: MenuGridProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const renderItem: ListRenderItem<Product> = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => onAddItem(item)}>
      <View style={styles.imageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.img} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>[IMG]</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.price}>{item.price.toFixed(2)} DH</Text>
        <View style={styles.addTag}>
          <Text style={styles.addText}>+ Ajouter</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      />
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, padding: 5 },
    card: {
      flex: 1,
      backgroundColor: theme.surfaceCardStrong,
      margin: 6,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    imageContainer: { height: 100, backgroundColor: theme.bgSurface2, justifyContent: 'center', alignItems: 'center' },
    img: { width: '100%', height: '100%' },
    emoji: { fontSize: 16, color: theme.textMuted },
    info: { padding: 10 },
    name: { color: theme.textMain, fontWeight: '700', fontSize: 14, marginBottom: 4 },
    price: { color: theme.primary, fontWeight: '700', marginBottom: 6 },
    addTag: { backgroundColor: theme.accent, paddingVertical: 4, borderRadius: 6, alignItems: 'center' },
    addText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  });
