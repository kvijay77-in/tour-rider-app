/**
 * Sync Service — background synchronisation between SQLite and backend API.
 * 
 * Architecture (per §4.3):
 * - Outbound sync: pending_operations queue → backend API (FIFO, mutex-locked)
 * - Inbound sync: backend API → SQLite (periodic polling)
 * - All operations are automatic — no manual intervention required
 * 
 * Conflict resolution follows §4.5 rules.
 */

import { ApiError } from '../api/apiClient';
import { createCheckIn as apiCreateCheckIn } from '../api/checkInApi';
import { getDashboardData } from '../api/dashboardApi';
import {
  getPendingOperations,
  markSyncing,
  markSynced as markOpSynced,
  markFailed as markOpFailed,
  PendingOperation,
} from '../database/pendingStore';
import {
  markCheckInSynced,
  markCheckInFailed,
  upsertCheckInsFromApi,
} from '../database/checkInStore';
import { upsertRiders } from '../database/riderStore';
import { upsertRide } from '../database/rideStore';
import { getDatabase } from '../database/database';
import { CheckInRequest } from '../../types/api';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const OUTBOUND_POLL_INTERVAL_MS = 3_000; // 3 seconds
const INBOUND_POLL_INTERVAL_MS = 5_000; // 5 seconds during active ride

// ---------------------------------------------------------------------------
// Mutex lock for outbound sync (prevents concurrent processing)
// ---------------------------------------------------------------------------

let _syncLock = false;

async function acquireLock(): Promise<boolean> {
  if (_syncLock) return false;
  _syncLock = true;
  return true;
}

function releaseLock(): void {
  _syncLock = false;
}

// ---------------------------------------------------------------------------
// Outbound sync: pending_operations → backend
// ---------------------------------------------------------------------------

export interface OutboundSyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ localId: string; error: string }>;
}

/**
 * Process all pending operations in FIFO order.
 * Only one sync can run at a time (mutex lock).
 * 
 * @param tourId  Active tour ID for API calls
 * @returns Sync result summary
 */
export async function processOutboundSync(
  tourId: string,
): Promise<OutboundSyncResult> {
  const acquired = await acquireLock();
  if (!acquired) {
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  const result: OutboundSyncResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  try {
    const pending = await getPendingOperations();

    for (const op of pending) {
      result.processed++;
      try {
        await processOperation(tourId, op);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({ localId: op.localId, error: errorMsg });
      }
    }
  } finally {
    releaseLock();
  }

  return result;
}

/**
 * Process a single pending operation.
 */
async function processOperation(
  tourId: string,
  op: PendingOperation,
): Promise<void> {
  // Mark as syncing (optimistic lock)
  await markSyncing(op.localId);

  try {
    if (op.operationType === 'CHECK_IN') {
      await processCheckInOperation(tourId, op);
    }
  } catch (error) {
    // Handle specific error types per §4.5 conflict resolution
    if (error instanceof ApiError) {
      await handleApiError(op, error);
    } else {
      // Network or unknown error — mark as failed, will retry
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (op.retryCount < MAX_RETRIES) {
        await markOpFailed(op.localId, errorMsg);
      } else {
        await markOpFailed(op.localId, `Max retries exceeded: ${errorMsg}`);
        await markCheckInFailed(op.localId, `Max retries exceeded: ${errorMsg}`);
      }
      throw error;
    }
  }
}

/**
 * Process a CHECK_IN operation.
 */
async function processCheckInOperation(
  tourId: string,
  op: PendingOperation,
): Promise<void> {
  const payload = JSON.parse(op.payload) as CheckInRequest;
  await apiCreateCheckIn(tourId, payload);

  // Success — mark both the operation and check-in as synced
  await markOpSynced(op.localId);
  await markCheckInSynced(op.localId);
}

/**
 * Handle API errors according to §4.5 conflict resolution rules.
 */
async function handleApiError(
  op: PendingOperation,
  error: ApiError,
): Promise<void> {
  const errorCode = error.errorCode || '';

  if (error.statusCode === 409) {
    // Conflict — determine type
    if (errorCode === 'DUPLICATE_CHECKIN' || errorCode.includes('DUPLICATE')) {
      // §4.5: Duplicate check-in — data already exists, mark as synced
      await markOpSynced(op.localId);
      await markCheckInSynced(op.localId);
      // Notification will be handled by the UI layer
      return;
    }

    // Other 409 errors (rider quit, ride closed) — handled based on
    // backend capability. If backend has §9 enhancements (timestamp-based
    // validation), the check-in would have been accepted. Without those
    // enhancements, mark as failed with descriptive error.
    const failReason = `Conflict: ${error.message} (${errorCode})`;
    await markOpFailed(op.localId, failReason);
    await markCheckInFailed(op.localId, failReason);
    return;
  }

  if (error.statusCode === 401) {
    // Auth error — token refresh handled by apiClient. If we still get 401,
    // mark as failed but allow retry after re-auth.
    await markOpFailed(op.localId, 'Authentication failed');
    return;
  }

  // Other client errors (400, 403, 404, etc.) — permanent failure
  if (error.statusCode >= 400 && error.statusCode < 500) {
    const failReason = `Client error: ${error.message} (${error.statusCode})`;
    await markOpFailed(op.localId, failReason);
    await markCheckInFailed(op.localId, failReason);
    return;
  }

  // Server errors (500+) — will be retried by the retry logic in processOperation
  throw error;
}

// ---------------------------------------------------------------------------
// Inbound sync: backend → SQLite
// ---------------------------------------------------------------------------

/**
 * Fetch dashboard data from the backend and update SQLite.
 * The Dashboard reads from SQLite, so this keeps the local cache current.
 */
export async function performInboundSync(
  tourId: string,
  rideId: string,
): Promise<void> {
  const { data } = await getDashboardData(tourId, rideId);

  if (!data) {
    // 304 Not Modified or no data — nothing to update
    return;
  }

  // Update local cache
  await upsertRide(data.ride);
  await upsertRiders(data.riders);
  await upsertCheckInsFromApi(data.checkIns);

  // Update dashboard summary
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO dashboard_summary
      (rideId, totalRiders, checkedIn, notRiding, quitRiding, notCheckedIn, lastSyncedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      rideId,
      data.summary.totalRiders,
      data.summary.checkedIn,
      data.summary.notRiding,
      data.summary.quitRiding,
      data.summary.notCheckedIn,
      new Date().toISOString(),
    ],
  );
}

// ---------------------------------------------------------------------------
// Sync orchestrator (called by app lifecycle)
// ---------------------------------------------------------------------------

let _outboundTimer: ReturnType<typeof setInterval> | null = null;
let _inboundTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the sync processes.
 * Called when the app goes online (or at app startup while online).
 */
export function startSync(tourId: string, rideId: string | null): void {
  stopSync();

  // Outbound: Process pending operations
  _outboundTimer = setInterval(() => {
    processOutboundSync(tourId).catch((err) => {
      // Non-critical: sync will retry on next interval
      console.warn('[Sync] Outbound sync error:', err);
    });
  }, OUTBOUND_POLL_INTERVAL_MS);

  // Trigger immediate outbound sync
  processOutboundSync(tourId).catch((err) => {
    console.warn('[Sync] Initial outbound sync error:', err);
  });

  // Inbound: Poll dashboard every 5 seconds (only if there's an active ride)
  if (rideId) {
    _inboundTimer = setInterval(() => {
      performInboundSync(tourId, rideId).catch((err) => {
        // Non-critical: sync will retry on next interval
        console.warn('[Sync] Inbound sync error:', err);
      });
    }, INBOUND_POLL_INTERVAL_MS);

    // Trigger immediate inbound sync
    performInboundSync(tourId, rideId).catch((err) => {
      console.warn('[Sync] Initial inbound sync error:', err);
    });
  }
}

/**
 * Stop all sync processes.
 * Called when the app goes offline or is backgrounded.
 */
export function stopSync(): void {
  if (_outboundTimer) {
    clearInterval(_outboundTimer);
    _outboundTimer = null;
  }
  if (_inboundTimer) {
    clearInterval(_inboundTimer);
    _inboundTimer = null;
  }
}

/**
 * Check if sync is currently running.
 */
export function isSyncRunning(): boolean {
  return _outboundTimer !== null || _inboundTimer !== null;
}
