/**
 * Rider data store — SQLite operations for rider caching.
 * Riders are read-only from the app's perspective (synced from API).
 */

import { getDatabase } from './database';
import { Rider } from '../../types/models';

/**
 * Upsert riders into the local cache (from API response).
 */
export async function upsertRiders(riders: Rider[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const rider of riders) {
    await db.runAsync(
      `INSERT OR REPLACE INTO riders
        (riderId, profileId, name, email, phone, emergencyContactName, emergencyContactPhone, photoS3Key, qrCodeData, status, lastSyncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rider.riderId,
        rider.profileId ?? null,
        rider.name,
        rider.email ?? null,
        rider.phone ?? null,
        rider.emergencyContactName ?? null,
        rider.emergencyContactPhone ?? null,
        rider.photoS3Key ?? null,
        rider.qrCodeData ?? null,
        rider.status ?? null,
        now,
      ],
    );
  }
}

/**
 * Get all cached riders.
 */
export async function getAllRiders(): Promise<Rider[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM riders ORDER BY riderId',
  );
  return rows.map(mapRowToRider);
}

/**
 * Get a single rider by ID.
 */
export async function getRiderById(riderId: string): Promise<Rider | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM riders WHERE riderId = ?',
    [riderId],
  );
  return row ? mapRowToRider(row) : null;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRowToRider(row: Record<string, unknown>): Rider {
  return {
    riderId: row.riderId as string,
    profileId: row.profileId as string | undefined,
    name: row.name as string,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    emergencyContactName: row.emergencyContactName as string | undefined,
    emergencyContactPhone: row.emergencyContactPhone as string | undefined,
    photoS3Key: row.photoS3Key as string | undefined,
    qrCodeData: row.qrCodeData as string | undefined,
    status: row.status as string | undefined,
  };
}
