/**
 * Mock data service for UI development and testing
 * This will be replaced with actual API calls later
 */

import {
  Rider,
  Ride,
  CheckIn,
  Stage,
  StageType,
  CheckInStatus,
  CheckInMethod,
  RideStatus,
  RiderStatus,
  Tour,
  TourStatus,
  DashboardData,
  deriveCheckInStatus,
} from '../../types/models';

// ============================================================================
// MOCK DATA FLAG
// ============================================================================

export const USE_MOCK_DATA = process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true';

// ============================================================================
// MOCK RIDERS
// ============================================================================

// Generate 90 riders programmatically
const generateRiders = (count: number): Rider[] => {
  const firstNames = ['Rajesh', 'Mei', 'Ahmed', 'Sofia', 'Yuki', 'Oluwaseun', 'Lars', 'Priya', 'Carlos', 'Fatima', 'Nguyen', 'Anastasia', 'Kwame', 'Sakura', 'Mohammed', 'Isabella', 'Kim', 'Amara', 'Diego', 'Aisha', 'Henrik', 'Lakshmi', 'Omar', 'Elena', 'Javier', 'Ling', 'Mateo', 'Zara', 'Hans', 'Noor', 'Adriana', 'Kofi', 'Yuki', 'Leila', 'Anton', 'Chioma', 'Rafael', 'Siti', 'Pierre', 'Thandiwe', 'Aarav', 'Beatriz', 'Chen', 'Dmitri', 'Esra', 'Finn', 'Gabriela', 'Hassan', 'Ivan', 'Jasmine'];
  const lastNames = ['Kumar', 'Chen', 'Hassan', 'Rodriguez', 'Tanaka', 'Adebayo', 'Andersson', 'Sharma', 'Silva', 'Al-Mansoori', 'Van Minh', 'Petrov', 'Nkrumah', 'Yamamoto', 'Al-Rashid', 'Rossi', 'Min-jun', 'Okafor', 'Martinez', 'Mbeki', 'Nielsen', 'Patel', 'Farouk', 'Popescu', 'Hernandez', 'Wang', 'Gonzalez', 'Khan', 'Mueller', 'Ibrahim', 'Costa', 'Mensah', 'Sato', 'Nasri', 'Volkov', 'Eze', 'Santos', 'Nurhaliza', 'Dubois', 'Dlamini', 'Singh', 'Lopez', 'Li', 'Petersen', 'Yilmaz', 'O\'Connor', 'Morales', 'Ali', 'Ivanov', 'Lee'];
  
  const riders: Rider[] = [];
  for (let i = 1; i <= count; i++) {
    const riderNum = String(i).padStart(3, '0');
    const firstName = firstNames[(i - 1) % firstNames.length];
    const lastName = lastNames[Math.floor((i - 1) / 2) % lastNames.length];
    const phone = `+1-555-${String(1000 + i).slice(1)}`; // Generate phone numbers
    riders.push({
      riderId: `R${riderNum}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}${i}@example.com`,
      phone: phone,
      qrCodeData: `QR_R${riderNum}`,
    });
  }
  return riders;
};

export const MOCK_RIDERS: Rider[] = generateRiders(90);

// ============================================================================
// MOCK STAGES
// ============================================================================

export const MOCK_STAGES: Stage[] = [
  {
    stageId: 'S001',
    stageNumber: 1,
    type: StageType.START,
    name: 'Start - City Center',
    distanceFromStart: 0,
    estimatedTimeFromStart: 0,
  },
  {
    stageId: 'S002',
    stageNumber: 2,
    type: StageType.PIT_STOP,
    name: 'Pit Stop 1 - Riverside Park',
    distanceFromStart: 25,
    estimatedTimeFromStart: 90,
  },
  {
    stageId: 'S003',
    stageNumber: 3,
    type: StageType.PIT_STOP,
    name: 'Pit Stop 2 - Mountain View',
    distanceFromStart: 50,
    estimatedTimeFromStart: 180,
  },
  {
    stageId: 'S004',
    stageNumber: 4,
    type: StageType.FINISH,
    name: 'Finish - Coastal Resort',
    distanceFromStart: 75,
    estimatedTimeFromStart: 270,
  },
];

// ============================================================================
// MOCK RIDE
// ============================================================================

export const MOCK_RIDE: Ride = {
  rideId: 'RIDE001',
  date: '2026-02-01',
  name: 'Day 1 - Coastal Route',
  startLocation: 'City Center',
  finishLocation: 'Coastal Resort',
  totalDistance: 75,
  stages: MOCK_STAGES,
  status: RideStatus.ACTIVE,
  startedAt: '2026-02-01T08:00:00Z',
};

// ============================================================================
// MOCK CHECK-INS
// ============================================================================

// Generate check-ins based on distribution: Start=35, PS1=23, PS2=14, Finish=10, NR=5, QR=3
// Total = 90 riders - distributed in jumbled order for realism
const generateCheckIns = (): CheckIn[] => {
  const checkIns: CheckIn[] = [];
  let checkInCounter = 1;
  
  // Define rider categories with jumbled rider IDs
  const finishRiders = ['R003', 'R007', 'R012', 'R018', 'R025', 'R031', 'R042', 'R056', 'R067', 'R078']; // 10 riders
  const ps2Riders = ['R002', 'R009', 'R015', 'R022', 'R028', 'R037', 'R044', 'R051', 'R059', 'R065', 'R072', 'R079', 'R085', 'R089']; // 14 riders
  const ps1Riders = ['R001', 'R005', 'R011', 'R016', 'R021', 'R026', 'R032', 'R038', 'R043', 'R048', 'R053', 'R058', 'R062', 'R068', 'R073', 'R077', 'R081', 'R084', 'R086', 'R087', 'R088', 'R090', 'R004']; // 23 riders
  const startRiders = ['R006', 'R008', 'R010', 'R013', 'R014', 'R017', 'R019', 'R020', 'R023', 'R024', 'R027', 'R029', 'R030', 'R033', 'R034', 'R035', 'R036', 'R039', 'R040', 'R041', 'R045', 'R046', 'R047', 'R049', 'R050', 'R052', 'R054', 'R055', 'R057', 'R060', 'R061', 'R063', 'R064', 'R066', 'R069']; // 35 riders (27 checked in at start + 8 not checked in yet)
  const nrRiders = ['R070', 'R071', 'R074', 'R075', 'R076']; // 5 riders
  const qrRiders = ['R080', 'R082', 'R083']; // 3 riders
  
  // Helper to add check-ins for a rider at multiple stages
  const addCheckInsForRider = (riderId: string, upToStage: number, isQuitting: boolean = false) => {
    const riderNum = parseInt(riderId.substring(1));
    
    for (let stageNum = 1; stageNum <= upToStage; stageNum++) {
      checkIns.push({
        checkInId: `CI${String(checkInCounter++).padStart(3, '0')}`,
        riderId,
        rideId: 'RIDE001',
        stageNumber: stageNum,
        stageId: `S${String(stageNum).padStart(3, '0')}`,
        isNotRiding: false,
        isQuitRiding: false,
        timestamp: `2026-02-01T${String(7 + stageNum).padStart(2, '0')}:${String((riderNum % 60)).padStart(2, '0')}:00Z`,
        checkedInBy: stageNum === 1 ? 'admin' : `crew${stageNum - 1}`,
        method: CheckInMethod.QR_SCAN,
      });
    }
    
    // If quitting, add a QUIT_RIDING check-in at the next stage
    if (isQuitting && upToStage < 4) {
      checkIns.push({
        checkInId: `CI${String(checkInCounter++).padStart(3, '0')}`,
        riderId,
        rideId: 'RIDE001',
        stageNumber: upToStage + 1,
        stageId: `S${String(upToStage + 1).padStart(3, '0')}`,
        isNotRiding: false,
        isQuitRiding: true,
        timestamp: `2026-02-01T${String(8 + upToStage).padStart(2, '0')}:${String((riderNum % 60)).padStart(2, '0')}:00Z`,
        checkedInBy: `crew${upToStage}`,
        method: CheckInMethod.MANUAL,
      });
    }
  };
  
  // Finish riders (completed all 4 stages)
  finishRiders.forEach(riderId => addCheckInsForRider(riderId, 4, false));
  
  // PS2 riders (reached stage 3)
  ps2Riders.forEach(riderId => addCheckInsForRider(riderId, 3, false));
  
  // PS1 riders (reached stage 2)
  ps1Riders.forEach(riderId => addCheckInsForRider(riderId, 2, false));
  
  // Start riders - first 27 checked in at start, last 8 have no check-ins yet
  startRiders.slice(0, 27).forEach(riderId => addCheckInsForRider(riderId, 1, false));
  
  // NR riders - marked as NOT_RIDING
  nrRiders.forEach(riderId => {
    const riderNum = parseInt(riderId.substring(1));
    checkIns.push({
      checkInId: `CI${String(checkInCounter++).padStart(3, '0')}`,
      riderId,
      rideId: 'RIDE001',
      stageNumber: 1,
      stageId: 'S001',
      isNotRiding: true,
      isQuitRiding: false,
      timestamp: `2026-02-01T07:${String((riderNum % 60)).padStart(2, '0')}:00Z`,
      checkedInBy: 'admin',
      method: CheckInMethod.MANUAL,
    });
  });
  
  // QR riders - quit at different stages for variety
  // R080 quits after Start
  addCheckInsForRider('R080', 1, true);
  // R082 quits after PS1
  addCheckInsForRider('R082', 2, true);
  // R083 quits after PS2
  addCheckInsForRider('R083', 3, true);
  
  return checkIns;
};

export const MOCK_CHECKINS: CheckIn[] = generateCheckIns();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all riders
 */
export const getMockRiders = (): Rider[] => {
  return MOCK_RIDERS;
};

/**
 * Get rider by ID
 */
export const getMockRiderById = (riderId: string): Rider | undefined => {
  return MOCK_RIDERS.find((r) => r.riderId === riderId);
};

/**
 * Get current ride
 */
export const getMockCurrentRide = (): Ride => {
  return MOCK_RIDE;
};

/**
 * Get ride by date
 */
export const getMockRideByDate = (date: string): Ride | undefined => {
  // For now, only return if date matches current ride
  return date === MOCK_RIDE.date ? MOCK_RIDE : undefined;
};

/**
 * Get check-ins for a ride
 */
export const getMockCheckIns = (rideId: string): CheckIn[] => {
  return MOCK_CHECKINS.filter((ci) => ci.rideId === rideId);
};

/**
 * Get check-ins for a specific rider in a ride
 */
export const getMockRiderCheckIns = (riderId: string, rideId: string): CheckIn[] => {
  return MOCK_CHECKINS.filter((ci) => ci.riderId === riderId && ci.rideId === rideId);
};

/**
 * Get last check-in for a rider in a ride
 */
export const getMockLastCheckIn = (riderId: string, rideId: string): CheckIn | undefined => {
  const checkIns = getMockRiderCheckIns(riderId, rideId);
  if (checkIns.length === 0) return undefined;
  
  // Sort by stage number and return last
  return checkIns.sort((a, b) => {
    const stageA = MOCK_STAGES.find((s) => s.stageId === a.stageId);
    const stageB = MOCK_STAGES.find((s) => s.stageId === b.stageId);
    return (stageB?.stageNumber || 0) - (stageA?.stageNumber || 0);
  })[0];
};

/**
 * Get last successful check-in (CHECKED_IN status) for a rider in a ride
 * This is used for determining the last stage a rider actually reached
 */
export const getMockLastSuccessfulCheckIn = (riderId: string, rideId: string): CheckIn | undefined => {
  const checkIns = getMockRiderCheckIns(riderId, rideId)
    .filter(ci => deriveCheckInStatus(ci) === CheckInStatus.CHECKED_IN);
  if (checkIns.length === 0) return undefined;
  
  // Sort by stage number and return last
  return checkIns.sort((a, b) => {
    const stageA = MOCK_STAGES.find((s) => s.stageId === a.stageId);
    const stageB = MOCK_STAGES.find((s) => s.stageId === b.stageId);
    return (stageB?.stageNumber || 0) - (stageA?.stageNumber || 0);
  })[0];
};

/**
 * Get rider status for dashboard
 */
export const getMockRiderStatus = (riderId: string): RiderStatus | undefined => {
  const rider = getMockRiderById(riderId);
  if (!rider) return undefined;
  
  const ride = getMockCurrentRide();
  const checkIns = getMockRiderCheckIns(riderId, ride.rideId);
  const lastCheckIn = getMockLastCheckIn(riderId, ride.rideId);
  
  // Determine overall status using derived status from boolean flags
  let overallStatus: CheckInStatus = CheckInStatus.NOT_CHECKED_IN;
  let lastStage: Stage | undefined = undefined;
  
  if (lastCheckIn) {
    const derivedStatus = deriveCheckInStatus(lastCheckIn);
    if (derivedStatus === CheckInStatus.NOT_RIDING || derivedStatus === CheckInStatus.QUIT_RIDING) {
      overallStatus = derivedStatus;
      // For QR and NR riders, use the last successful check-in stage (where they actually reached)
      // not the stage where they quit/marked as not riding
      const lastSuccessfulCheckIn = getMockLastSuccessfulCheckIn(riderId, ride.rideId);
      if (lastSuccessfulCheckIn) {
        lastStage = MOCK_STAGES.find((s) => s.stageId === lastSuccessfulCheckIn.stageId);
      }
    } else {
      overallStatus = CheckInStatus.CHECKED_IN;
      lastStage = MOCK_STAGES.find((s) => s.stageId === lastCheckIn.stageId);
    }
  }
  
  return {
    rider,
    ride,
    lastCheckIn,
    overallStatus,
    lastStage,
    checkInHistory: checkIns,
  };
};

/**
 * Get all rider statuses for dashboard
 */
export const getMockDashboardData = (): RiderStatus[] => {
  return MOCK_RIDERS.map((rider) => getMockRiderStatus(rider.riderId)).filter(
    (rs): rs is RiderStatus => rs !== undefined
  );
};

/**
 * Simulate QR code scan
 */
export const simulateQRScan = (qrCodeData: string): Rider | undefined => {
  return MOCK_RIDERS.find((r) => r.qrCodeData === qrCodeData);
};

// ============================================================================
// MOCK TOUR (for dev mode without backend)
// ============================================================================

export const MOCK_TOUR: Tour = {
  tourId: 'MOCK-TOUR-2026',
  name: 'Mock Cycling Tour 2026',
  startDate: '2026-02-01',
  endDate: '2026-02-08',
  status: TourStatus.ACTIVE,
  description: 'Synthetic tour for local development and demo',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ============================================================================
// MOCK DASHBOARD DATA (composite response shape)
// ============================================================================

export const getMockDashboardDataResponse = (): DashboardData => {
  return {
    ride: MOCK_RIDE,
    riders: MOCK_RIDERS,
    checkIns: MOCK_CHECKINS,
    summary: {
      totalRiders: MOCK_RIDERS.length,
      checkedIn: MOCK_CHECKINS.filter(ci => !ci.isNotRiding && !ci.isQuitRiding).length,
      notRiding: MOCK_CHECKINS.filter(ci => ci.isNotRiding).length,
      quitRiding: MOCK_CHECKINS.filter(ci => ci.isQuitRiding).length,
      notCheckedIn: MOCK_RIDERS.length - new Set(MOCK_CHECKINS.map(ci => ci.riderId)).size,
    },
  };
};
