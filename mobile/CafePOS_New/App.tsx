import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalProvider } from './src/context/GlobalContext';

import { RootStackParamList, DrawerParamList } from './src/types';

import LoginScreen from './src/screens/LoginScreen';
import TablesScreen from './src/screens/TablesScreen';
import GrilleScreen from './src/screens/GrilleScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PaymentScreen from './src/screens/PaymentScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

function MainDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: '#212121', width: 250 },
        drawerActiveTintColor: '#4CAF50',
        drawerInactiveTintColor: 'white',
      }}
    >
      <Drawer.Screen name="Vente" component={GrilleScreen} options={{ title: 'Nouvelle Vente' }} />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: 'Historique' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Parametres' }} />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GlobalProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Tables" component={TablesScreen} />
              <Stack.Screen name="Main" component={MainDrawer} />
              <Stack.Screen name="Ticket" component={CheckoutScreen} />
              <Stack.Screen name="Paiement" component={PaymentScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </GlobalProvider>
    </GestureHandlerRootView>
  );
}
