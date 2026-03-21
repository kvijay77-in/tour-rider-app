/**
 * Unit tests for src/utils/dateFormatter.ts
 */

import {
  formatDate,
  formatDateTime,
  formatTime,
  computeTourDay,
  getRelativeTime,
} from '../../src/utils/dateFormatter';

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-03-15');
    // Should contain year, month, and day — exact format depends on locale
    expect(result).toContain('2026');
    expect(result).toContain('Mar');
    expect(result).toContain('15');
  });

  it('formats a full ISO datetime as date only', () => {
    const result = formatDate('2026-07-04T14:30:00Z');
    expect(result).toContain('2026');
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe('formatDateTime', () => {
  it('includes both date and time components', () => {
    const result = formatDateTime('2026-03-15T14:30:00Z');
    expect(result).toContain('2026');
    expect(result).toContain('Mar');
    // Time portion should appear (exact depends on locale/TZ)
    expect(result.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('returns time-only string', () => {
    const result = formatTime('2026-03-15T14:30:00Z');
    // Should contain a colon separating hours and minutes
    expect(result).toContain(':');
    // Should be relatively short compared to full datetime
    expect(result.length).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------------------
// computeTourDay
// ---------------------------------------------------------------------------

describe('computeTourDay', () => {
  it('returns 1 for a tour that starts today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(computeTourDay(today)).toBe(1);
  });

  it('returns correct day for a past start date', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0];
    expect(computeTourDay(startDate)).toBe(4); // day 1 + 3 full days passed
  });

  it('returns 1 (minimum) when start date is in the future', () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 5);
    const startDate = tomorrow.toISOString().split('T')[0];
    expect(computeTourDay(startDate)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getRelativeTime
// ---------------------------------------------------------------------------

describe('getRelativeTime', () => {
  it('returns "just now" for timestamps less than a minute ago', () => {
    const now = new Date().toISOString();
    expect(getRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago for recent timestamps', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(getRelativeTime(fiveMinAgo)).toBe('5 minutes ago');
  });

  it('returns singular "minute" for 1 minute', () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    expect(getRelativeTime(oneMinAgo)).toBe('1 minute ago');
  });

  it('returns hours ago for older timestamps', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(getRelativeTime(twoHoursAgo)).toBe('2 hours ago');
  });

  it('returns singular "hour" for 1 hour', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(getRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  it('returns days ago for multi-day old timestamps', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(getRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('falls back to formatted date for timestamps older than 7 days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = getRelativeTime(tenDaysAgo);
    // Should return a formatted date string, not a "… ago" string
    expect(result).not.toContain('ago');
    expect(result.length).toBeGreaterThan(3);
  });
});
