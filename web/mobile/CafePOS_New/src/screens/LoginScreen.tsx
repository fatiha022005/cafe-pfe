import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import BoutonClavier from '../components/BoutonClavier';
import { apiService } from '../services/api';
import { RootStackParamList } from '../types';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser } = useGlobal();

  const handlePress = (val: string) => {
    if (pin.length < 4) setPin(prev => prev + val);
  };

  const handleValidate = async () => {
    if (pin.length < 4) {
      Alert.alert('Erreur', 'PIN incomplet');
      return;
    }

    setLoading(true);
    const { data, error } = await apiService.loginWithPin(pin);
    setLoading(false);

    if (!error && data) {
      setUser(data);
      navigation.replace('Tables');
    } else {
      Alert.alert('Erreur', 'Code PIN incorrect');
      setPin('');
    }
  };

  const keys: (number | string)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AUTHENTIFICATION</Text>

      <View style={styles.display}>
        <Text style={styles.displayText}>{pin.length > 0 ? '*'.repeat(pin.length) : 'PIN'}</Text>
      </View>

      <View style={styles.grid}>
        {keys.map(n => (
          <BoutonClavier
            key={n}
            texte={n}
            auClic={() => (n === 'C' ? setPin('') : handlePress(n.toString()))}
            styleSpecial={n === 'C' ? { backgroundColor: '#B71C1C' } : undefined}
          />
        ))}
        <BoutonClavier texte="OK" auClic={handleValidate} styleSpecial={{ backgroundColor: '#10b981' }} />
      </View>

      {loading && <ActivityIndicator size="small" color="#4CAF50" style={{ marginTop: 10 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#888', letterSpacing: 2, marginBottom: 20, fontSize: 16 },
  display: {
    backgroundColor: '#1e1e1e',
    width: '80%',
    padding: 25,
    borderRadius: 12,
    marginBottom: 30,
    alignItems: 'center',
    minHeight: 90,
    justifyContent: 'center',
  },
  displayText: { color: 'white', fontSize: 32, letterSpacing: 8 },
  grid: { width: '90%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 },
});
