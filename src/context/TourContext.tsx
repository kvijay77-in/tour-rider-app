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
import { getTours, getTourDetails, getTourRider } from '../services/api/tourApi';
import { logger } from '../utils/logger';
import type { Tour, TourRider } from '../types/tour';
import { TourRiderStatus, TourStatus } from '../types/tour';

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
  const [activeTour, setActiveTourState] = useState<Tour | null>(null);
  const [enrollment, setEnrollment] = useState<TourRider | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isEnrolled = enrollment !== null && ENROLLED_STATUSES.includes(enrollment.status);

  const loadActiveTour = useCallback(async (): Promise<void> => {
    if (!user) {
      logger.debug(TAG, 'No authenticated user — skipping tour load');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch active tours the rider may be enrolled in
      const toursResponse = await getTours({ status: TourStatus.ACTIVE });

      if (!toursResponse.success || !toursResponse.data?.items?.length) {
        logger.info(TAG, 'No active tours found');
        setActiveTourState(null);
        setEnrollment(null);
        return;
      }

      // Check each active tour for rider enrollment
      for (const tour of toursResponse.data.items) {
        try {
          const riderResponse = await getTourRider(tour.tourId, user.userId);
          if (riderResponse.success && riderResponse.data) {
            // Fetch full tour details
            const detailsResponse = await getTourDetails(tour.tourId);
            const fullTour = detailsResponse.success && detailsResponse.data
              ? detailsResponse.data
              : tour;

            setActiveTourState(fullTour);
            setEnrollment(riderResponse.data);
            logger.info(TAG, `Active tour found: ${tour.tourId} (status: ${riderResponse.data.status})`);
            return;
          }
        } catch {
          // Rider not enrolled in this tour — continue checking
          logger.debug(TAG, `Rider not enrolled in tour ${tour.tourId}`);
        }
      }

      // No enrollment found in any active tour
      logger.info(TAG, 'Rider not enrolled in any active tour');
      setActiveTourState(null);
      setEnrollment(null);
    } catch (err) {
      logger.error(TAG, 'Error loading active tour', err);
      setActiveTourState(null);
      setEnrollment(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
    if (user) {
      loadActiveTour();
    } else {
      setActiveTourState(null);
      setEnrollment(null);
    }
  }, [user, loadActiveTour]);

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
