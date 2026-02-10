import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItem } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import { RootStackParamList, Table } from '../types';

type TablesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Tables'>;

interface Props {
  navigation: TablesScreenNavigationProp;
}

export default function TablesScreen({ navigation }: Props) {
  const { setActiveTable, user } = useGlobal();

  const tablesData: Table[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Table ${i + 1}`,
    status: 'libre',
  }));

  const handleTablePress = (item: Table) => {
    setActiveTable(item);
    navigation.navigate('Main');
  };

  const renderTable: ListRenderItem<Table> = ({ item }) => (
    <TouchableOpacity style={styles.tableCard} onPress={() => handleTablePress(item)} activeOpacity={0.8}>
      <Text style={styles.tableNumber}>T {item.id}</Text>
      <Text style={styles.tableStatus}>{item.status}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>SERVEUR : {user?.name || 'Inconnu'}</Text>

      <FlatList
        data={tablesData}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        renderItem={renderTable}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 50, paddingHorizontal: 10 },
  headerTitle: {
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  listContent: { paddingBottom: 20 },
  tableCard: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    height: 100,
    margin: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    elevation: 3,
  },
  tableNumber: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  tableStatus: { color: '#4CAF50', fontSize: 12, marginTop: 5, textTransform: 'uppercase' },
});
