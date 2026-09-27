/**
 * Rider Context — manages the authenticated rider's profile.
 *
 * Depends on AuthContext — loads the rider profile once the user is
 * authenticated and provides CRUD operations for profile management.
 *
 * See docs/SolutionDesign.md § Rider Profile.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';
import { ApiError } from '../services/api/apiClient';
import {
  getProfilePictureDownloadUrl,
  getRiderProfile,
  updateRiderProfile,
  requestProfilePictureUploadUrl,
} from '../services/api/riderApi';
import { loadProfileDefinitionsWithFallback } from '../services/profileDefinitionsService';
import { logger } from '../utils/logger';
import type { RiderProfile, UpdateRiderProfileRequest } from '../types/rider';
import type { ProfileDefinitions } from '../profile-schema';
import { createProfileDraftValues, hasRequiredSystemProfileValues } from '../profile-schema';

const TAG = 'RiderContext';

interface RiderContextValue {
  profile: RiderProfile | null;
  hasProfile: boolean;
  hasCompleteProfileForAccess: boolean;
  profileDefinitions: ProfileDefinitions | null;
  isLoading: boolean;
  isLoadingDefinitions: boolean;
  error: string | null;
  definitionsError: string | null;
  loadProfile: () => Promise<void>;
  updateProfile: (data: UpdateRiderProfileRequest) => Promise<void>;
  uploadProfilePicture: (
    localUri: string | null,
    mimeType?: string,
    profileId?: string,
    base64Data?: string,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshProfileDefinitions: () => Promise<void>;
}

const RiderContext = createContext<RiderContextValue>({
  profile: null,
  hasProfile: false,
  hasCompleteProfileForAccess: false,
  profileDefinitions: null,
  isLoading: false,
  isLoadingDefinitions: false,
  error: null,
  definitionsError: null,
  loadProfile: async () => {},
  updateProfile: async () => {},
  uploadProfilePicture: async () => {},
  refreshProfile: async () => {},
  refreshProfileDefinitions: async () => {},
});

export function useRider(): RiderContextValue {
  return useContext(RiderContext);
}

function base64ToUint8Array(base64Data: string): Uint8Array {
  const atobFn = globalThis.atob;

  if (typeof atobFn !== 'function') {
    throw new Error('Image decoding is not available in this runtime.');
  }

  const binaryString = atobFn(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

async function resolveProfilePicture(profile: RiderProfile): Promise<RiderProfile> {
  if (!profile.photoS3Key) {
    return profile;
  }

  try {
    const response = await getProfilePictureDownloadUrl(profile.profileId);
    if (response.success && response.data?.downloadUrl) {
      return { ...profile, photoUrl: response.data.downloadUrl, photoAccessDenied: false };
    }

    if (response.error?.message.includes('Access denied')) {
      return { ...profile, photoAccessDenied: true };
    }

    logger.warn(TAG, response.error?.message ?? 'Failed to load profile picture');
  } catch (err) {
    logger.warn(TAG, 'Error loading profile picture', err);
  }

  return profile;
}

interface RiderProviderProps {
  children: React.ReactNode;
}

export function RiderProvider({ children }: RiderProviderProps) {
  const { user } = useAuth();
  const definitionsSessionKey = user?.userId ?? user?.profileId ?? user?.email ?? null;
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [profileDefinitions, setProfileDefinitions] = useState<ProfileDefinitions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDefinitions, setIsLoadingDefinitions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definitionsError, setDefinitionsError] = useState<string | null>(null);
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
        setProfile(await resolveProfilePicture(response.data));
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

  const refreshProfileDefinitions = useCallback(async (): Promise<void> => {
    if (!definitionsSessionKey) {
      setProfileDefinitions(null);
      setDefinitionsError(null);
      return;
    }

    setIsLoadingDefinitions(true);
    setDefinitionsError(null);
    try {
      const loadedDefinitions = await loadProfileDefinitionsWithFallback();
      setProfileDefinitions(loadedDefinitions.definitions);
      logger.info(TAG, `Profile definitions loaded from ${loadedDefinitions.source}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile definitions';
      setProfileDefinitions(null);
      setDefinitionsError(message);
      logger.error(TAG, 'Error loading profile definitions', err);
    } finally {
      setIsLoadingDefinitions(false);
    }
  }, [definitionsSessionKey]);

  const updateProfileData = useCallback(async (data: UpdateRiderProfileRequest): Promise<void> => {
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
        setProfile(await resolveProfilePicture(response.data));
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
    localUri?: string | null,
    mimeType?: string,
    profileId?: string,
    base64Data?: string,
  ): Promise<void> => {
    if (!localUri || !base64Data) {
      const msg = 'Cannot upload profile picture — image data is missing';
      logger.error(TAG, msg);
      setError(msg);
      throw new Error(msg);
    }

    const targetProfileId = profileId ?? user?.profileId;
    if (!targetProfileId) {
      const msg = 'Cannot upload profile picture — no profileId available';
      logger.error(TAG, msg);
      setError(msg);
      throw new Error(msg);
    }

    if (!profileDefinitions?.definitionsVersion) {
      const msg = 'Cannot upload profile picture — profile definitions are unavailable';
      logger.error(TAG, msg);
      setError(msg);
      throw new Error(msg);
    }

    setIsLoading(true);
    setError(null);

    try {
      const uploadUrlResponse = await requestProfilePictureUploadUrl(targetProfileId, mimeType);
      const uploadData = uploadUrlResponse.data;

      if (!uploadUrlResponse.success || !uploadData) {
        const msg = uploadUrlResponse.error?.message ?? 'Failed to request upload URL';
        logger.warn(TAG, msg);
        throw new Error(msg);
      }

      const uploadBytes = base64ToUint8Array(base64Data);
      const uploadBuffer = uploadBytes.buffer.slice(
        uploadBytes.byteOffset,
        uploadBytes.byteOffset + uploadBytes.byteLength,
      ) as ArrayBuffer;

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType ?? uploadData.contentType,
        },
        body: uploadBuffer,
      });

      if (!putResponse.ok) {
        const msg = `Profile picture upload failed with status ${putResponse.status}`;
        logger.warn(TAG, msg);
        throw new Error(msg);
      }

      const profileUpdateResponse = await updateRiderProfile(targetProfileId, {
        photoS3Key: uploadData.photoS3Key,
        definitionsVersion: profileDefinitions.definitionsVersion,
      });

      if (profileUpdateResponse.success && profileUpdateResponse.data) {
        setProfile(await resolveProfilePicture(profileUpdateResponse.data));
        logger.info(TAG, `Profile picture uploaded for ${targetProfileId}`);
      } else {
        const msg = profileUpdateResponse.error?.message ?? 'Failed to save profile picture';
        logger.warn(TAG, msg);
        throw new Error(msg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload profile picture';
      logger.warn(TAG, 'Profile picture upload skipped due to error', err);
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [profileDefinitions?.definitionsVersion, user?.profileId]);

  useEffect(() => {
    if (user?.profileId) {
      void loadProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [user?.profileId, loadProfile]);

  useEffect(() => {
    if (definitionsSessionKey) {
      void refreshProfileDefinitions();
    } else {
      setProfileDefinitions(null);
      setDefinitionsError(null);
    }
  }, [definitionsSessionKey, refreshProfileDefinitions]);

  const hasCompleteProfileForAccess = useMemo(() => {
    if (!profile || !profileDefinitions) {
      return false;
    }

    const draftValues = createProfileDraftValues(profile, profileDefinitions, user);
    return hasRequiredSystemProfileValues(profileDefinitions, draftValues);
  }, [profile, profileDefinitions, user]);

  const value: RiderContextValue = {
    profile,
    hasProfile,
    hasCompleteProfileForAccess,
    profileDefinitions,
    isLoading,
    isLoadingDefinitions,
    error,
    definitionsError,
    loadProfile,
    updateProfile: updateProfileData,
    uploadProfilePicture,
    refreshProfile: loadProfile,
    refreshProfileDefinitions,
  };

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}
