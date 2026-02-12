import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ListRenderItem, RefreshControl } from 'react-native';
import { Product } from '../types';
import { useTheme } from '../context/ThemeContext';

interface MenuGridProps {
  items: Product[];
  categories: string[];
  onAddItem: (product: Product) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function MenuGrid({ items, categories, onAddItem, refreshing = false, onRefresh }: MenuGridProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [showCats, setShowCats] = useState(false);
  const [selectedCat, setSelectedCat] = useState('Tous');

  const filtered = selectedCat === 'Tous' ? items : items.filter(i => i.category === selectedCat);

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
      <View style={{ zIndex: 1000 }}>
        <TouchableOpacity style={styles.dropdown} onPress={() => setShowCats(!showCats)}>
          <Text style={styles.dropdownText}>{selectedCat} v</Text>
        </TouchableOpacity>

        {showCats && (
          <View style={styles.catList}>
            <TouchableOpacity
              style={styles.catItem}
              onPress={() => {
                setSelectedCat('Tous');
                setShowCats(false);
              }}
            >
              <Text style={styles.catText}>Tous</Text>
            </TouchableOpacity>
            {categories.map(c => (
              <TouchableOpacity
                key={c}
                style={styles.catItem}
                onPress={() => {
                  setSelectedCat(c);
                  setShowCats(false);
                }}
              >
                <Text style={styles.catText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      />
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, padding: 5 },
    dropdown: {
      backgroundColor: theme.surfaceCard,
      padding: 12,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    dropdownText: { color: theme.textMain, fontWeight: '700', fontSize: 16 },
    catList: {
      backgroundColor: theme.surfaceCardStrong,
      borderRadius: 12,
      position: 'absolute',
      top: 50,
      width: '100%',
      zIndex: 1000,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
    },
    catItem: { padding: 14, borderBottomWidth: 1, borderColor: theme.border },
    catText: { color: theme.textMain, textAlign: 'center', fontWeight: '600' },
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
