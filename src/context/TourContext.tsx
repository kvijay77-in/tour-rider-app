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
import { getActiveTour, getTourRiderByProfile } from '../services/api/tourApi';
import { logger } from '../utils/logger';
import { ApiError } from '../services/api/apiClient';
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
  const [isLoading, setIsLoading] = useState(false);

  const isEnrolled = enrollment !== null && ENROLLED_STATUSES.includes(enrollment.status);

  const loadActiveTour = useCallback(async (): Promise<void> => {
    if (!user?.profileId) {
      logger.debug(TAG, 'No authenticated user or profileId — skipping tour load');
      setActiveTourState(null);
      setEnrollment(null);
      return;
    }

    if (!hasProfile) {
      logger.info(TAG, 'Rider profile not created yet — skipping active tour load');
      setActiveTourState(null);
      setEnrollment(null);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch the currently active tour for organizer context.
      const activeTourResponse = await getActiveTour();

      if (!activeTourResponse.success || !activeTourResponse.data) {
        logger.info(TAG, 'No active tours found');
        setActiveTourState(null);
        setEnrollment(null);
        return;
      }

      const tour = activeTourResponse.data;

      try {
        const riderResponse = await getTourRiderByProfile(tour.tourId, user.profileId);
        if (riderResponse.success && riderResponse.data) {
          setActiveTourState(tour);
          setEnrollment(riderResponse.data);
          logger.info(TAG, `Active tour found: ${tour.tourId} (status: ${riderResponse.data.status})`);
          return;
        }
      } catch {
        logger.debug(TAG, `Rider not enrolled in tour ${tour.tourId}`);
      }

      logger.info(TAG, 'Rider not enrolled in active tour');
      setActiveTourState(null);
      setEnrollment(null);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        logger.info(TAG, 'No active tour data found for current rider profile');
        setActiveTourState(null);
        setEnrollment(null);
        return;
      }

      logger.error(TAG, 'Error loading active tour', err);
      setActiveTourState(null);
      setEnrollment(null);
    } finally {
      setIsLoading(false);
    }
  }, [hasProfile, user?.profileId]);

  const setActiveTour = useCallback((tour: Tour | null, tourEnrollment: TourRider | null): void => {
    setActiveTourState(tour);
    setEnrollment(tourEnrollment);
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
      setActiveTourState(null);
      setEnrollment(null);
    }
  }, [hasProfile, isLoadingProfile, user?.profileId, loadActiveTour]);

  const value: TourContextValue = {
    activeTour,
    enrollment,
    isEnrolled,
    isLoading,
    loadActiveTour,
    setActiveTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
