import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GlobalProvider } from './src/context/GlobalContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { RootStackParamList, DrawerParamList } from './src/types';
import { THEMES } from './src/theme/theme';

import LoginScreen from './src/screens/LoginScreen';
import TablesScreen from './src/screens/TablesScreen';
import GrilleScreen from './src/screens/GrilleScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import SessionScreen from './src/screens/SessionScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

function MainDrawer() {
  const { theme } = useTheme();
  return (
    <Drawer.Navigator
      id="MainDrawer"
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: theme.bgSurface, width: 260 },
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.textMain,
        drawerType: 'front',
        sceneContainerStyle: { backgroundColor: theme.bgBody },
      }}
    >
      <Drawer.Screen name="Vente" component={GrilleScreen} options={{ title: 'Nouvelle Vente' }} />
      <Drawer.Screen name="Commandes" component={OrdersScreen} options={{ title: 'Commandes' }} />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: 'Historique' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Parametres' }} />
    </Drawer.Navigator>
  );
}

function AppNavigator() {
  const { theme, mode } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: mode === THEMES.DARK,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.bgBody,
      card: theme.bgSurface,
      text: theme.textMain,
      border: theme.border,
      notification: theme.accent,
    },
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={mode === THEMES.DARK ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Session" component={SessionScreen} />
          <Stack.Screen name="Tables" component={TablesScreen} />
          <Stack.Screen name="Main" component={MainDrawer} />
          <Stack.Screen name="Ticket" component={CheckoutScreen} />
          <Stack.Screen name="Paiement" component={PaymentScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <GlobalProvider>
          <AppNavigator />
        </GlobalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
