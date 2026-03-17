/**
 * Stage type definitions and constants for the Tour Rider App.
 */

/**
 * Stage types in a ride
 */
export enum StageType {
  START = 'START',
  PIT_STOP = 'PIT_STOP',
  FINISH = 'FINISH',
}

/**
 * Human-readable stage type labels
 */
export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  [StageType.START]: 'Start',
  [StageType.PIT_STOP]: 'Pit Stop',
  [StageType.FINISH]: 'Finish',
};
