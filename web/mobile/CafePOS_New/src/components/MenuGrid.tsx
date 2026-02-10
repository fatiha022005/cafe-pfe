import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ListRenderItem } from 'react-native';
import { Product } from '../types';

interface MenuGridProps {
  items: Product[];
  categories: string[];
  onAddItem: (product: Product) => void;
}

export default function MenuGrid({ items, categories, onAddItem }: MenuGridProps) {
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 5 },
  dropdown: {
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    alignItems: 'center',
  },
  dropdownText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  catList: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    position: 'absolute',
    top: 50,
    width: '100%',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
  },
  catItem: { padding: 15, borderBottomWidth: 1, borderColor: '#3A3A3C' },
  catText: { color: 'white', textAlign: 'center' },
  card: { flex: 1, backgroundColor: '#1C1C1E', margin: 5, borderRadius: 12, overflow: 'hidden', elevation: 2 },
  imageContainer: { height: 100, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' },
  img: { width: '100%', height: '100%' },
  emoji: { fontSize: 16, color: '#aaa' },
  info: { padding: 8 },
  name: { color: 'white', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  price: { color: '#FF9F0A', fontWeight: 'bold', marginBottom: 6 },
  addTag: { backgroundColor: '#32D74B', paddingVertical: 4, borderRadius: 4, alignItems: 'center' },
  addText: { color: 'black', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
});
