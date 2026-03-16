/**
 * SQLite database initialisation and schema management.
 * 
 * Uses expo-sqlite for local data storage.
 * Schema matches the design in docs/DataIntegrationDesign.md §4.2.
 */

import * as SQLite from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Database instance
// ---------------------------------------------------------------------------

const DB_NAME = 'poc_app.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Get the database instance (lazy initialised).
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync(DB_NAME);
    await _db.execAsync('PRAGMA journal_mode = WAL;');
    await _db.execAsync('PRAGMA foreign_keys = ON;');
    await initialiseSchema(_db);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------

async function initialiseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- Tour context (single active tour cached)
    CREATE TABLE IF NOT EXISTS tour (
      tourId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      description TEXT,
      lastSyncedAt TEXT
    );

    -- Riders (cached from API - read only locally)
    CREATE TABLE IF NOT EXISTS riders (
      riderId TEXT PRIMARY KEY,
      profileId TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      emergencyContactName TEXT,
      emergencyContactPhone TEXT,
      photoS3Key TEXT,
      qrCodeData TEXT,
      status TEXT,
      lastSyncedAt TEXT
    );

    -- Rides (cached from API)
    CREATE TABLE IF NOT EXISTS rides (
      rideId TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      rideNo INTEGER,
      name TEXT,
      startLocation TEXT,
      finishLocation TEXT,
      totalDistance REAL,
      flagOffTime TEXT,
      status TEXT,
      stagesJson TEXT,
      description TEXT,
      startedAt TEXT,
      completedAt TEXT,
      closedAt TEXT,
      lastSyncedAt TEXT
    );

    -- Check-ins (cached from API + locally created)
    CREATE TABLE IF NOT EXISTS check_ins (
      checkInId TEXT PRIMARY KEY,
      riderId TEXT NOT NULL,
      rideId TEXT NOT NULL,
      stageNumber INTEGER NOT NULL,
      stageId TEXT,
      timestamp TEXT NOT NULL,
      checkedInBy TEXT,
      method TEXT,
      isNotRiding INTEGER DEFAULT 0,
      isQuitRiding INTEGER DEFAULT 0,
      isManualEntry INTEGER DEFAULT 0,
      notes TEXT,
      locationLat REAL,
      locationLng REAL,
      isLocal INTEGER DEFAULT 0,
      syncStatus TEXT DEFAULT 'SYNCED',
      syncError TEXT,
      syncRetryCount INTEGER DEFAULT 0,
      createdAt TEXT,
      lastSyncedAt TEXT
    );

    -- Pending operations queue (unified for online and offline)
    CREATE TABLE IF NOT EXISTS pending_operations (
      localId TEXT PRIMARY KEY,
      operationType TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      syncStatus TEXT DEFAULT 'PENDING',
      syncError TEXT,
      retryCount INTEGER DEFAULT 0,
      lastAttemptAt TEXT
    );

    -- Dashboard summary cache
    CREATE TABLE IF NOT EXISTS dashboard_summary (
      rideId TEXT PRIMARY KEY,
      totalRiders INTEGER DEFAULT 0,
      checkedIn INTEGER DEFAULT 0,
      notRiding INTEGER DEFAULT 0,
      quitRiding INTEGER DEFAULT 0,
      notCheckedIn INTEGER DEFAULT 0,
      lastSyncedAt TEXT
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_check_ins_rider ON check_ins(riderId);
    CREATE INDEX IF NOT EXISTS idx_check_ins_ride ON check_ins(rideId);
    CREATE INDEX IF NOT EXISTS idx_check_ins_sync ON check_ins(syncStatus);
    CREATE INDEX IF NOT EXISTS idx_pending_ops_status ON pending_operations(syncStatus);
  `);
}

// ---------------------------------------------------------------------------
// Maintenance utilities
// ---------------------------------------------------------------------------

/**
 * Run VACUUM to reclaim unused space.
 * Should be called during idle time, not at startup.
 */
export async function vacuumDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('VACUUM;');
}

/**
 * Purge data for completed/closed rides to save space.
 * Keeps only the current active ride's check-ins.
 */
export async function purgeClosedRideData(
  activeRideId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM check_ins WHERE rideId != ? AND syncStatus = 'SYNCED'`,
    [activeRideId],
  );
  await db.runAsync(
    `DELETE FROM dashboard_summary WHERE rideId != ?`,
    [activeRideId],
  );
}

/**
 * Reset any operations stuck in SYNCING state (e.g. after app crash).
 * Called at app startup.
 */
export async function resetStuckOperations(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_operations SET syncStatus = 'PENDING' WHERE syncStatus = 'SYNCING'`,
  );
  await db.runAsync(
    `UPDATE check_ins SET syncStatus = 'PENDING' WHERE syncStatus = 'SYNCING'`,
  );
}
