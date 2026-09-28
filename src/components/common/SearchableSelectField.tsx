import React, { useDeferredValue, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../../constants';

export interface SelectOption {
  value: string;
  label: string;
  leading?: string;
  detail?: string;
}

interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  onSelect: (option: SelectOption) => void;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  hasError?: boolean;
  compact?: boolean;
  selectedLabel?: string;
}

export function SearchableSelectField({
  label,
  value,
  options,
  onSelect,
  placeholder,
  searchPlaceholder,
  disabled = false,
  hasError = false,
  compact = false,
  selectedLabel,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const selectedOption = options.find((option) => option.value === value);
  const hasSelectedValue = Boolean(selectedOption || selectedLabel);
  const filteredOptions = deferredQuery
    ? options.filter((option) => `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(deferredQuery))
    : options;

  const close = () => {
    setVisible(false);
    setQuery('');
  };

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, compact ? styles.compactField : null, hasError ? styles.errorField : null]}
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
      >
        <Text style={[styles.value, !hasSelectedValue ? styles.placeholder : null]} numberOfLines={1}>
          {selectedOption?.leading ? `${selectedOption.leading} ` : ''}
          {selectedLabel ?? selectedOption?.label ?? placeholder}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={22} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label || placeholder}</Text>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close selector">
              <MaterialIcons name="close" size={26} color={COLORS.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={21} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={COLORS.textDisabled}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredOptions}
            keyExtractor={(option) => option.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  onSelect(item);
                  close();
                }}
              >
                {item.leading ? <Text style={styles.leading}>{item.leading}</Text> : null}
                <Text style={styles.optionLabel}>{item.label}</Text>
                {item.detail ? <Text style={styles.optionDetail}>{item.detail}</Text> : null}
                {item.value === value ? (
                  <MaterialIcons name="check" size={21} color={COLORS.primary} />
                ) : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No matching options</Text>}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 13,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compactField: {
    width: 116,
    marginBottom: 0,
  },
  errorField: {
    borderColor: COLORS.danger,
    borderWidth: 2,
  },
  value: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  placeholder: {
    color: COLORS.textDisabled,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    minHeight: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  searchContainer: {
    margin: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  option: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  leading: {
    width: 34,
    fontSize: 21,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  optionDetail: {
    marginRight: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 28,
  },
});