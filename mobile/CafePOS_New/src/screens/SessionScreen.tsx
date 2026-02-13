import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useGlobal } from '../context/GlobalContext';
import { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';

type SessionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Session'>;

interface Props {
  navigation: SessionScreenNavigationProp;
}

export default function SessionScreen({ navigation }: Props) {
  const { user, activeSession, setActiveSession } = useGlobal();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        navigation.replace('Login');
        return;
      }

      let active = true;
      apiService.getOpenSession(user.id).then(({ data }) => {
        if (active) setActiveSession(data ?? null);
      });

      return () => {
        active = false;
      };
    }, [user, navigation, setActiveSession])
  );

  const handleOpen = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await apiService.openSession(user.id);
    setLoading(false);
    if (error || !data) {
      const details = error?.message ? `\n${error.message}` : '';
      Alert.alert('Erreur', `Impossible d’ouvrir la session${details}`);
      return;
    }
    setActiveSession(data);
    navigation.replace('Tables');
  };

  const handleClose = async () => {
    if (!activeSession?.id) return;
    setLoading(true);
    const { error } = await apiService.closeSession(activeSession.id);
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', 'Impossible de fermer la session');
      return;
    }
    setActiveSession(null);
    Alert.alert('Session fermee', 'Caisse cloturee avec succes');
    navigation.replace('Login');
  };

  const styles = getStyles(theme);
  const hasSession = !!activeSession?.id;

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" subtitle={user?.role === 'admin' ? 'ADMIN' : 'SERVEUR'} />
      <QuickNav current="Session" />

      <View style={styles.header}>
        <Text style={styles.title}>Session de Caisse</Text>
        <Text style={styles.subtitle}>{user?.name || 'Serveur'}</Text>
      </View>

      <View style={styles.card}>
        {hasSession ? (
          <>
            <Text style={styles.cardTitle}>Session ouverte</Text>
            <Text style={styles.metaText}>Debut: {new Date(activeSession.start_time).toLocaleString()}</Text>
            <Text style={styles.metaText}>Total ventes: {Number(activeSession.total_collecte ?? 0).toFixed(2)} DH</Text>

            <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleClose} disabled={loading}>
              <Text style={styles.btnText}>Fermer la Session</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Ouvrir une session</Text>
            <Text style={styles.metaText}>Aucune session active pour ce serveur.</Text>

            <TouchableOpacity style={styles.btn} onPress={handleOpen} disabled={loading}>
              <Text style={styles.btnText}>Ouvrir la Session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {loading && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBody, padding: 16, paddingTop: 50, paddingBottom: 90 },
    header: { marginBottom: 16 },
    title: { color: theme.textMain, fontSize: 22, fontWeight: '700' },
    subtitle: { color: theme.textMuted, marginTop: 4 },
    card: {
      backgroundColor: theme.surfaceCardStrong,
      borderRadius: theme.radius,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { color: theme.textMain, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    metaText: { color: theme.textMuted, marginBottom: 6 },
    btn: {
      marginTop: 16,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    btnDanger: { backgroundColor: theme.danger },
    btnText: { color: '#fff', fontWeight: '700' },
  });
