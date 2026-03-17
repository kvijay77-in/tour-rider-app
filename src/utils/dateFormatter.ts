/**
 * Date formatting utility functions for the Tour Rider App.
 */

/**
 * Format an ISO date string to a human-readable date.
 * @param isoDate - ISO 8601 date string (e.g., '2026-03-15')
 * @returns Formatted date string (e.g., 'Mar 15, 2026')
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO datetime string to a human-readable date and time.
 * @param isoDateTime - ISO 8601 datetime string
 * @returns Formatted datetime string (e.g., 'Mar 15, 2026, 10:30 AM')
 */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format an ISO datetime string to time only.
 * @param isoDateTime - ISO 8601 datetime string
 * @returns Formatted time string (e.g., '10:30 AM')
 */
export function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get a relative time description (e.g., '5 minutes ago', 'just now').
 * @param isoDateTime - ISO 8601 datetime string
 * @returns Relative time string
 */
export function getRelativeTime(isoDateTime: string): string {
  const now = new Date();
  const date = new Date(isoDateTime);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDate(isoDateTime);
}
