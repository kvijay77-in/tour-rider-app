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
import { ApiError } from '../services/api/apiClient';
import {
  getRiderProfile,
  updateRiderProfile,
  requestProfilePictureUploadUrl,
} from '../services/api/riderApi';
import { logger } from '../utils/logger';
import type { RiderProfile, UpdateRiderProfileRequest } from '../types/rider';

const TAG = 'RiderContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiderContextValue {
  /** The rider's profile, or null if not yet loaded */
  profile: RiderProfile | null;
  /** True when a complete rider profile exists */
  hasProfile: boolean;
  /** True while loading the profile */
  isLoading: boolean;
  /** Error message from the last profile operation */
  error: string | null;
  /** Load (or reload) the rider profile from the API */
  loadProfile: () => Promise<void>;
  /** Update the rider profile with the given data */
  updateProfile: (data: UpdateRiderProfileRequest) => Promise<void>;
  /** Upload and attach a profile picture to the rider profile */
  uploadProfilePicture: (localUri: string, mimeType?: string) => Promise<void>;
  /** Alias for loadProfile — refreshes profile from the API */
  refreshProfile: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RiderContext = createContext<RiderContextValue>({
  profile: null,
  hasProfile: false,
  isLoading: false,
  error: null,
  loadProfile: async () => {},
  updateProfile: async () => {},
  uploadProfilePicture: async () => {},
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
  const hasProfile = profile !== null;

  const loadProfile = useCallback(async (): Promise<void> => {
    if (!user?.profileId) {
      logger.debug(TAG, 'No profileId available — skipping profile load');
      setProfile(null);
      setError(null);
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
        setProfile(null);
        setError(msg);
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        logger.info(TAG, `Profile not found for ${user.profileId}`);
        setProfile(null);
        setError(null);
        return;
      }

      const message = err instanceof Error ? err.message : 'Failed to load profile';
      logger.error(TAG, 'Error loading profile', err);
      setProfile(null);
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

  const uploadProfilePicture = useCallback(async (
    localUri: string,
    mimeType?: string,
  ): Promise<void> => {
    if (!user?.profileId) {
      const msg = 'Cannot upload profile picture — no profileId available';
      logger.warn(TAG, msg);
      setError(msg);
      throw new Error(msg);
    }

    setIsLoading(true);
    setError(null);

    try {
      const uploadUrlResponse = await requestProfilePictureUploadUrl(user.profileId, mimeType);
      const uploadData = uploadUrlResponse.data;

      if (!uploadUrlResponse.success || !uploadData) {
        const msg = uploadUrlResponse.error?.message ?? 'Failed to request upload URL';
        logger.warn(TAG, msg);
        setError(msg);
        throw new Error(msg);
      }

      const localFileResponse = await fetch(localUri);
      const blob = await localFileResponse.blob();

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType ?? uploadData.contentType,
        },
        body: blob,
      });

      if (!putResponse.ok) {
        throw new Error(`Profile picture upload failed with status ${putResponse.status}`);
      }

      const profileUpdateResponse = await updateRiderProfile(user.profileId, {
        photoS3Key: uploadData.photoS3Key,
      });

      if (profileUpdateResponse.success && profileUpdateResponse.data) {
        setProfile(profileUpdateResponse.data);
        logger.info(TAG, `Profile picture uploaded for ${user.profileId}`);
      } else {
        const msg = profileUpdateResponse.error?.message ?? 'Failed to save profile picture';
        logger.warn(TAG, msg);
        setError(msg);
        throw new Error(msg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload profile picture';
      logger.error(TAG, 'Error uploading profile picture', err);
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
    hasProfile,
    isLoading,
    error,
    loadProfile,
    updateProfile,
    uploadProfilePicture,
    refreshProfile: loadProfile,
  };

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}
