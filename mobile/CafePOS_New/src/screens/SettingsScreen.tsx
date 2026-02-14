import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackScreenProps } from '@react-navigation/stack';
import { DrawerParamList, RootStackParamList } from '../types';
import { useGlobal } from '../context/GlobalContext';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../theme/theme';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import { useScale } from '../hooks/useScale';

type SettingsScreenProps = CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'Settings'>,
  StackScreenProps<RootStackParamList>
>;

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { setUser, activeSession, setActiveSession, user } = useGlobal();
  const { theme, mode, toggleTheme } = useTheme();
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, s, insets);

  const handleLogout = () => {
    Alert.alert('Deconnexion', 'Etes-vous sur de vouloir quitter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          if (activeSession?.id) {
            const { error } = await apiService.closeSession(activeSession.id);
            if (error) {
              console.error('Close session error', error);
            }
          }

          setActiveSession(null);
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
      <TopBar title="CafePOS" subtitle={user?.role === 'admin' ? 'ADMIN' : 'SERVEUR'} />
      <QuickNav current="Settings" />

      <Text style={styles.headerTitle}>Parametres</Text>

      <Text style={styles.sectionTitle}>APPARENCE</Text>
      <TouchableOpacity style={styles.row} onPress={toggleTheme}>
        <Text style={styles.label}>Theme</Text>
        <Text style={styles.value}>{mode === THEMES.DARK ? 'Noir Cafe' : 'Latte'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>SESSION</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Session</Text>
        <Text style={styles.value}>{activeSession ? 'Ouverte' : 'Fermee'}</Text>
      </View>
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Session')}>
        <Text style={styles.label}>Ouvrir / Fermer caisse</Text>
        <Text style={styles.chevron}>{'>'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>MATERIEL</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Imprimante Bluetooth</Text>
        <Switch
          value={false}
          trackColor={{ false: '#767577', true: theme.accent }}
          thumbColor="#f4f3f4"
          onValueChange={() => Alert.alert('Info', 'Module Bluetooth bientot disponible')}
        />
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>Deconnexion</Text>
      </TouchableOpacity>

    </View>
  );
}

const getStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  s: (value: number) => number,
  insets: { top: number; bottom: number }
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgBody,
      padding: s(16),
      paddingTop: insets.top + s(20),
      paddingBottom: insets.bottom,
    },
    headerTitle: { color: theme.textMain, fontSize: 22, fontWeight: '700', marginBottom: 16 },
    sectionTitle: {
      color: theme.primary,
      fontWeight: '700',
      marginTop: 24,
      marginBottom: 10,
      fontSize: 12,
      letterSpacing: 1,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      backgroundColor: theme.surfaceCardStrong,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    label: { color: theme.textMain, fontSize: 16, fontWeight: '600' },
    value: { color: theme.textMuted, fontSize: 14 },
    chevron: { color: theme.textMuted, fontSize: 20, fontWeight: 'bold' },
    logout: { marginTop: 32, backgroundColor: theme.danger, padding: 15, borderRadius: 12, alignItems: 'center' },
    logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
