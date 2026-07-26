/**
 * Reusable password input with visibility toggle.
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants';

export type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'>;

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput(
  props,
  ref,
) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.container}>
      <TextInput
        ref={ref}
        style={styles.input}
        secureTextEntry={!isVisible}
        {...props}
      />
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => setIsVisible((previousValue) => !previousValue)}
        accessibilityRole="button"
        accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
      >
        <Ionicons
          name={isVisible ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

export default PasswordInput;
