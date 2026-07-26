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
  ViewProfile: undefined;
  TrainingChallenge: undefined;
  Tour: undefined;
  ChangePassword: undefined;
};

/**
 * Tour stack screens under drawer tour entry.
 */
export type TourStackParamList = {
  TourRides: undefined;
  RideDetails: { rideId: string };
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
