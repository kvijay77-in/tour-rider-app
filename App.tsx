/**
 * Main App Component — Entry point for the Tour Rider App.
 *
 * Startup sequence:
 * 1. Configure Amplify Auth (dedicated rider Cognito User Pool)
 * 2. Wrap app with context providers (Auth → Rider → Tour)
 * 3. Show AppNavigator which handles auth/main flow
 *
 * See docs/SolutionDesign.md § Application Architecture.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { configureAmplify } from './src/config/amplify';
import { AuthProvider } from './src/context/AuthContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { RiderProvider } from './src/context/RiderContext';
import { TourProvider } from './src/context/TourContext';
import { AppNavigator } from './src/navigation/AppNavigator';

// Configure Amplify Auth on app start
configureAmplify();

export default function App() {
  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <AuthProvider>
          <RiderProvider>
            <TourProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </TourProvider>
          </RiderProvider>
        </AuthProvider>
      </OfflineProvider>
    </SafeAreaProvider>
  );
}
