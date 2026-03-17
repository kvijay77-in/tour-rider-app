/**
 * Offline Context — tracks network connectivity state.
 *
 * Uses @react-native-community/netinfo to detect connectivity changes
 * and exposes a simple isOffline boolean to the app.
 *
 * See docs/SolutionDesign.md § Offline Support.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { logger } from '../utils/logger';

const TAG = 'OfflineContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfflineContextValue {
  /** True when the device has no internet connectivity */
  isOffline: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
});

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

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      logger.debug(TAG, `Connectivity changed: ${offline ? 'OFFLINE' : 'ONLINE'}`, {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOffline }}>
      {children}
    </OfflineContext.Provider>
  );
}
