import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackScreenProps } from '@react-navigation/stack';
import { DrawerParamList, RootStackParamList } from '../types';
import { useGlobal } from '../context/GlobalContext';

type SettingsScreenProps = CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'Settings'>,
  StackScreenProps<RootStackParamList>
>;

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { setUser } = useGlobal();

  const handleLogout = () => {
    Alert.alert('Deconnexion', 'Etes-vous sur de vouloir quitter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: () => {
          setUser(null);
          const parent = navigation.getParent();
          if (parent) {
            parent.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Parametres</Text>

      <Text style={styles.sectionTitle}>MATERIEL</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Imprimante Bluetooth</Text>
        <Switch
          value={false}
          trackColor={{ false: '#767577', true: '#4CAF50' }}
          thumbColor="#f4f3f4"
          onValueChange={() => Alert.alert('Info', 'Module Bluetooth bientot disponible')}
        />
      </View>

      <Text style={styles.sectionTitle}>SYSTEME</Text>
      <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Info', 'Changement PIN')}>
        <Text style={styles.label}>Changer le PIN de securite</Text>
        <Text style={styles.chevron}>{'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>Deconnexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 60 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  sectionTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 10,
    fontSize: 12,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 5,
  },
  label: { color: 'white', fontSize: 16 },
  chevron: { color: '#666', fontSize: 20, fontWeight: 'bold' },
  logout: { marginTop: 50, backgroundColor: '#CF6679', padding: 15, borderRadius: 8, alignItems: 'center' },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
