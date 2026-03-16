/**
 * Check-in data store — SQLite operations for check-in caching
 * and offline check-in capture.
 * 
 * Per design (§4.3): All check-ins write to SQLite first.
 * The pending_operations queue handles async push to backend.
 */

import { getDatabase } from './database';
import { CheckIn, CheckInMethod } from '../../types/models';

// ---------------------------------------------------------------------------
// Read operations (Dashboard reads from here)
// ---------------------------------------------------------------------------

/**
 * Get all check-ins for a ride (from local cache).
 */
export async function getCheckInsByRide(rideId: string): Promise<CheckIn[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM check_ins WHERE rideId = ? ORDER BY timestamp',
    [rideId],
  );
  return rows.map(mapRowToCheckIn);
}

/**
 * Get check-ins for a specific rider in a ride.
 */
export async function getCheckInsByRider(
  riderId: string,
  rideId: string,
): Promise<CheckIn[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM check_ins WHERE riderId = ? AND rideId = ? ORDER BY stageNumber',
    [riderId, rideId],
  );
  return rows.map(mapRowToCheckIn);
}

/**
 * Check if a check-in already exists for a rider at a specific stage.
 * Used for duplicate detection before queuing.
 */
export async function checkInExists(
  riderId: string,
  rideId: string,
  stageNumber: number,
): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT 1 FROM check_ins WHERE riderId = ? AND rideId = ? AND stageNumber = ?',
    [riderId, rideId, stageNumber],
  );
  return row !== null;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Insert a locally captured check-in into SQLite.
 * Called for both online and offline check-ins (unified path per §4.3).
 */
export async function insertLocalCheckIn(checkIn: CheckIn): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO check_ins
      (checkInId, riderId, rideId, stageNumber, stageId, timestamp, checkedInBy,
       method, isNotRiding, isQuitRiding, isManualEntry, notes, locationLat, locationLng,
       isLocal, syncStatus, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?)`,
    [
      checkIn.checkInId,
      checkIn.riderId,
      checkIn.rideId,
      checkIn.stageNumber,
      checkIn.stageId,
      checkIn.timestamp,
      checkIn.checkedInBy,
      checkIn.method,
      checkIn.isNotRiding ? 1 : 0,
      checkIn.isQuitRiding ? 1 : 0,
      checkIn.isManualEntry ? 1 : 0,
      checkIn.notes ?? null,
      checkIn.location?.latitude ?? null,
      checkIn.location?.longitude ?? null,
      new Date().toISOString(),
    ],
  );
}

/**
 * Upsert check-ins from API response into local cache.
 * Does NOT overwrite locally-pending check-ins (isLocal = 1).
 */
export async function upsertCheckInsFromApi(checkIns: CheckIn[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const ci of checkIns) {
    // Only upsert if not a local pending record
    await db.runAsync(
      `INSERT INTO check_ins
        (checkInId, riderId, rideId, stageNumber, stageId, timestamp, checkedInBy,
         method, isNotRiding, isQuitRiding, isManualEntry, notes,
         isLocal, syncStatus, lastSyncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'SYNCED', ?)
       ON CONFLICT(checkInId) DO UPDATE SET
         isNotRiding = excluded.isNotRiding,
         isQuitRiding = excluded.isQuitRiding,
         notes = excluded.notes,
         lastSyncedAt = excluded.lastSyncedAt
       WHERE isLocal = 0`,
      [
        ci.checkInId,
        ci.riderId,
        ci.rideId,
        ci.stageNumber,
        ci.stageId,
        ci.timestamp,
        ci.checkedInBy,
        ci.method,
        ci.isNotRiding ? 1 : 0,
        ci.isQuitRiding ? 1 : 0,
        ci.isManualEntry ? 1 : 0,
        ci.notes ?? null,
        now,
      ],
    );
  }
}

/**
 * Mark a local check-in as successfully synced.
 */
export async function markCheckInSynced(checkInId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE check_ins SET isLocal = 0, syncStatus = 'SYNCED', lastSyncedAt = ? WHERE checkInId = ?`,
    [new Date().toISOString(), checkInId],
  );
}

/**
 * Mark a local check-in as failed to sync.
 */
export async function markCheckInFailed(
  checkInId: string,
  error: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE check_ins SET syncStatus = 'FAILED', syncError = ? WHERE checkInId = ?`,
    [error, checkInId],
  );
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRowToCheckIn(row: Record<string, unknown>): CheckIn {
  const checkIn: CheckIn = {
    checkInId: row.checkInId as string,
    riderId: row.riderId as string,
    rideId: row.rideId as string,
    stageNumber: row.stageNumber as number,
    stageId: row.stageId as string,
    timestamp: row.timestamp as string,
    checkedInBy: row.checkedInBy as string,
    method: row.method as CheckInMethod,
    isNotRiding: (row.isNotRiding as number) === 1,
    isQuitRiding: (row.isQuitRiding as number) === 1,
    isManualEntry: (row.isManualEntry as number) === 1,
    notes: row.notes as string | undefined,
    createdAt: row.createdAt as string | undefined,
  };

  if (row.locationLat != null && row.locationLng != null) {
    checkIn.location = {
      latitude: row.locationLat as number,
      longitude: row.locationLng as number,
    };
  }

  return checkIn;
}
