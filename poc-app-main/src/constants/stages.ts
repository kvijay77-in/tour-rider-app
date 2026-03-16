/**
 * Stage type definitions and constants
 */

import { StageType, CheckInStatus } from '../types/models';

/**
 * Stage type display names
 */
export const STAGE_TYPE_NAMES: Record<StageType, string> = {
  [StageType.START]: 'Start - Flag Off',
  [StageType.PIT_STOP]: 'Pit Stop',
  [StageType.FINISH]: 'Finish',
};

/**
 * Check-in status display names
 */
export const CHECK_IN_STATUS_NAMES: Record<CheckInStatus, string> = {
  [CheckInStatus.NOT_CHECKED_IN]: 'Not Checked In',
  [CheckInStatus.CHECKED_IN]: 'Checked In',
  [CheckInStatus.NOT_RIDING]: 'Not Riding',
  [CheckInStatus.QUIT_RIDING]: 'Quit Riding',
};

/**
 * Check-in status short labels for compact display
 */
export const CHECK_IN_STATUS_SHORT: Record<CheckInStatus, string> = {
  [CheckInStatus.NOT_CHECKED_IN]: 'Pending',
  [CheckInStatus.CHECKED_IN]: 'Done',
  [CheckInStatus.NOT_RIDING]: 'NR',
  [CheckInStatus.QUIT_RIDING]: 'QR',
};

/**
 * Stage ordering for sorting
 */
export const STAGE_ORDER: Record<StageType, number> = {
  [StageType.START]: 1,
  [StageType.PIT_STOP]: 2,
  [StageType.FINISH]: 3,
};

/**
 * Check-in status priority for sorting
 * Lower number = higher priority (appears first)
 */
export const CHECK_IN_STATUS_PRIORITY: Record<CheckInStatus, number> = {
  [CheckInStatus.NOT_CHECKED_IN]: 1,
  [CheckInStatus.CHECKED_IN]: 2,
  [CheckInStatus.NOT_RIDING]: 3,
  [CheckInStatus.QUIT_RIDING]: 4,
};

/**
 * Special status indicators
 */
export const SPECIAL_STATUSES = [
  CheckInStatus.NOT_RIDING,
  CheckInStatus.QUIT_RIDING,
];

/**
 * Check if status is a special case
 */
export const isSpecialStatus = (status: CheckInStatus): boolean => {
  return SPECIAL_STATUSES.includes(status);
};
