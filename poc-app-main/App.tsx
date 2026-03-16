/**
 * Main App Component
 * Entry point for the application.
 *
 * Startup sequence:
 * 1. Check expo-secure-store for a stored OrgConfig.
 * 2. If found → configure Amplify + apiClient, show auth gate.
 * 3. If not found → show OrgSetupScreen (deep link / QR scanner).
 *
 * See docs/SolutionDesign.md § App Distribution — Runtime Configuration.
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { OfflineBanner } from './src/components/common/OfflineBanner';
import { OfflineProvider } from './src/context/OfflineContext';
import { TourProvider } from './src/context/TourContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { configureAmplify } from './src/config/amplify';
import { COLORS } from './src/constants/colors';
import { OrgConfig } from './src/types/config';
import { loadOrgConfig } from './src/services/config/orgConfigService';
import { setApiBaseUrl } from './src/services/api/apiClient';
import { logger } from './src/utils/logger';
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import NewPasswordScreen from './src/screens/auth/NewPasswordScreen';
import OrgSetupScreen from './src/screens/auth/OrgSetupScreen';

const TAG = 'App';

type AuthScreen = 'login' | 'newPassword';

// ---------------------------------------------------------------------------
// Apply runtime org config (Amplify + apiClient)
// ---------------------------------------------------------------------------

function applyOrgConfig(config: OrgConfig): void {
  configureAmplify(config);
  setApiBaseUrl(config.apiBaseUrl);
}

// ---------------------------------------------------------------------------
// AuthGate — login / new-password / dashboard
// ---------------------------------------------------------------------------

function AuthGate() {
  const { user, isLoading } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  // Reset to login screen whenever the user is signed out
  React.useEffect(() => {
    if (!user && !isLoading) {
      setAuthScreen('login');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    if (authScreen === 'newPassword') {
      return <NewPasswordScreen />;
    }
    return (
      <LoginScreen
        onNewPasswordRequired={() => setAuthScreen('newPassword')}
      />
    );
  }

  return (
    <TourProvider>
      <StatusBar style="auto" />
      <OfflineBanner />
      <DashboardScreen />
    </TourProvider>
  );
}

// ---------------------------------------------------------------------------
// Root component — handles OrgConfig bootstrap
// ---------------------------------------------------------------------------

type AppState =
  | { phase: 'loading' }
  | { phase: 'setup' }
  | { phase: 'ready' };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const storedConfig = await loadOrgConfig();

        if (cancelled) return;

        if (storedConfig) {
          applyOrgConfig(storedConfig);
          setState({ phase: 'ready' });
        } else {
          // Check if env-var fallback is available (dev mode)
          const envBaseUrl = process.env.EXPO_PUBLIC_TOUR_DATA_API_BASE_URL || '';
          const envPoolId = process.env.EXPO_PUBLIC_AWS_USER_POOL_ID || '';

          if (envBaseUrl && envPoolId) {
            logger.info(TAG, 'No stored org config — using env-var fallback (dev mode)');
            configureAmplify();
            setState({ phase: 'ready' });
          } else {
            logger.info(TAG, 'No org config found — showing setup screen');
            setState({ phase: 'setup' });
          }
        }
      } catch (err) {
        logger.error(TAG, 'Bootstrap error', err);
        if (!cancelled) {
          setState({ phase: 'setup' });
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfigured = (config: OrgConfig) => {
    applyOrgConfig(config);
    setState({ phase: 'ready' });
  };

  if (state.phase === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (state.phase === 'setup') {
    return (
      <SafeAreaProvider>
        <ErrorBoundary>
          <OrgSetupScreen onConfigured={handleConfigured} />
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <OfflineProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </OfflineProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
