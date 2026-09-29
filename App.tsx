/**
 * Main App Component — Entry point for the Tour Rider App.
 *
 * Startup sequence:
 * 1. Configure Amplify Auth (dedicated rider Cognito User Pool)
 * 2. Wrap app with root providers (Auth)
 * 3. Show RootNavigator which switches auth/app subtrees
 *
 * See docs/SolutionDesign.md § Application Architecture.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';

import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { configureAmplify } from './src/config/amplify';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';

// Configure Amplify Auth on app start
configureAmplify();

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
