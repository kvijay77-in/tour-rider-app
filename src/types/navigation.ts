/**
 * Navigation types for the Tour Rider App.
 */

/**
 * Auth stack screens (unauthenticated)
 */
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EnforcedPasswordChange: { email?: string } | undefined;
};

/**
 * Main tab screens (authenticated)
 */
export type MainTabParamList = {
  HomeTab: undefined;
  CheckInTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};

/**
 * Main drawer screens (authenticated).
 */
export type MainDrawerParamList = {
  Home: { successMessage?: string } | undefined;
  Notifications: undefined;
  ViewProfile: undefined;
  TrainingChallenge: undefined;
  Tour: undefined;
  Events: undefined;
  ChangePassword: undefined;
};

/** Event list and details screens. */
export type EventsStackParamList = {
  EventsList: undefined;
  EventDetails: { tourId: string; eventId: string; riderId: string };
};

/**
 * Tour stack screens under drawer tour entry.
 */
export type TourStackParamList = {
  TourRides: undefined;
  RideDetails: { rideId: string; tourId: string };
  CheckInStatus: { tourId: string; riderId: string; rideId: string; rideNo: number };
};

/**
 * Home stack screens
 */
export type HomeStackParamList = {
  Home: undefined;
  TourList: undefined;
  TourDetails: { tourId: string };
  TourRegistration: { tourId: string };
  TourDashboard: { tourId: string };
};

/**
 * Check-in stack screens
 */
export type CheckInStackParamList = {
  CheckInStatus: undefined;
  CheckInHistory: undefined;
};

/**
 * Authenticated app stack screens.
 */
export type AppStackParamList = {
  MainTabs: { successMessage?: string } | undefined;
  ProfileCreation: undefined;
  ChangePassword: undefined;
};

/**
 * Root navigator
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Loading: undefined;
};
