/**
 * SQLite-backed cache for the signed-in rider's active tour snapshot.
 */

import * as SQLite from 'expo-sqlite';

import { logger } from '../utils/logger';
import type { Ride } from '../types/ride';
import type { Tour, TourRider } from '../types/tour';
import { sortRidesForDisplay } from './tourHistoryStore';

const TAG = 'ActiveTourStore';
const DATABASE_NAME = 'active_tour_cache.db';

type CachedActiveTourRow = {
  payload: string;
  enrollmentPayload: string;
  refreshedAt: string;
};

type CachedActiveRideRow = {
  rideId: string;
  payload: string;
};

export interface ActiveTourSnapshot {
  tour: Tour;
  enrollment: TourRider | null;
  rides: Ride[];
  refreshedAt: string;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let schemaPromise: Promise<void> | null = null;

function toPayload(value: Ride | Tour | TourRider | null): string {
  return JSON.stringify(value);
}

function parseJson<T>(payload: string, label: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    logger.warn(TAG, `Skipping invalid cached payload for ${label}`);
    logger.debug(TAG, 'Invalid active tour cache payload details', error);
    return null;
  }
}

function toUtcDateKey(referenceDate: Date): string {
  return referenceDate.toISOString().split('T')[0] ?? '';
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  if (!schemaPromise) {
    schemaPromise = databasePromise.then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_active_tour (
          singletonId INTEGER PRIMARY KEY NOT NULL CHECK (singletonId = 1),
          payload TEXT NOT NULL,
          enrollmentPayload TEXT NOT NULL,
          refreshedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cached_active_tour_rides (
          rideId TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL,
          rideNo INTEGER,
          name TEXT NOT NULL,
          payload TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cached_active_tour_rides_lookup
          ON cached_active_tour_rides (date, rideNo, rideId);
      `);
    });
  }

  await schemaPromise;
  return databasePromise;
}

export function resolveRideForDate(rides: Ride[], dateKey: string): Ride | null {
  return rides.find((ride) => ride.date === dateKey) ?? null;
}

export function resolveTodaysRide(rides: Ride[], referenceDate: Date = new Date()): Ride | null {
  return resolveRideForDate(rides, toUtcDateKey(referenceDate));
}

export async function clearActiveTourCache(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execAsync('BEGIN');

    try {
      await db.execAsync('DELETE FROM cached_active_tour;');
      await db.execAsync('DELETE FROM cached_active_tour_rides;');
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.warn(TAG, 'Failed to clear active tour cache');
    logger.debug(TAG, 'Active tour cache clear failure', error);
  }
}

export async function cacheActiveTourSnapshot(snapshot: ActiveTourSnapshot): Promise<void> {
  try {
    const db = await getDatabase();
    const rides = sortRidesForDisplay(snapshot.rides);

    await db.execAsync('BEGIN');

    try {
      await db.execAsync('DELETE FROM cached_active_tour;');
      await db.execAsync('DELETE FROM cached_active_tour_rides;');

      await db.runAsync(
        'INSERT INTO cached_active_tour (singletonId, payload, enrollmentPayload, refreshedAt) VALUES (1, ?, ?, ?)',
        toPayload(snapshot.tour),
        toPayload(snapshot.enrollment),
        snapshot.refreshedAt,
      );

      for (const ride of rides) {
        await db.runAsync(
          'INSERT INTO cached_active_tour_rides (rideId, date, rideNo, name, payload) VALUES (?, ?, ?, ?, ?)',
          ride.rideId,
          ride.date,
          ride.rideNo ?? null,
          ride.name,
          toPayload(ride),
        );
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.warn(TAG, 'Failed to cache active tour snapshot');
    logger.debug(TAG, 'Active tour cache write failure', error);
  }
}

export async function getCachedActiveTourSnapshot(): Promise<ActiveTourSnapshot | null> {
  try {
    const db = await getDatabase();
    const tourRows = await db.getAllAsync<CachedActiveTourRow>(
      'SELECT payload, enrollmentPayload, refreshedAt FROM cached_active_tour WHERE singletonId = 1 LIMIT 1',
    );

    const [tourRow] = tourRows;
    if (!tourRow) {
      return null;
    }

    const rideRows = await db.getAllAsync<CachedActiveRideRow>(
      'SELECT rideId, payload FROM cached_active_tour_rides ORDER BY date ASC, rideNo ASC, rideId ASC',
    );

    const tour = parseJson<Tour>(tourRow.payload, 'active tour');
    let enrollment: TourRider | null = null;

    try {
      enrollment = JSON.parse(tourRow.enrollmentPayload) as TourRider | null;
    } catch (error) {
      logger.warn(TAG, 'Skipping invalid cached payload for active tour enrollment');
      logger.debug(TAG, 'Invalid active tour enrollment payload details', error);
      enrollment = null;
    }

    const rides = rideRows
      .map((row) => parseJson<Ride>(row.payload, row.rideId))
      .filter((ride): ride is Ride => ride !== null);

    if (!tour) {
      return null;
    }

    return {
      tour,
      enrollment,
      rides: sortRidesForDisplay(rides),
      refreshedAt: tourRow.refreshedAt,
    };
  } catch (error) {
    logger.warn(TAG, 'Unable to read cached active tour snapshot');
    logger.debug(TAG, 'Active tour cache read failure', error);
    return null;
  }
}

export async function getCachedActiveTourRides(): Promise<Ride[]> {
  const snapshot = await getCachedActiveTourSnapshot();
  return snapshot?.rides ?? [];
}

export async function getCachedTodaysRide(referenceDate?: Date): Promise<Ride | null> {
  const rides = await getCachedActiveTourRides();
  return resolveTodaysRide(rides, referenceDate);
}