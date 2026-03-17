/**
 * Main bottom-tab navigator — authenticated screens.
 *
 * Tabs: Home, Check-In (enrolled only), Notifications (enrolled only), Profile.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants';
import type { MainTabParamList } from '../types/navigation';
import { useTour } from '../hooks/useTour';
import { HomeScreen } from '../screens/home/HomeScreen';
import { CheckInStatusScreen } from '../screens/checkin/CheckInStatusScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof MainTabParamList, IoniconsName> = {
  HomeTab: 'home-outline',
  CheckInTab: 'checkmark-circle-outline',
  NotificationsTab: 'notifications-outline',
  ProfileTab: 'person-outline',
};

export function MainNavigator() {
  const { isEnrolled } = useTour();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[400],
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      {isEnrolled ? (
        <Tab.Screen
          name="CheckInTab"
          component={CheckInStatusScreen}
          options={{ tabBarLabel: 'Check-In' }}
        />
      ) : null}
      {isEnrolled ? (
        <Tab.Screen
          name="NotificationsTab"
          component={NotificationsScreen}
          options={{ tabBarLabel: 'Notifications' }}
        />
      ) : null}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
