/**
 * Main App Component — Entry point for the Tour Rider App.
 *
 * Startup sequence:
 * 1. Configure Amplify Auth (dedicated rider Cognito User Pool)
 * 2. Initialise store-reviewer backend routing (primary profile)
 * 3. Wrap app with root providers (Auth) and the Test-variant banner
 * 4. Show RootNavigator which switches auth/app subtrees
 *
 * See docs/design/architecture.md and docs/design/app-variants-and-environments.md.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';

import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { TestVariantBanner } from './src/components/common/TestVariantBanner';
import { configureAmplify } from './src/config/amplify';
import { getAppVariant } from './src/config/appVariant';
import { initBackendRouting } from './src/config/reviewAccess';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { getApiBaseUrl } from './src/services/api/apiClient';
import { logger } from './src/utils/logger';

function getApiHost(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match?.[1] ?? 'not configured';
}

// Configure Amplify Auth on app start
configureAmplify();
initBackendRouting();
logger.info('App', `Variant: ${getAppVariant()}, API host: ${getApiHost(getApiBaseUrl())}`);

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <TestVariantBanner>
          <AuthProvider>
            <StatusBar style="auto" />
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </TestVariantBanner>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
