/**
 * Ride data store — SQLite operations for ride caching.
 */

import { getDatabase } from './database';
import { Ride, Stage } from '../../types/models';

/**
 * Upsert a ride into the local cache (from API response).
 * Stages are serialised as JSON since they are nested arrays.
 */
export async function upsertRide(ride: Ride): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO rides
      (rideId, date, rideNo, name, startLocation, finishLocation, totalDistance,
       flagOffTime, status, stagesJson, description, startedAt, completedAt, closedAt, lastSyncedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ride.rideId,
      ride.date,
      ride.rideNo ?? null,
      ride.name,
      ride.startLocation,
      ride.finishLocation,
      ride.totalDistance,
      ride.flagOffTime ?? null,
      ride.status,
      JSON.stringify(ride.stages),
      ride.description ?? null,
      ride.startedAt ?? null,
      ride.completedAt ?? null,
      ride.closedAt ?? null,
      now,
    ],
  );
}

/**
 * Get a ride by ID from the local cache.
 */
export async function getRideById(rideId: string): Promise<Ride | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM rides WHERE rideId = ?',
    [rideId],
  );
  return row ? mapRowToRide(row) : null;
}

/**
 * Get rides by date.
 */
export async function getRidesByDate(date: string): Promise<Ride[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM rides WHERE date = ? ORDER BY rideNo',
    [date],
  );
  return rows.map(mapRowToRide);
}

/**
 * Get the active ride from cache.
 */
export async function getActiveRide(): Promise<Ride | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM rides WHERE status = 'ACTIVE' ORDER BY date DESC LIMIT 1",
  );
  return row ? mapRowToRide(row) : null;
}

/**
 * Get all cached rides.
 */
export async function getAllRides(): Promise<Ride[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM rides ORDER BY date DESC, rideNo',
  );
  return rows.map(mapRowToRide);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRowToRide(row: Record<string, unknown>): Ride {
  let stages: Stage[] = [];
  try {
    stages = JSON.parse(row.stagesJson as string) as Stage[];
  } catch (e) {
    console.warn('[RideStore] Failed to parse stages JSON:', e);
    stages = [];
  }

  return {
    rideId: row.rideId as string,
    date: row.date as string,
    rideNo: row.rideNo as number | undefined,
    name: row.name as string,
    startLocation: row.startLocation as string,
    finishLocation: row.finishLocation as string,
    totalDistance: row.totalDistance as number,
    flagOffTime: row.flagOffTime as string | undefined,
    status: row.status as Ride['status'],
    stages,
    description: row.description as string | undefined,
    startedAt: row.startedAt as string | undefined,
    completedAt: row.completedAt as string | undefined,
    closedAt: row.closedAt as string | undefined,
  };
}
