/**
 * Color scheme and theme constants
 */

import { CheckInStatus, StageType } from '../types/models';

/**
 * Primary brand colors
 */
export const COLORS = {
  // Brand colors
  primary: '#007AFF',
  secondary: '#5856D6',
  accent: '#FF9500',
  
  // Status colors - for check-in status indicators
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  info: '#007AFF',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  
  // Background
  background: '#F9FAFB',
  surface: '#FFFFFF',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  
  // Border
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

/**
 * Color mapping for check-in status (Dashboard rider icons)
 * Based on last stage where rider checked in
 */
export const CHECK_IN_STATUS_COLORS: Record<CheckInStatus, string> = {
  [CheckInStatus.NOT_CHECKED_IN]: COLORS.gray[300], // Gray - not checked in
  [CheckInStatus.CHECKED_IN]: COLORS.success, // Green - checked in
  [CheckInStatus.NOT_RIDING]: COLORS.info, // Blue - not riding for the day
  [CheckInStatus.QUIT_RIDING]: COLORS.danger, // Red - quit riding
};

/**
 * Color mapping for stage types
 */
export const STAGE_TYPE_COLORS: Record<StageType, string> = {
  [StageType.START]: COLORS.accent, // Orange - start
  [StageType.PIT_STOP]: COLORS.primary, // Blue - pit stop
  [StageType.FINISH]: COLORS.success, // Green - finish
};

/**
 * Dashboard legend colors (for rider status visualization)
 * These colors represent the stage where rider last checked in
 */
export const DASHBOARD_STAGE_COLORS = {
  notCheckedIn: COLORS.white,
  start: '#D97706', // Dark Orange
  pitStop1: '#7C2D12', // Dark Brown
  pitStop2: '#1E40AF', // Dark Blue
  pitStop3: '#7C3AED', // Dark Purple
  finish: '#15803D', // Dark Green
  notRiding: COLORS.gray[400], // Grey
  quitRiding: '#B91C1C', // Dark Red
};

/**
 * Get color for stage number (for pit stops)
 */
export const getStageColor = (stageNumber: number, totalStages: number): string => {
  if (stageNumber === 1) return DASHBOARD_STAGE_COLORS.start;
  if (stageNumber === totalStages) return DASHBOARD_STAGE_COLORS.finish;
  
  // For pit stops, cycle through available colors
  const pitStopColors = [
    DASHBOARD_STAGE_COLORS.pitStop1,
    DASHBOARD_STAGE_COLORS.pitStop2,
    DASHBOARD_STAGE_COLORS.pitStop3,
  ];
  
  const pitStopIndex = stageNumber - 2; // Adjust for start (stage 1)
  return pitStopColors[pitStopIndex % pitStopColors.length];
};

/**
 * Button colors
 */
export const BUTTON_COLORS = {
  primary: COLORS.primary,
  secondary: COLORS.gray[600],
  success: COLORS.success,
  danger: COLORS.danger,
  warning: COLORS.warning,
};

/**
 * Stage View specific colors
 */
export const STAGE_VIEW_COLORS = {
  notCheckedInAtStage: COLORS.white, // White with grey border for not checked in at selected stage
};

/**
 * QR Scanner colors
 */
export const QR_SCANNER_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.5)',
  frame: COLORS.primary,
  success: COLORS.success,
  error: COLORS.danger,
};
