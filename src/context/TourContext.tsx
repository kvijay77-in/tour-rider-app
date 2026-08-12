/**
 * Tour Context — manages the rider's active tour enrollment.
 *
 * Depends on AuthContext — loads the rider's active tour once authenticated.
 * Determines whether the rider is enrolled (registered/active) in a tour
 * and provides the tour + enrollment data to the app.
 *
 * See docs/SolutionDesign.md § Tour Enrollment.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';
import { useRider } from './RiderContext';
import { getTourRides } from '../services/api/rideApi';
import { getActiveTour, getTourRiderByProfile } from '../services/api/tourApi';
import {
  cacheActiveTourSnapshot,
  clearActiveTourCache,
  getCachedActiveTourSnapshot,
  resolveTodaysRide,
} from '../services/activeTourStore';
import { logger } from '../utils/logger';
import { ApiError } from '../services/api/apiClient';
import type { Ride } from '../types/ride';
import type { Tour, TourRider } from '../types/tour';
import { TourRiderStatus } from '../types/tour';

const TAG = 'TourContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TourContextValue {
  /** The rider's active tour, or null if not enrolled */
  activeTour: Tour | null;
  /** The rider's enrollment record for the active tour */
  enrollment: TourRider | null;
  /** Locally cached rides for the active tour */
  activeRides: Ride[];
  /** Today's ride derived from the locally cached active rides */
  activeTodaysRide: Ride | null;
  /** Timestamp when the active snapshot was last refreshed */
  activeSnapshotRefreshedAt: string | null;
  /** True if the rider is enrolled (REGISTERED or ACTIVE) in a tour */
  isEnrolled: boolean;
  /** True while loading tour/enrollment data */
  isLoading: boolean;
  /** Load the rider's active tour from the API */
  loadActiveTour: () => Promise<void>;
  /** Manually set the active tour and enrollment (e.g. after registration) */
  setActiveTour: (tour: Tour | null, enrollment: TourRider | null) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TourContext = createContext<TourContextValue>({
  activeTour: null,
  enrollment: null,
  activeRides: [],
  activeTodaysRide: null,
  activeSnapshotRefreshedAt: null,
  isEnrolled: false,
  isLoading: false,
  loadActiveTour: async () => {},
  setActiveTour: () => {},
});

export function useTour(): TourContextValue {
  return useContext(TourContext);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enrolled statuses that grant access to tour features */
const ENROLLED_STATUSES: TourRiderStatus[] = [
  TourRiderStatus.REGISTERED,
  TourRiderStatus.ACTIVE,
];

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const { user } = useAuth();
  const { hasProfile, isLoading: isLoadingProfile } = useRider();
  const [activeTour, setActiveTourState] = useState<Tour | null>(null);
  const [enrollment, setEnrollment] = useState<TourRider | null>(null);
  const [activeRides, setActiveRides] = useState<Ride[]>([]);
  const [activeSnapshotRefreshedAt, setActiveSnapshotRefreshedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isEnrolled = enrollment !== null && ENROLLED_STATUSES.includes(enrollment.status);
  const activeTodaysRide = resolveTodaysRide(activeRides);

  const clearActiveState = useCallback(async (): Promise<void> => {
    setActiveTourState(null);
    setEnrollment(null);
    setActiveRides([]);
    setActiveSnapshotRefreshedAt(null);
    await clearActiveTourCache();
  }, []);

  const hydrateCachedActiveState = useCallback(async (): Promise<void> => {
    const cachedSnapshot = await getCachedActiveTourSnapshot();
    if (!cachedSnapshot) {
      setActiveTourState(null);
      setEnrollment(null);
      setActiveRides([]);
      setActiveSnapshotRefreshedAt(null);
      return;
    }

    setActiveTourState(cachedSnapshot.tour);
    setEnrollment(cachedSnapshot.enrollment);
    setActiveRides(cachedSnapshot.rides);
    setActiveSnapshotRefreshedAt(cachedSnapshot.refreshedAt);
  }, []);

  const loadActiveTour = useCallback(async (): Promise<void> => {
    if (!user?.profileId) {
      logger.debug(TAG, 'No authenticated user or profileId — skipping tour load');
      await clearActiveState();
      return;
    }

    if (!hasProfile) {
      logger.info(TAG, 'Rider profile not created yet — skipping active tour load');
      await clearActiveState();
      return;
    }

    setIsLoading(true);
    try {
      // Fetch the currently active tour for organizer context.
      const activeTourResponse = await getActiveTour();

      if (!activeTourResponse.success || !activeTourResponse.data) {
        logger.info(TAG, 'No active tours found');
        await clearActiveState();
        return;
      }

      const tour = activeTourResponse.data;
      let tourEnrollment: TourRider | null = null;

      try {
        const riderResponse = await getTourRiderByProfile(tour.tourId, user.profileId);
        logger.debug(TAG, `Response status for rider enrollment in tour ${tour.tourId}: ${riderResponse.success ? 'success' : 'failure'}`);
        if (riderResponse.success && riderResponse.data) {
          tourEnrollment = riderResponse.data;
        }
      } catch {
        logger.debug(TAG, `Rider enrollment unavailable for tour ${tour.tourId}`);
      }

      let rides: Ride[] = [];

      try {
        const ridesResponse = await getTourRides(tour.tourId);
        if (ridesResponse.success) {
          rides = ridesResponse.data?.items ?? [];
        } else {
          logger.warn(TAG, ridesResponse.error?.message ?? `Unable to load rides for active tour ${tour.tourId}`);
        }
      } catch {
        logger.warn(TAG, `Unable to load rides for active tour ${tour.tourId}`);
      }

      const snapshot = {
        tour,
        enrollment: tourEnrollment,
        rides,
        refreshedAt: new Date().toISOString(),
      };

      await cacheActiveTourSnapshot(snapshot);
      await hydrateCachedActiveState();
      if (tourEnrollment) {
        logger.info(TAG, `Active tour found: ${tour.tourId} (status: ${tourEnrollment.status})`);
      } else {
        logger.info(TAG, `Active tour found: ${tour.tourId} (rider not enrolled)`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        logger.info(TAG, 'No active tour data found for current rider profile');
        await clearActiveState();
        return;
      }

      logger.error(TAG, 'Error loading active tour', err);
      await clearActiveState();
    } finally {
      setIsLoading(false);
    }
  }, [clearActiveState, hasProfile, hydrateCachedActiveState, user?.profileId]);

  const setActiveTour = useCallback((tour: Tour | null, tourEnrollment: TourRider | null): void => {
    setActiveTourState(tour);
    setEnrollment(tourEnrollment);
    setActiveRides([]);
    setActiveSnapshotRefreshedAt(null);
    if (tour) {
      logger.info(TAG, `Active tour set to ${tour.tourId}`);
    } else {
      logger.info(TAG, 'Active tour cleared');
    }
  }, []);

  // Load active tour when user authenticates
  useEffect(() => {
    if (isLoadingProfile) {
      return;
    }

    if (user?.profileId && hasProfile) {
      loadActiveTour();
    } else {
      void clearActiveState();
    }
  }, [clearActiveState, hasProfile, isLoadingProfile, user?.profileId, loadActiveTour]);

  const value: TourContextValue = {
    activeTour,
    enrollment,
    activeRides,
    activeTodaysRide,
    activeSnapshotRefreshedAt,
    isEnrolled,
    isLoading,
    loadActiveTour,
    setActiveTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
