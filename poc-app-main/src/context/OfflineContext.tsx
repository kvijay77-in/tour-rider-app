/**
 * Offline Context — detects network connectivity and exposes offline state.
 *
 * Uses @react-native-community/netinfo to auto-detect connectivity loss.
 * When offline, the app shows a status banner instead of cached data.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { logger } from '../utils/logger';

const TAG = 'OfflineContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfflineContextValue {
  /** True when NetInfo reports no connectivity */
  isOffline: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
});

/**
 * Hook to access offline state.
 */
export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface OfflineProviderProps {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOffline, setIsOffline] = useState(false);

  // Subscribe to NetInfo connectivity changes (event-driven, not polling)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function setupNetInfo() {
      try {
        // Dynamic import to avoid issues in web environments
        const NetInfo = await import('@react-native-community/netinfo');
        unsubscribe = NetInfo.default.addEventListener((state) => {
          const offline = !(state.isConnected && state.isInternetReachable !== false);
          setIsOffline(offline);
        });
      } catch (e) {
        // NetInfo not available (web environment) — assume online
        logger.warn(TAG, 'NetInfo not available, assuming online', e);
        setIsOffline(false);
      }
    }

    setupNetInfo();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOffline }}>
      {children}
    </OfflineContext.Provider>
  );
}
