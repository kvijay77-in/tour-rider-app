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
 * Root navigator
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Loading: undefined;
};
