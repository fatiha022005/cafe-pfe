import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGlobal } from '../context/GlobalContext';
import { apiService } from '../services/api';
import { PaymentMethod, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import TopBar from '../components/TopBar';
import QuickNav from '../components/QuickNav';
import { useScale } from '../hooks/useScale';

type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Paiement'>;
type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'Paiement'>;

interface Props {
  navigation: PaymentScreenNavigationProp;
  route: PaymentScreenRouteProp;
}

export default function PaymentScreen({ navigation, route }: Props) {
  const { cart, clearOrder, activeTable, user, activeSession, setActiveSession } = useGlobal();
  const [loading, setLoading] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [cardInput, setCardInput] = useState('');
  const { theme } = useTheme();
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, s, insets);

  const orderId = route.params?.orderId;
  const total = orderId ? Number(route.params?.total ?? 0) : cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const parseAmount = (value: string) => {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const cashAmount = parseAmount(cashInput);
  const cardAmount = parseAmount(cardInput);
  const splitTotal = cashAmount + cardAmount;
  const splitDiff = total - splitTotal;
  const splitValid = splitMode && Number.isFinite(cashAmount) && Number.isFinite(cardAmount) && Math.abs(splitDiff) <= 0.01;
  const splitInvalid = splitMode && (!Number.isFinite(cashAmount) || !Number.isFinite(cardAmount));

  const toggleSplit = () => {
    if (splitMode) {
      setSplitMode(false);
      setCashInput('');
      setCardInput('');
      return;
    }
    setSplitMode(true);
    setCashInput(total.toFixed(2));
    setCardInput('0');
  };

  const finalizePayment = async (input: {
    paymentMethod: PaymentMethod;
    modeLabel: string;
    cashAmount?: number | null;
    cardAmount?: number | null;
  }) => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Utilisateur manquant');
      navigation.replace('Login');
      return;
    }

    if (!orderId && cart.length === 0) {
      Alert.alert('Erreur', 'Panier vide');
      return;
    }

    const { data: latestSession, error: sessionError } = await apiService.getOpenSession(user.id);
    if (sessionError) {
      Alert.alert('Erreur', 'Impossible de verifier la session');
      return;
    }

    if (!latestSession?.id) {
      setActiveSession(null);
      Alert.alert('Session requise', 'Ouvrez une session de caisse avant de vendre.');
      navigation.navigate('Session');
      return;
    }

    if (!activeSession || activeSession.id !== latestSession.id) {
      setActiveSession(latestSession);
    }

    const paymentMethod = input.paymentMethod;
    setLoading(true);

    try {
      if (orderId) {
        const { data, error } = await apiService.completePendingOrder({
          orderId,
          userId: user.id,
          paymentMethod,
          sessionId: latestSession.id,
          cashAmount: input.cashAmount ?? null,
          cardAmount: input.cardAmount ?? null,
        });

        if (error || !data) {
          const msg = error?.message || 'Impossible de finaliser la commande';
          Alert.alert('Erreur', msg);
          return;
        }

        const modeLine =
          paymentMethod === 'split'
            ? `Espèces: ${Number(input.cashAmount ?? 0).toFixed(2)} DH\nCarte: ${Number(input.cardAmount ?? 0).toFixed(
                2
              )} DH`
            : `Mode: ${input.modeLabel}`;
        Alert.alert('Paiement Reussi', `Montant: ${total.toFixed(2)} DH\n${modeLine}\nCommande #${data.order_number}`, [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main', params: { screen: 'Commandes' } }],
              });
            },
          },
        ]);
        return;
      }

      const { data, error } = await apiService.createOrder({
        userId: user.id,
        sessionId: latestSession.id,
        items: cart,
        paymentMethod,
        tableId: activeTable?.id ?? null,
        cashAmount: input.cashAmount ?? null,
        cardAmount: input.cardAmount ?? null,
      });

      if (error || !data) {
        const msg = error?.message || 'Impossible de sauvegarder la commande';
        Alert.alert('Erreur', msg);
        return;
      }

      const modeLine =
        paymentMethod === 'split'
          ? `Espèces: ${Number(input.cashAmount ?? 0).toFixed(2)} DH\nCarte: ${Number(input.cardAmount ?? 0).toFixed(2)} DH`
          : `Mode: ${input.modeLabel}`;
      Alert.alert('Paiement Reussi', `Montant: ${total.toFixed(2)} DH\n${modeLine}\nCommande #${data.order_number}`, [
        {
          text: 'OK',
          onPress: () => {
            clearOrder();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Tables' }],
            });
          },
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Erreur', message || 'Impossible de finaliser la commande');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (modeLabel: 'ESPECES' | 'CB') => {
    const paymentMethod: PaymentMethod = modeLabel === 'CB' ? 'card' : 'cash';
    await finalizePayment({ paymentMethod, modeLabel });
  };

  const handleSplitFinalize = async () => {
    if (!splitValid) {
      Alert.alert('Erreur', 'Verifier les montants de paiement.');
      return;
    }
    await finalizePayment({
      paymentMethod: 'split',
      modeLabel: 'SPLIT',
      cashAmount,
      cardAmount,
    });
  };

  return (
    <View style={styles.container}>
      <TopBar title="CafePOS" subtitle={user?.role === 'admin' ? 'ADMIN' : 'SERVEUR'} />
      <QuickNav current={orderId ? 'Commandes' : 'Vente'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.icon}>{'<-'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSplit}>
          <Text style={[styles.split, splitMode && styles.splitActive]}>{splitMode ? 'ANNULER' : 'DIVISER'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amountText}>{total.toFixed(2)} DH</Text>
        <Text style={styles.subtext}>Total a payer</Text>
        {activeTable && !orderId && <Text style={styles.tableInfo}>Table {activeTable.label}</Text>}
      </View>

      {splitMode && (
        <View style={styles.splitBox}>
          <Text style={styles.splitTitle}>Paiement partage</Text>
          <View style={styles.splitRow}>
            <View style={styles.splitField}>
              <Text style={styles.splitLabel}>Especes</Text>
              <TextInput
                style={styles.splitInput}
                value={cashInput}
                onChangeText={setCashInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={styles.splitField}>
              <Text style={styles.splitLabel}>Carte</Text>
              <TextInput
                style={styles.splitInput}
                value={cardInput}
                onChangeText={setCardInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
          <Text style={[styles.splitHint, splitValid ? styles.splitHintOk : styles.splitHintWarn]}>
            {splitInvalid ? 'Montant invalide' : `Reste: ${splitDiff.toFixed(2)} DH`}
          </Text>
          <TouchableOpacity
            style={[styles.payBtn, styles.splitPayBtn, (!splitValid || loading) && styles.payBtnDisabled]}
            onPress={handleSplitFinalize}
            disabled={!splitValid || loading}
          >
            <Text style={[styles.payIcon, styles.splitPayIcon]}>SPLIT</Text>
            <Text style={[styles.payText, styles.splitPayText]}>VALIDER PAIEMENT</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.payBtn, splitMode && styles.payBtnDisabled]}
        onPress={() => handleFinalize('ESPECES')}
        disabled={loading || splitMode}
      >
        <Text style={styles.payIcon}>CASH</Text>
        <Text style={styles.payText}>ESPECES</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.payBtn, splitMode && styles.payBtnDisabled]}
        onPress={() => handleFinalize('CB')}
        disabled={loading || splitMode}
      >
        <Text style={styles.payIcon}>CB</Text>
        <Text style={styles.payText}>CARTE BANCAIRE</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} />}
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
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    icon: { color: theme.textMain, fontSize: 20 },
    split: { color: theme.primary, fontWeight: '700', fontSize: 16, marginTop: 5 },
    splitActive: { color: theme.warning },
    amountContainer: { alignItems: 'center', marginVertical: 40 },
    amountText: { color: theme.textMain, fontSize: 48, fontWeight: '700' },
    subtext: { color: theme.textMuted, fontSize: 16, marginTop: 10 },
    tableInfo: { color: theme.accent, fontSize: 18, marginTop: 5, fontWeight: '700' },
    splitBox: {
      backgroundColor: theme.surfaceGlass,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    splitTitle: { color: theme.textMain, fontWeight: '700', fontSize: 14, marginBottom: 12 },
    splitRow: { flexDirection: 'row', gap: 12 },
    splitField: { flex: 1 },
    splitLabel: { color: theme.textMuted, fontSize: 12, marginBottom: 6 },
    splitInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: theme.textMain,
      backgroundColor: theme.bgSurface,
    },
    splitHint: { marginTop: 10, fontSize: 12 },
    splitHintOk: { color: theme.accent },
    splitHintWarn: { color: theme.warning },
    payBtn: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceCardStrong,
      padding: 22,
      borderRadius: 12,
      marginBottom: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    splitPayBtn: {
      marginTop: 14,
      marginBottom: 0,
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    payBtnDisabled: { opacity: 0.5 },
    payIcon: { fontSize: 16, marginRight: 20, color: theme.textMain },
    payText: { color: theme.textMain, fontWeight: '700', fontSize: 18, letterSpacing: 1 },
    splitPayIcon: { color: '#fff' },
    splitPayText: { color: '#fff' },
  });
