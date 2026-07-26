/**
 * Authenticated app subtree.
 *
 * Mounts authenticated-only providers and renders the main tab navigator.
 */

import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RiderProvider } from '../context/RiderContext';
import { TourProvider } from '../context/TourContext';
import { useAuth } from '../hooks/useAuth';
import { useRider } from '../hooks/useRider';
import { MainDrawerNavigator } from './MainDrawerNavigator';
import { ProfileCreationScreen } from '../screens/profile/ProfileCreationScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import type { AppStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AppStackParamList>();

function AuthenticatedStack() {
  const { user, postLoginRedirect, clearPostLoginRedirect } = useAuth();
  const { hasProfile, isLoading: isLoadingProfile } = useRider();

  const shouldForceProfileCreation = Boolean(user) && !isLoadingProfile && !hasProfile;

  useEffect(() => {
    if (postLoginRedirect) {
      clearPostLoginRedirect();
    }
  }, [postLoginRedirect, clearPostLoginRedirect]);

  useEffect(() => {
    if (!shouldForceProfileCreation) {
      return;
    }

    Alert.alert(
      'Profile Required',
      'Profile must be created to use the App',
      [{ text: 'OK' }],
    );
  }, [shouldForceProfileCreation]);

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
        <AuthenticatedStack />
      </TourProvider>
    </RiderProvider>
  );
}
