/**
 * Pending operations store — manages the queue for async backend sync.
 * 
 * Per design (§4.3): All check-ins flow through this queue, whether
 * online or offline. The sync service processes the queue independently.
 */

import { getDatabase } from './database';
import { CheckInRequest } from '../../types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationType = 'CHECK_IN';
export type PendingStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface PendingOperation {
  localId: string;
  operationType: OperationType;
  payload: string;
  createdAt: string;
  syncStatus: PendingStatus;
  syncError: string | null;
  retryCount: number;
  lastAttemptAt: string | null;
}

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

/**
 * Add a check-in operation to the pending queue.
 */
export async function enqueueCheckIn(
  localId: string,
  checkInRequest: CheckInRequest,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO pending_operations
      (localId, operationType, payload, createdAt, syncStatus)
     VALUES (?, 'CHECK_IN', ?, ?, 'PENDING')`,
    [localId, JSON.stringify(checkInRequest), new Date().toISOString()],
  );
}

/**
 * Get all pending operations in FIFO order (oldest first).
 */
export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM pending_operations
     WHERE syncStatus = 'PENDING'
     ORDER BY createdAt ASC`,
  );
  return rows.map(mapRowToOperation);
}

/**
 * Get count of pending operations.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT COUNT(*) as count FROM pending_operations WHERE syncStatus IN ('PENDING', 'SYNCING')`,
  );
  return (row?.count as number) ?? 0;
}

/**
 * Mark an operation as currently syncing (optimistic lock).
 */
export async function markSyncing(localId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_operations SET syncStatus = 'SYNCING', lastAttemptAt = ? WHERE localId = ?`,
    [new Date().toISOString(), localId],
  );
}

/**
 * Mark an operation as successfully synced and remove from queue.
 */
export async function markSynced(localId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM pending_operations WHERE localId = ?',
    [localId],
  );
}

/**
 * Mark an operation as failed with error details.
 */
export async function markFailed(
  localId: string,
  error: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_operations
     SET syncStatus = 'FAILED', syncError = ?, retryCount = retryCount + 1, lastAttemptAt = ?
     WHERE localId = ?`,
    [error, new Date().toISOString(), localId],
  );
}

/**
 * Re-queue a failed operation for retry.
 */
export async function requeueFailed(localId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_operations SET syncStatus = 'PENDING', syncError = NULL WHERE localId = ?`,
    [localId],
  );
}

/**
 * Get all failed operations.
 */
export async function getFailedOperations(): Promise<PendingOperation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM pending_operations WHERE syncStatus = 'FAILED' ORDER BY createdAt ASC`,
  );
  return rows.map(mapRowToOperation);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRowToOperation(row: Record<string, unknown>): PendingOperation {
  return {
    localId: row.localId as string,
    operationType: row.operationType as OperationType,
    payload: row.payload as string,
    createdAt: row.createdAt as string,
    syncStatus: row.syncStatus as PendingStatus,
    syncError: row.syncError as string | null,
    retryCount: row.retryCount as number,
    lastAttemptAt: row.lastAttemptAt as string | null,
  };
}
