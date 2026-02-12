import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import BoutonClavier from '../components/BoutonClavier';
import { apiService } from '../services/api';
import { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser, setActiveSession } = useGlobal();
  const { theme } = useTheme();
  const styles = getStyles(theme);

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
    if (error || !data) {
      setLoading(false);
      Alert.alert('Erreur', 'Code PIN incorrect');
      setPin('');
      return;
    }

    setUser(data);

    const { data: session } = await apiService.getOpenSession(data.id);
    setActiveSession(session ?? null);

    setLoading(false);
    navigation.replace(session ? 'Tables' : 'Session');
  };

  const keys: (number | string)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0];

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" subtitle="ADMIN" showThemeToggle />

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
            styleSpecial={n === 'C' ? { backgroundColor: theme.danger } : undefined}
          />
        ))}
        <BoutonClavier texte="OK" auClic={handleValidate} styleSpecial={{ backgroundColor: theme.primary }} />
      </View>

      {loading && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} />}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBody, justifyContent: 'center', alignItems: 'center', padding: 16 },
    title: { color: theme.textMuted, letterSpacing: 2, marginBottom: 20, fontSize: 16 },
    display: {
      backgroundColor: theme.surfaceCardStrong,
      width: '80%',
      padding: 25,
      borderRadius: 12,
      marginBottom: 30,
      alignItems: 'center',
      minHeight: 90,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    displayText: { color: theme.textMain, fontSize: 32, letterSpacing: 8 },
    grid: { width: '90%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 },
  });
