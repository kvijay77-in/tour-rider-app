/**
 * Main drawer navigator for authenticated users.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { TrainingChallengeScreen } from '../screens/training/TrainingChallengeScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { NotificationBell } from '../components/common/NotificationBell';
import { DrawerContent } from './DrawerContent';
import { TourStackNavigator } from './TourStackNavigator';
import { EventsStackNavigator } from './EventsStackNavigator';
import type { AppStackParamList, MainDrawerParamList } from '../types/navigation';

const Drawer = createDrawerNavigator<MainDrawerParamList>();

type MainDrawerNavigatorProps = {
  route?: RouteProp<AppStackParamList, 'MainTabs'>;
};

export function MainDrawerNavigator({ route }: MainDrawerNavigatorProps) {
  const { logout } = useAuth();
  const successMessage = route?.params?.successMessage;

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerRight: () => (
          <View style={styles.headerActions}>
            <NotificationBell onPress={() => navigation.navigate('Notifications')} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              hitSlop={8}
              onPress={() => {
                logout().catch(() => {});
              }}
              style={({ pressed }) => [styles.logoutButton, pressed ? styles.pressed : null]}
            >
              <Ionicons name="log-out-outline" size={24} color={COLORS.textPrimary} />
            </Pressable>
          </View>
        ),
        drawerActiveTintColor: COLORS.primary,
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
        },
      })}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        initialParams={successMessage ? { successMessage } : undefined}
        options={{
          title: 'Home',
        }}
      />
      <Drawer.Screen
        name="ViewProfile"
        component={ProfileScreen}
        options={{ title: 'View Profile' }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Drawer.Screen
        name="TrainingChallenge"
        component={TrainingChallengeScreen}
        options={{ title: 'Training Challenge' }}
      />
      <Drawer.Screen
        name="Tour"
        component={TourStackNavigator}
        options={{
          title: 'Tour',
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Events"
        component={EventsStackNavigator}
        options={{
          title: 'Events',
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Change Password' }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutButton: {
    padding: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});

export default MainDrawerNavigator;
