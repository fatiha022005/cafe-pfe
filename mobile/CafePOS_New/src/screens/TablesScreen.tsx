import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItem, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { useGlobal } from '../context/GlobalContext';
import { apiService } from '../services/api';
import { RootStackParamList, Table } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';

type TablesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Tables'>;

interface Props {
  navigation: TablesScreenNavigationProp;
}

export default function TablesScreen({ navigation }: Props) {
  const { setActiveTable, user, activeSession, setActiveSession } = useGlobal();
  const [tablesData, setTablesData] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const styles = getStyles(theme);

  useEffect(() => {
    loadTables();
  }, []);

  const refreshSession = useCallback(async () => {
    if (!user?.id) return null;
    const { data } = await apiService.getOpenSession(user.id);
    setActiveSession(data ?? null);
    return data ?? null;
  }, [user?.id, setActiveSession]);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const loadTables = async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    const { data, error } = await apiService.getTables();
    if (!error && data) {
      setTablesData(data);
    } else {
      console.error('Tables fetch error', error);
      setTablesData([]);
      setError('Impossible de charger les tables.');
    }
    if (opts?.refresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadTables({ refresh: true });
    refreshSession();
  };

  const handleTablePress = (item: Table) => {
    if (item.is_active === false) return;
    setActiveTable(item);
    navigation.navigate('Main');
  };

  const renderTable: ListRenderItem<Table> = ({ item }) => {
    const statusLabel = item.is_active === false ? 'indisponible' : 'libre';
    return (
      <TouchableOpacity
        style={[styles.tableCard, item.is_active === false && styles.tableCardDisabled]}
        onPress={() => handleTablePress(item)}
        activeOpacity={0.8}
        disabled={item.is_active === false}
      >
        <Text style={styles.tableNumber}>{item.label}</Text>
        <Text style={[styles.tableStatus, item.is_active === false && styles.tableStatusInactive]}>{statusLabel}</Text>
      </TouchableOpacity>
    );
  };

  const roleLabel = user?.role === 'admin' ? 'ADMIN' : 'SERVEUR';

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" subtitle={roleLabel} />
      <QuickNav current="Tables" />

      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>SERVEUR : {user?.name || 'Inconnu'}</Text>
        <Text style={styles.headerSub}>
          Session: {activeSession ? 'Ouverte' : 'Fermee'}
          {activeSession?.start_time ? ` · ${new Date(activeSession.start_time).toLocaleTimeString()}` : ''}
        </Text>
      </View>

      {loading && tablesData.length === 0 ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <FlatList
            data={tablesData}
            numColumns={3}
            keyExtractor={item => item.id.toString()}
            renderItem={renderTable}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune table disponible</Text>}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        </>
      )}

    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBody, paddingTop: 50, paddingHorizontal: 10, paddingBottom: 90 },
    headerBox: {
      backgroundColor: theme.surfaceGlass,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    headerTitle: {
      color: theme.textMain,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 1,
    },
    headerSub: { color: theme.textMuted, textAlign: 'center', marginTop: 4 },
    listContent: { paddingBottom: 20 },
    tableCard: {
      flex: 1,
      backgroundColor: theme.surfaceCardStrong,
      height: 100,
      margin: 8,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      elevation: 2,
    },
    tableCardDisabled: { opacity: 0.5 },
    tableNumber: { color: theme.textMain, fontSize: 24, fontWeight: '700' },
    tableStatus: { color: theme.success, fontSize: 12, marginTop: 5, textTransform: 'uppercase' },
    tableStatusInactive: { color: theme.warning },
    errorText: { color: theme.warning, textAlign: 'center', marginBottom: 10 },
    emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 20 },
  });
