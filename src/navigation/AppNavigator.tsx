/**
 * Authenticated app subtree.
 *
 * Mounts authenticated-only providers and renders the main tab navigator.
 */

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RiderProvider } from '../context/RiderContext';
import { TourProvider } from '../context/TourContext';
import { NotificationProvider } from '../context/NotificationContext';
import { useAuth } from '../hooks/useAuth';
import { useRider } from '../hooks/useRider';
import { MainDrawerNavigator } from './MainDrawerNavigator';
import { ProfileCreationScreen } from '../screens/profile/ProfileCreationScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import type { AppStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AppStackParamList>();

function AuthenticatedStack() {
  const { user, postLoginRedirect, clearPostLoginRedirect } = useAuth();
  const {
    hasCompleteProfileForAccess,
    hasProfile,
    isLoading: isLoadingProfile,
    isLoadingDefinitions,
  } = useRider();

  const shouldForceProfileCreation = Boolean(user)
    && !isLoadingProfile
    && !isLoadingDefinitions
    && (!hasProfile || !hasCompleteProfileForAccess || postLoginRedirect === 'ProfileCreation');

  useEffect(() => {
    if (postLoginRedirect) {
      clearPostLoginRedirect();
    }
  }, [postLoginRedirect, clearPostLoginRedirect]);

  const initialRouteName: keyof AppStackParamList = shouldForceProfileCreation
    ? 'ProfileCreation'
    : (postLoginRedirect ?? 'MainTabs');

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      {!shouldForceProfileCreation ? (
        <Stack.Screen name="MainTabs" component={MainDrawerNavigator} />
      ) : null}
      <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <RiderProvider>
      <TourProvider>
        <NotificationProvider>
          <AuthenticatedStack />
        </NotificationProvider>
      </TourProvider>
    </RiderProvider>
  );
}
