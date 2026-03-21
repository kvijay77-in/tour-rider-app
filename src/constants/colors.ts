/**
 * Color scheme and theme constants for the Tour Rider App.
 * Aligned with the design system defined in SolutionDesign.md.
 */

/**
 * Primary brand colors
 */
export const COLORS = {
  // Brand colors
  primary: '#3B82F6',
  secondary: '#6B7280',
  accent: '#F59E0B',

  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

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
 * Stage-specific colors (for check-in status display)
 */
export const STAGE_COLORS = {
  start: '#D97706',
  pitStop1: '#7C2D12',
  pitStop2: '#1E40AF',
  finish: '#15803D',
  quitRiding: '#B91C1C',
  notRiding: '#3B82F6',
  notCheckedIn: '#D1D5DB',
};

/**
 * Check-in status colors
 */
export const CHECK_IN_STATUS_COLORS = {
  checkedIn: COLORS.success,
  notCheckedIn: COLORS.gray[300],
  notRiding: COLORS.info,
  quitRiding: COLORS.danger,
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
