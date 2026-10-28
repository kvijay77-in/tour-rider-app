import { StageType } from '../constants/stages';
import type { CheckIn } from '../types/checkin';
import { CheckInStatus, deriveCheckInStatus } from '../types/checkin';
import type { Ride } from '../types/ride';

export type RideCheckInCardState =
  | 'UNREGISTERED'
  | 'REGISTERED_WITHOUT_DATA'
  | 'REGISTERED_WITH_DATA';

export type SelfCheckInAction = 'START' | 'PIT_STOP' | 'FINISH' | 'NOT_RIDING' | 'QUIT_RIDING';

export interface CheckInTimelineEntry {
  checkIn: CheckIn;
  status: CheckInStatus;
}

export interface CheckInSummary {
  hasData: boolean;
  overallStatus: CheckInStatus;
  timeline: CheckInTimelineEntry[];
}

const ERROR_MESSAGES: Record<string, string> = {
  SELF_CHECKIN_NOT_ALLOWED: 'Self check-in is not available for this ride or stage.',
  PIT_STOP_NOT_OPEN: 'This pit stop is not open for check-in.',
  RIDE_NOT_ACTIVE: 'This ride is not currently active.',
  RIDE_NOT_TODAY: 'Self check-in is only available for today\'s ride.',
  NOT_RIDING_NOT_AVAILABLE: 'Not Riding is not available for this ride.',
  QUIT_RIDING_NOT_AVAILABLE: 'Quit Riding is not available for this ride.',
  RIDER_ALREADY_QUIT: 'You have already quit this ride.',
  QUIT_RIDING_CANCEL_NOT_ALLOWED: 'Quit Riding check-ins cannot be cancelled.',
  NOT_OWN_CHECKIN: 'Only your own check-in can be cancelled.',
  TOUR_NOT_ACTIVE: 'This tour is no longer active.',
  RIDER_NOT_IN_TOUR: 'You are not registered for this tour.',
};

function timestampValue(checkIn: CheckIn): number {
  const timestamp = Date.parse(checkIn.timestamp);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortCheckIns(checkIns: CheckIn[]): CheckIn[] {
  return [...checkIns].sort((left, right) => {
    const stageOrder = left.stageNumber - right.stageNumber;
    if (stageOrder !== 0) return stageOrder;
    return timestampValue(left) - timestampValue(right);
  });
}

export function getCheckInSummary(checkIns: CheckIn[]): CheckInSummary {
  const timeline = sortCheckIns(checkIns).map((checkIn) => ({
    checkIn,
    status: deriveCheckInStatus(checkIn),
  }));

  const overallStatus = timeline.some((entry) => entry.status === CheckInStatus.QUIT_RIDING)
    ? CheckInStatus.QUIT_RIDING
    : timeline.some((entry) => entry.status === CheckInStatus.NOT_RIDING)
      ? CheckInStatus.NOT_RIDING
      : timeline.length > 0
        ? CheckInStatus.CHECKED_IN
        : CheckInStatus.NOT_CHECKED_IN;

  return { hasData: timeline.length > 0, overallStatus, timeline };
}

export function getRideCheckInCardState(
  isRegistered: boolean,
  checkIns: CheckIn[] | null | undefined,
): RideCheckInCardState {
  if (!isRegistered) return 'UNREGISTERED';
  return checkIns && checkIns.length > 0 ? 'REGISTERED_WITH_DATA' : 'REGISTERED_WITHOUT_DATA';
}

export function getCheckInMethodLabel(method?: string): string | null {
  if (!method) return null;
  if (method === 'SELF_SERVICE') return 'Self';
  if (method === 'QR_SCAN') return 'Staff scan';
  if (method === 'MANUAL') return 'Staff entry';
  return method.replace(/_/g, ' ');
}

export function getAvailableSelfCheckInActions(
  ride: Ride,
  checkIns: CheckIn[],
): SelfCheckInAction[] {
  const activeCheckIns = checkIns.filter((checkIn) => checkIn.status !== 'CANCELLED');
  const activeQuit = activeCheckIns.some((checkIn) => checkIn.isQuitRiding);
  const hasNotRidingCheckIn = activeCheckIns.some((checkIn) => checkIn.isNotRiding);
  if (activeQuit || hasNotRidingCheckIn || (ride.status !== 'OPEN' && ride.status !== 'STARTED')) return [];
  if (!ride.selfService) return [];

  const actions: SelfCheckInAction[] = [];
  const stagePolicy = ride.selfService.stages;
  for (const stage of ride.stages) {
    const resolved = stagePolicy.find((item) => item.stageNumber === stage.stageNumber);
    const alreadyCheckedIn = activeCheckIns.some(
      (checkIn) => !checkIn.isNotRiding && !checkIn.isQuitRiding && checkIn.stageNumber === stage.stageNumber,
    );
    if (!resolved?.checkInAllowed || alreadyCheckedIn) continue;
    if (stage.type === StageType.START) actions.push('START');
    if (stage.type === StageType.PIT_STOP && stage.pitStopStatus === 'OPEN') actions.push('PIT_STOP');
    if (stage.type === StageType.FINISH) actions.push('FINISH');
  }

  const startStage = ride.stages.find((stage) => stage.type === StageType.START);
  const hasStartCheckIn = startStage && activeCheckIns.some(
    (checkIn) => !checkIn.isNotRiding && !checkIn.isQuitRiding && checkIn.stageNumber === startStage.stageNumber,
  );
  const hasFinishCheckIn = ride.stages.some((stage) => stage.type === StageType.FINISH
    && activeCheckIns.some((checkIn) => !checkIn.isNotRiding && !checkIn.isQuitRiding && checkIn.stageNumber === stage.stageNumber));
  if (ride.status === 'OPEN' && ride.selfService.notRidingAllowed && !hasStartCheckIn && !hasNotRidingCheckIn) {
    actions.push('NOT_RIDING');
  }
  if (ride.status === 'STARTED' && ride.selfService.quitRidingAllowed && !hasFinishCheckIn) {
    actions.push('QUIT_RIDING');
  }
  return actions;
}

export function canCancelCheckIn(
  checkIn: CheckIn,
  callerProfileId: string,
  ride: Ride,
): boolean {
  if (checkIn.isQuitRiding || checkIn.status === 'CANCELLED') return false;
  if (checkIn.checkedInBy !== callerProfileId) return false;
  if (ride.status !== 'OPEN' && ride.status !== 'STARTED') return false;
  if (!ride.selfService) return false;
  if (checkIn.isNotRiding) {
    return ride.status === 'OPEN' && ride.selfService.notRidingAllowed;
  }

  const stage = ride.selfService.stages.find((item) => item.stageNumber === checkIn.stageNumber);
  if (!stage?.checkInAllowed) return false;
  const rideStage = ride.stages.find((item) => item.stageNumber === checkIn.stageNumber);
  return rideStage?.type !== StageType.PIT_STOP || rideStage.pitStopStatus === 'OPEN';
}

export function getCheckInApiErrorMessage(errorCode?: string): string | null {
  return errorCode ? ERROR_MESSAGES[errorCode] ?? null : null;
}