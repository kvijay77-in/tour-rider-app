/**
 * Main drawer navigator for authenticated users.
 */

import React from 'react';
import { Pressable } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { TrainingChallengeScreen } from '../screens/training/TrainingChallengeScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { DrawerContent } from './DrawerContent';
import { TourStackNavigator } from './TourStackNavigator';
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
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: COLORS.primary,
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
        },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        initialParams={successMessage ? { successMessage } : undefined}
        options={{
          title: 'Home',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              hitSlop={8}
              onPress={() => {
                logout().catch(() => {});
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                padding: 4,
              })}
            >
              <Ionicons name="log-out-outline" size={24} color={COLORS.textPrimary} />
            </Pressable>
          ),
        }}
      />
      <Drawer.Screen
        name="ViewProfile"
        component={ProfileScreen}
        options={{ title: 'View Profile' }}
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
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Change Password' }}
      />
    </Drawer.Navigator>
  );
}

export default MainDrawerNavigator;
