/**
 * SQLite-backed cache for historical tours and rides.
 */

import * as SQLite from 'expo-sqlite';

import { logger } from '../utils/logger';
import { TourStatus, type Tour } from '../types/tour';
import type { Ride } from '../types/ride';

const TAG = 'TourHistoryStore';
const DATABASE_NAME = 'tour_history_cache.db';

type CachedTourRow = {
  tourId: string;
  status: string;
  name: string;
  startDate: string;
  endDate: string;
  payload: string;
  ridesSynced: number;
};

type CachedRideRow = {
  tourId: string;
  rideId: string;
  date: string;
  rideNo: number | null;
  name: string;
  payload: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let schemaPromise: Promise<void> | null = null;

function isHistoricalTour(tour: Tour): boolean {
  return tour.status !== TourStatus.ACTIVE;
}

function toTourPayload(tour: Tour): string {
  return JSON.stringify(tour);
}

function toRidePayload(ride: Ride): string {
  return JSON.stringify(ride);
}

function compareIsoDateStrings(a: string | undefined, b: string | undefined): number {
  const left = a ?? '';
  const right = b ?? '';
  return left.localeCompare(right);
}

function parseTourPayload(payload: string, fallbackTourId: string): Tour | null {
  try {
    return JSON.parse(payload) as Tour;
  } catch (error) {
    logger.warn(TAG, `Skipping invalid cached tour payload for ${fallbackTourId}`);
    logger.debug(TAG, 'Invalid cached tour payload details', error);
    return null;
  }
}

function parseRidePayload(payload: string, fallbackRideId: string): Ride | null {
  try {
    return JSON.parse(payload) as Ride;
  } catch (error) {
    logger.warn(TAG, `Skipping invalid cached ride payload for ${fallbackRideId}`);
    logger.debug(TAG, 'Invalid cached ride payload details', error);
    return null;
  }
}

function sortHistoricalToursByRecency(tours: Tour[]): Tour[] {
  return [...tours].sort((a, b) => {
    const byStartDate = compareIsoDateStrings(b.startDate, a.startDate);
    if (byStartDate !== 0) {
      return byStartDate;
    }

    const byEndDate = compareIsoDateStrings(b.endDate, a.endDate);
    if (byEndDate !== 0) {
      return byEndDate;
    }

    const byName = (a.name ?? '').localeCompare(b.name ?? '');
    if (byName !== 0) {
      return byName;
    }

    return (a.tourId ?? '').localeCompare(b.tourId ?? '');
  });
}

function sortRidesByDateAndSequence(rides: Ride[]): Ride[] {
  return [...rides].sort((a, b) => {
    const byDate = compareIsoDateStrings(a.date, b.date);
    if (byDate !== 0) {
      return byDate;
    }

    const rideNoA = a.rideNo ?? 0;
    const rideNoB = b.rideNo ?? 0;
    const byRideNo = rideNoA - rideNoB;
    if (byRideNo !== 0) {
      return byRideNo;
    }

    return (a.rideId ?? '').localeCompare(b.rideId ?? '');
  });
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  if (!schemaPromise) {
    schemaPromise = databasePromise.then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_tours (
          tourId TEXT PRIMARY KEY NOT NULL,
          status TEXT NOT NULL,
          name TEXT NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          payload TEXT NOT NULL,
          ridesSynced INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS cached_tour_rides (
          tourId TEXT NOT NULL,
          rideId TEXT NOT NULL,
          date TEXT NOT NULL,
          rideNo INTEGER,
          name TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (tourId, rideId)
        );

        CREATE INDEX IF NOT EXISTS idx_cached_tour_rides_lookup
          ON cached_tour_rides (tourId, date, rideNo, rideId);
      `);
    });
  }

  await schemaPromise;
  return databasePromise;
}

function mapTourRows(rows: CachedTourRow[]): Tour[] {
  return rows
    .map((row) => parseTourPayload(row.payload, row.tourId))
    .filter((tour): tour is Tour => tour !== null && isHistoricalTour(tour));
}

function mapRideRows(rows: CachedRideRow[]): Ride[] {
  return rows
    .map((row) => parseRidePayload(row.payload, row.rideId))
    .filter((ride): ride is Ride => ride !== null);
}

export function filterHistoricalTours(tours: Tour[]): Tour[] {
  return tours.filter(isHistoricalTour);
}

export function sortToursForDisplay(tours: Tour[]): Tour[] {
  const activeTours = tours.filter((tour) => tour.status === TourStatus.ACTIVE);
  const historicalTours = sortHistoricalToursByRecency(filterHistoricalTours(tours));

  return [...activeTours, ...historicalTours];
}

export function sortRidesForDisplay(rides: Ride[]): Ride[] {
  return sortRidesByDateAndSequence(rides);
}

export async function getCachedHistoricalTours(): Promise<Tour[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CachedTourRow>(
      'SELECT tourId, status, name, startDate, endDate, payload, ridesSynced FROM cached_tours WHERE status != ? ORDER BY startDate DESC, name ASC, tourId ASC',
      [TourStatus.ACTIVE],
    );

    return mapTourRows(rows);
  } catch (error) {
    logger.warn(TAG, 'Unable to read cached historical tours');
    logger.debug(TAG, 'Historical tour cache read failure', error);
    return [];
  }
}

export async function getHistoricalTourCacheRecord(
  tourId: string,
): Promise<{ tour: Tour; ridesSynced: boolean } | null> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CachedTourRow>(
      'SELECT tourId, status, name, startDate, endDate, payload, ridesSynced FROM cached_tours WHERE tourId = ? LIMIT 1',
      [tourId],
    );

    const [row] = rows;
    if (!row) {
      return null;
    }

    const tour = parseTourPayload(row.payload, row.tourId);
    if (!tour || !isHistoricalTour(tour)) {
      return null;
    }

    return {
      tour,
      ridesSynced: row.ridesSynced === 1,
    };
  } catch (error) {
    logger.warn(TAG, `Unable to read cached historical tour ${tourId}`);
    logger.debug(TAG, 'Historical tour cache lookup failure', error);
    return null;
  }
}

export async function getCachedHistoricalTourRides(tourId: string): Promise<Ride[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CachedRideRow>(
      'SELECT tourId, rideId, date, rideNo, name, payload FROM cached_tour_rides WHERE tourId = ? ORDER BY date ASC, rideNo ASC, rideId ASC',
      [tourId],
    );

    return sortRidesByDateAndSequence(mapRideRows(rows));
  } catch (error) {
    logger.warn(TAG, `Unable to read cached rides for tour ${tourId}`);
    logger.debug(TAG, 'Historical ride cache read failure', error);
    return [];
  }
}

export async function cacheHistoricalTourCatalog(tours: Tour[]): Promise<void> {
  const historicalTours = filterHistoricalTours(tours);
  if (!historicalTours.length) {
    return;
  }

  try {
    const db = await getDatabase();
    await db.execAsync('BEGIN');

    try {
      for (const tour of historicalTours) {
        await db.runAsync(
          'INSERT OR IGNORE INTO cached_tours (tourId, status, name, startDate, endDate, payload, ridesSynced) VALUES (?, ?, ?, ?, ?, ?, 0)',
          tour.tourId,
          tour.status,
          tour.name,
          tour.startDate,
          tour.endDate,
          toTourPayload(tour),
        );
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.warn(TAG, 'Failed to cache historical tour catalog');
    logger.debug(TAG, 'Historical tour catalog write failure', error);
  }
}

export async function cacheHistoricalTourRides(tour: Tour, rides: Ride[]): Promise<void> {
  if (!isHistoricalTour(tour)) {
    return;
  }

  try {
    const db = await getDatabase();
    await db.execAsync('BEGIN');

    try {
      await db.runAsync(
        'INSERT OR IGNORE INTO cached_tours (tourId, status, name, startDate, endDate, payload, ridesSynced) VALUES (?, ?, ?, ?, ?, ?, 0)',
        tour.tourId,
        tour.status,
        tour.name,
        tour.startDate,
        tour.endDate,
        toTourPayload(tour),
      );

      await db.runAsync('DELETE FROM cached_tour_rides WHERE tourId = ?', tour.tourId);

      for (const ride of rides) {
        await db.runAsync(
          'INSERT OR REPLACE INTO cached_tour_rides (tourId, rideId, date, rideNo, name, payload) VALUES (?, ?, ?, ?, ?, ?)',
          tour.tourId,
          ride.rideId,
          ride.date,
          ride.rideNo ?? null,
          ride.name,
          toRidePayload(ride),
        );
      }

      await db.runAsync('UPDATE cached_tours SET ridesSynced = 1 WHERE tourId = ?', tour.tourId);

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.warn(TAG, `Failed to cache rides for historical tour ${tour.tourId}`);
    logger.debug(TAG, 'Historical ride catalog write failure', error);
  }
}
