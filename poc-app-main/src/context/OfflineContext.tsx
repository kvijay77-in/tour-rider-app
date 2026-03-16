/**
 * Offline Context — manages connectivity state and manual offline toggle.
 * 
 * Per design (§4.3):
 * - Automatic detection via @react-native-community/netinfo (event-driven)
 * - Manual toggle for user control when connectivity is unstable
 * - Effective offline = manual toggle ON **or** NetInfo reports no connectivity
 * - Both sync processes (outbound + inbound) pause when offline
 * 
 * Per updated Requirements.md:
 * - Users must have an option to turn on/off 'Offline mode' manually
 * - Offline mode indicator required at Dashboard level
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfflineContextValue {
  /** True when the app is in effective offline mode (manual OR auto-detected) */
  isOffline: boolean;
  /** True when the manual offline toggle is ON */
  isManualOffline: boolean;
  /** True when NetInfo reports no connectivity */
  isAutoDetectedOffline: boolean;
  /** Toggle manual offline mode */
  setManualOffline: (offline: boolean) => void;
  /** Human-readable status for indicator */
  offlineReason: 'manual' | 'no-connectivity' | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  isManualOffline: false,
  isAutoDetectedOffline: false,
  setManualOffline: () => {},
  offlineReason: null,
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
  const [isManualOffline, setManualOffline] = useState(false);
  const [isAutoDetectedOffline, setAutoDetectedOffline] = useState(false);

  // Subscribe to NetInfo connectivity changes (event-driven, not polling)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function setupNetInfo() {
      try {
        // Dynamic import to avoid issues in test/web environments
        const NetInfo = await import('@react-native-community/netinfo');
        unsubscribe = NetInfo.default.addEventListener((state) => {
          const offline = !(state.isConnected && state.isInternetReachable !== false);
          setAutoDetectedOffline(offline);
        });
      } catch (e) {
        // NetInfo not available (web or test environment) — assume online
        console.warn('[OfflineContext] NetInfo not available, assuming online:', e);
        setAutoDetectedOffline(false);
      }
    }

    setupNetInfo();

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Effective offline = manual toggle OR auto-detected
  const isOffline = isManualOffline || isAutoDetectedOffline;

  const offlineReason: 'manual' | 'no-connectivity' | null = isManualOffline
    ? 'manual'
    : isAutoDetectedOffline
      ? 'no-connectivity'
      : null;

  const value: OfflineContextValue = {
    isOffline,
    isManualOffline,
    isAutoDetectedOffline,
    setManualOffline,
    offlineReason,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}
