/**
 * Styled button component with primary, secondary, and danger variants.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { COLORS, BUTTON_COLORS } from '../../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ButtonProps {
  /** Button label */
  title: string;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Disable interactions */
  disabled?: boolean;
  /** Show a loading spinner instead of the title */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ButtonInner({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle[] = [
    styles.container,
    styles[variant],
    ...(isDisabled ? [styles.disabled] : []),
  ];

  const labelStyle: TextStyle[] = [
    styles.label,
    variant === 'secondary' ? styles.labelSecondary : styles.labelLight,
    ...(isDisabled ? [styles.labelDisabled] : []),
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' ? COLORS.textPrimary : COLORS.white}
        />
      ) : (
        <Text style={labelStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export const Button = React.memo(ButtonInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: BUTTON_COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.gray[200],
  },
  danger: {
    backgroundColor: BUTTON_COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelLight: {
    color: COLORS.white,
  },
  labelSecondary: {
    color: COLORS.textPrimary,
  },
  labelDisabled: {
    color: COLORS.textDisabled,
  },
});

export default Button;

