/**
 * Unit tests for type helper functions.
 */

import { CheckInStatus, deriveCheckInStatus } from '../../src/types/checkin';
import type { CheckIn } from '../../src/types/checkin';

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    checkInId: 'ci-001',
    riderId: 'R1',
    rideId: 'ride-001',
    stageNumber: 1,
    stageId: 'stage-001',
    timestamp: '2026-03-15T10:00:00Z',
    checkedInBy: 'SYSTEM',
    isNotRiding: false,
    isQuitRiding: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deriveCheckInStatus
// ---------------------------------------------------------------------------

describe('deriveCheckInStatus', () => {
  it('returns NOT_RIDING when isNotRiding is true', () => {
    const checkIn = makeCheckIn({ isNotRiding: true, isQuitRiding: false });
    expect(deriveCheckInStatus(checkIn)).toBe(CheckInStatus.NOT_RIDING);
  });

  it('returns QUIT_RIDING when isQuitRiding is true', () => {
    const checkIn = makeCheckIn({ isNotRiding: false, isQuitRiding: true });
    expect(deriveCheckInStatus(checkIn)).toBe(CheckInStatus.QUIT_RIDING);
  });

  it('returns CHECKED_IN for normal check-in', () => {
    const checkIn = makeCheckIn({ isNotRiding: false, isQuitRiding: false });
    expect(deriveCheckInStatus(checkIn)).toBe(CheckInStatus.CHECKED_IN);
  });

  it('prioritises NOT_RIDING over QUIT_RIDING when both are true', () => {
    // Edge case: both flags true — function checks isNotRiding first
    const checkIn = makeCheckIn({ isNotRiding: true, isQuitRiding: true });
    expect(deriveCheckInStatus(checkIn)).toBe(CheckInStatus.NOT_RIDING);
  });
});

// ---------------------------------------------------------------------------
// CheckInStatus enum values
// ---------------------------------------------------------------------------

describe('CheckInStatus', () => {
  it('contains expected status values', () => {
    expect(CheckInStatus.NOT_CHECKED_IN).toBe('NOT_CHECKED_IN');
    expect(CheckInStatus.CHECKED_IN).toBe('CHECKED_IN');
    expect(CheckInStatus.NOT_RIDING).toBe('NOT_RIDING');
    expect(CheckInStatus.QUIT_RIDING).toBe('QUIT_RIDING');
  });
});
