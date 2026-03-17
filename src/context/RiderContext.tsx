/**
 * Rider Context — manages the authenticated rider's profile.
 *
 * Depends on AuthContext — loads the rider profile once the user is
 * authenticated and provides CRUD operations for profile management.
 *
 * See docs/SolutionDesign.md § Rider Profile.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';
import { getRiderProfile, updateRiderProfile } from '../services/api/riderApi';
import { logger } from '../utils/logger';
import type { RiderProfile, UpdateRiderProfileRequest } from '../types/rider';

const TAG = 'RiderContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiderContextValue {
  /** The rider's profile, or null if not yet loaded */
  profile: RiderProfile | null;
  /** True while loading the profile */
  isLoading: boolean;
  /** Error message from the last profile operation */
  error: string | null;
  /** Load (or reload) the rider profile from the API */
  loadProfile: () => Promise<void>;
  /** Update the rider profile with the given data */
  updateProfile: (data: UpdateRiderProfileRequest) => Promise<void>;
  /** Alias for loadProfile — refreshes profile from the API */
  refreshProfile: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RiderContext = createContext<RiderContextValue>({
  profile: null,
  isLoading: false,
  error: null,
  loadProfile: async () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
});

export function useRider(): RiderContextValue {
  return useContext(RiderContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface RiderProviderProps {
  children: React.ReactNode;
}

export function RiderProvider({ children }: RiderProviderProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (): Promise<void> => {
    if (!user?.profileId) {
      logger.debug(TAG, 'No profileId available — skipping profile load');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getRiderProfile(user.profileId);
      if (response.success && response.data) {
        setProfile(response.data);
        logger.info(TAG, `Profile loaded for ${user.profileId}`);
      } else {
        const msg = response.error?.message ?? 'Failed to load profile';
        logger.warn(TAG, msg);
        setError(msg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      logger.error(TAG, 'Error loading profile', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.profileId]);

  const updateProfile = useCallback(async (data: UpdateRiderProfileRequest): Promise<void> => {
    if (!user?.profileId) {
      const msg = 'Cannot update profile — no profileId available';
      logger.warn(TAG, msg);
      setError(msg);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await updateRiderProfile(user.profileId, data);
      if (response.success && response.data) {
        setProfile(response.data);
        logger.info(TAG, `Profile updated for ${user.profileId}`);
      } else {
        const msg = response.error?.message ?? 'Failed to update profile';
        logger.warn(TAG, msg);
        setError(msg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      logger.error(TAG, 'Error updating profile', err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.profileId]);

  // Load profile when user authenticates (or profileId changes)
  useEffect(() => {
    if (user?.profileId) {
      loadProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [user?.profileId, loadProfile]);

  const value: RiderContextValue = {
    profile,
    isLoading,
    error,
    loadProfile,
    updateProfile,
    refreshProfile: loadProfile,
  };

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}
