import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import type { TCountryCode } from 'countries-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import {
  COUNTRY_OPTIONS,
  INDIA_STATES,
  combinePhoneNumber,
  splitPhoneNumber,
} from '../../profile-schema/options';
import {
  evaluateVisibleWhen,
  getLovItems,
  getProfileHandler,
  isAttributeReadOnlyForRider,
  type ProfileDefinitions,
  type ProfileDraftValues,
  type ProfileFieldDefinition,
  type ProfileValidationErrors,
} from '../../profile-schema';
import { formatDate } from '../../utils/dateFormatter';
import { SearchableSelectField, type SelectOption } from '../common/SearchableSelectField';

interface DynamicProfileFormProps {
  definitions: ProfileDefinitions;
  values: ProfileDraftValues;
  errors: ProfileValidationErrors;
  disabled?: boolean;
  excludedKeys?: string[];
  showAdminOnly?: boolean;
  onChange: (key: string, value: unknown) => void;
}

function updateNestedValue(target: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  if (path.length === 0) {
    return target;
  }

  const [head, ...rest] = path;
  if (!head) {
    return target;
  }

  if (rest.length === 0) {
    return { ...target, [head]: value };
  }

  const nested = target[head] && typeof target[head] === 'object' && !Array.isArray(target[head])
    ? target[head] as Record<string, unknown>
    : {};

  return {
    ...target,
    [head]: updateNestedValue(nested, rest, value),
  };
}

function buildCountryOptions(): SelectOption[] {
  return COUNTRY_OPTIONS.map((country) => ({
    value: country.code,
    label: country.name,
    leading: country.flag,
    detail: `+${country.callingCode}`,
  }));
}

const COUNTRY_SELECT_OPTIONS = buildCountryOptions();
const INDIA_STATE_OPTIONS: SelectOption[] = INDIA_STATES.map((state) => ({ value: state, label: state }));
let repeatableGroupItemSeed = 0;

function createRepeatableGroupItemId(): string {
  repeatableGroupItemSeed += 1;
  return `repeatable-group-${repeatableGroupItemSeed}`;
}

function FieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return <Text style={styles.errorText}>{error}</Text>;
}

function FieldHelpText({ helpText }: { helpText?: string }) {
  if (!helpText) {
    return null;
  }

  return <Text style={styles.helpText}>{helpText}</Text>;
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>;
}

function SectionHeader({ icon, title }: { icon?: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialIcons name={(icon as keyof typeof MaterialIcons.glyphMap) ?? 'article'} size={19} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MultiSelectField({
  definition,
  definitions,
  values,
  selectedValues,
  disabled,
  hasError,
  onChange,
}: {
  definition: ProfileFieldDefinition;
  definitions: ProfileDefinitions;
  values: ProfileDraftValues;
  selectedValues: string[];
  disabled: boolean;
  hasError: boolean;
  onChange: (nextValue: string[]) => void;
}) {
  const [visible, setVisible] = useState(false);
  const lov = definition.lovId ? definitions.lovsById[definition.lovId] : undefined;
  const options = useMemo(
    () => getLovItems(lov, definition.dependsOn ? values[definition.dependsOn] as string | undefined : undefined),
    [definition.dependsOn, lov, values],
  );
  const selectedLabels = selectedValues
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .join(', ');

  return (
    <>
      <TouchableOpacity
        style={[styles.selectButton, hasError ? styles.inputError : null]}
        onPress={() => setVisible(true)}
        disabled={disabled}
      >
        <Text style={selectedValues.length > 0 ? styles.selectText : styles.placeholderText}>
          {selectedLabels || definition.placeholder || `Select ${definition.label.toLowerCase()}`}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={22} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{definition.label}</Text>
            <Pressable onPress={() => setVisible(false)}>
              <MaterialIcons name="close" size={26} color={COLORS.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.multiSelectContent}>
            {options.map((option) => {
              const selected = selectedValues.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={styles.multiSelectOption}
                  onPress={() => {
                    if (selected) {
                      onChange(selectedValues.filter((entry) => entry !== option.value));
                    } else {
                      onChange([...selectedValues, option.value]);
                    }
                  }}
                >
                  <Text style={styles.multiSelectOptionLabel}>{option.label}</Text>
                  <MaterialIcons
                    name={selected ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={selected ? COLORS.primary : COLORS.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function BaseFieldRenderer({
  definitions,
  definition,
  value,
  errors,
  disabled,
  rootValues,
  groupValues,
  onChange,
}: {
  definitions: ProfileDefinitions;
  definition: ProfileFieldDefinition;
  value: unknown;
  errors: ProfileValidationErrors;
  disabled: boolean;
  rootValues: ProfileDraftValues;
  groupValues: ProfileDraftValues;
  onChange: (value: unknown) => void;
}) {
  const errorKey = definition.key;
  const error = errors[errorKey];
  const inputStyle = [styles.input, error ? styles.inputError : null];

  switch (definition.type) {
    case 'TEXT':
    case 'EMAIL':
    case 'URL':
    case 'NUMBER':
      return (
        <TextInput
          style={inputStyle}
          value={typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)}
          onChangeText={onChange}
          editable={!disabled}
          keyboardType={definition.type === 'NUMBER' ? 'decimal-pad' : definition.type === 'EMAIL' ? 'email-address' : 'default'}
          autoCapitalize={definition.type === 'EMAIL' || definition.type === 'URL' ? 'none' : 'sentences'}
          placeholder={definition.placeholder ?? `Enter ${definition.label.toLowerCase()}`}
          placeholderTextColor={COLORS.textDisabled}
        />
      );
    case 'TEXTAREA':
      return (
        <TextInput
          style={[inputStyle, styles.textArea]}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          editable={!disabled}
          multiline
          textAlignVertical="top"
          placeholder={definition.placeholder ?? `Enter ${definition.label.toLowerCase()}`}
          placeholderTextColor={COLORS.textDisabled}
        />
      );
    case 'BOOLEAN':
      return (
        <View style={[styles.booleanRow, error ? styles.booleanRowError : null]}>
          <Text style={styles.booleanValue}>{value ? 'Yes' : 'No'}</Text>
          <Switch value={Boolean(value)} onValueChange={onChange} disabled={disabled} />
        </View>
      );
    case 'DATE':
      return <DateField definition={definition} value={typeof value === 'string' ? value : ''} disabled={disabled} hasError={Boolean(error)} onChange={onChange} />;
    case 'PHONE':
      return <PhoneField definition={definition} value={typeof value === 'string' ? value : ''} disabled={disabled} hasError={Boolean(error)} onChange={onChange} />;
    case 'SELECT':
      return (
        <SelectField
          definitions={definitions}
          definition={definition}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          hasError={Boolean(error)}
          rootValues={rootValues}
          groupValues={groupValues}
          onChange={onChange}
        />
      );
    case 'MULTI_SELECT':
      return (
        <MultiSelectField
          definition={definition}
          definitions={definitions}
          values={{ ...rootValues, ...groupValues }}
          selectedValues={Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []}
          disabled={disabled}
          hasError={Boolean(error)}
          onChange={onChange as (nextValue: string[]) => void}
        />
      );
    case 'GROUP':
      return (
        <GroupField
          definitions={definitions}
          definition={definition}
          value={value}
          errors={errors}
          disabled={disabled}
          rootValues={rootValues}
          onChange={onChange}
        />
      );
    case 'FILE':
    case 'IMAGE':
      return (
        <View style={[styles.unsupportedField, error ? styles.inputError : null]}>
          <Text style={styles.unsupportedText}>
            {definition.label} uploads are not available from this form. Use the dedicated handler when configured.
          </Text>
        </View>
      );
    default:
      return null;
  }
}

function GroupField({
  definitions,
  definition,
  value,
  errors,
  disabled,
  rootValues,
  onChange,
}: {
  definitions: ProfileDefinitions;
  definition: ProfileFieldDefinition;
  value: unknown;
  errors: ProfileValidationErrors;
  disabled: boolean;
  rootValues: ProfileDraftValues;
  onChange: (value: unknown) => void;
}) {
  if (definition.repeatable) {
    return (
      <RepeatableGroupField
        definitions={definitions}
        definition={definition}
        value={value}
        errors={errors}
        disabled={disabled}
        rootValues={rootValues}
        onChange={onChange}
      />
    );
  }

  const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return (
    <View style={styles.groupContainer}>
      {definition.fields?.map((field) => {
        if (!evaluateVisibleWhen(field.visibleWhen, objectValue)) {
          return null;
        }

        const fieldPath = `${definition.key}.${field.key}`;
        return (
          <View key={fieldPath}>
            <FieldLabel label={field.label} required={field.required} />
            <FieldHelpText helpText={field.helpText} />
            <BaseFieldRenderer
              definitions={definitions}
              definition={field}
              value={objectValue[field.key]}
              errors={{ [field.key]: errors[fieldPath] }}
              disabled={disabled}
              rootValues={rootValues}
              groupValues={objectValue}
              onChange={(nextValue) => onChange(updateNestedValue(objectValue, [field.key], nextValue))}
            />
            <FieldError error={errors[fieldPath]} />
          </View>
        );
      })}
    </View>
  );
}

function RepeatableGroupField({
  definitions,
  definition,
  value,
  errors,
  disabled,
  rootValues,
  onChange,
}: {
  definitions: ProfileDefinitions;
  definition: ProfileFieldDefinition;
  value: unknown;
  errors: ProfileValidationErrors;
  disabled: boolean;
  rootValues: ProfileDraftValues;
  onChange: (value: unknown) => void;
}) {
  const sourceItems = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const items = useMemo(
    () => sourceItems.map((entry) => {
      const objectEntry = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
      return typeof objectEntry.__id === 'string'
        ? objectEntry
        : { ...objectEntry, __id: createRepeatableGroupItemId() };
    }),
    [sourceItems],
  );

  useEffect(() => {
    const hasGeneratedKeys = items.some((entry, index) => entry !== sourceItems[index]);
    if (hasGeneratedKeys) {
      onChange(items);
    }
  }, [items, onChange, sourceItems]);

  return (
    <View style={styles.repeatableGroupList}>
      {items.map((entry, index) => {
        const objectEntry = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
        return (
          <View key={String(objectEntry.__id ?? `${definition.key}-${index}`)} style={styles.repeatableGroupCard}>
            <View style={styles.repeatableGroupHeader}>
              <Text style={styles.repeatableGroupTitle}>{definition.label} {index + 1}</Text>
              {!disabled ? (
                <Pressable onPress={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
                  <MaterialIcons name="delete-outline" size={22} color={COLORS.danger} />
                </Pressable>
              ) : null}
            </View>
            {definition.fields?.map((field) => {
              if (!evaluateVisibleWhen(field.visibleWhen, objectEntry)) {
                return null;
              }

              const fieldPath = `${definition.key}.${field.key}`;
              return (
                <View key={fieldPath}>
                  <FieldLabel label={field.label} required={field.required} />
                  <FieldHelpText helpText={field.helpText} />
                  <BaseFieldRenderer
                    definitions={definitions}
                    definition={field}
                    value={objectEntry[field.key]}
                    errors={{ [field.key]: errors[`${definition.key}.${field.key}`] }}
                    disabled={disabled}
                    rootValues={rootValues}
                    groupValues={objectEntry}
                    onChange={(nextValue) => {
                      const nextItems = [...items];
                      nextItems[index] = updateNestedValue(objectEntry, [field.key], nextValue);
                      onChange(nextItems);
                    }}
                  />
                  <FieldError error={errors[`${definition.key}.${field.key}`]} />
                </View>
              );
            })}
          </View>
        );
      })}
      {!disabled && (!definition.maxItems || items.length < definition.maxItems) ? (
        <TouchableOpacity
          style={styles.repeatableAddButton}
          onPress={() => onChange([...items, { __id: createRepeatableGroupItemId() }])}
        >
          <MaterialIcons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.repeatableAddButtonText}>Add {definition.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
function DateField({
  definition,
  value,
  disabled,
  hasError,
  onChange,
}: {
  definition: ProfileFieldDefinition;
  value: string;
  disabled: boolean;
  hasError: boolean;
  onChange: (value: string) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const parsedDate = value ? new Date(value) : new Date(1990, 0, 1);

  const handleDateChange = (_event: DateTimePickerChangeEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      onChange(selectedDate.toISOString().split('T')[0] ?? '');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.selectButton, hasError ? styles.inputError : null]}
        onPress={() => setShowDatePicker(true)}
        disabled={disabled}
      >
        <Text style={value ? styles.selectText : styles.placeholderText}>
          {value ? formatDate(value) : definition.placeholder ?? `Select ${definition.label.toLowerCase()}`}
        </Text>
        <MaterialIcons name="calendar-today" size={19} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {showDatePicker ? (
        <DateTimePicker
          value={parsedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={handleDateChange}
          onDismiss={() => Platform.OS !== 'ios' && setShowDatePicker(false)}
          onNeutralButtonPress={() => Platform.OS !== 'ios' && setShowDatePicker(false)}
        />
      ) : null}
    </>
  );
}

function PhoneField({
  definition,
  value,
  disabled,
  hasError,
  onChange,
}: {
  definition: ProfileFieldDefinition;
  value: string;
  disabled: boolean;
  hasError: boolean;
  onChange: (value: string) => void;
}) {
  const parsedValue = splitPhoneNumber(value);
  const [phoneCountryCode, setPhoneCountryCode] = useState<TCountryCode>(parsedValue.countryCode);
  const [phoneCallingCode, setPhoneCallingCode] = useState(parsedValue.callingCode);
  const [phoneNumber, setPhoneNumber] = useState(parsedValue.phoneNumber);

  useEffect(() => {
    setPhoneCountryCode(parsedValue.countryCode);
    setPhoneCallingCode(parsedValue.callingCode);
    setPhoneNumber(parsedValue.phoneNumber);
  }, [parsedValue.callingCode, parsedValue.countryCode, parsedValue.phoneNumber]);

  const selectCountry = (option: SelectOption) => {
    const country = COUNTRY_OPTIONS.find((item) => item.code === option.value);
    if (!country) {
      return;
    }

    setPhoneCountryCode(country.code);
    setPhoneCallingCode(country.callingCode);
    onChange(combinePhoneNumber(country.callingCode, phoneNumber));
  };

  return (
    <View style={styles.phoneRow}>
      <SearchableSelectField
        label=""
        value={phoneCountryCode}
        options={COUNTRY_SELECT_OPTIONS}
        onSelect={selectCountry}
        placeholder="Code"
        searchPlaceholder="Search country or code"
        disabled={disabled}
        hasError={hasError}
        compact
        selectedLabel={`+${phoneCallingCode}`}
      />
      <TextInput
        style={[styles.input, styles.phoneInput, hasError ? styles.inputError : null]}
        value={phoneNumber}
        onChangeText={(nextValue) => {
          setPhoneNumber(nextValue);
          onChange(combinePhoneNumber(phoneCallingCode, nextValue));
        }}
        editable={!disabled}
        keyboardType="phone-pad"
        placeholder={definition.placeholder ?? definition.label}
        placeholderTextColor={COLORS.textDisabled}
      />
    </View>
  );
}

function SelectField({
  definitions,
  definition,
  value,
  disabled,
  hasError,
  rootValues,
  groupValues,
  onChange,
}: {
  definitions: ProfileDefinitions;
  definition: ProfileFieldDefinition;
  value: string;
  disabled: boolean;
  hasError: boolean;
  rootValues: ProfileDraftValues;
  groupValues: ProfileDraftValues;
  onChange: (value: string) => void;
}) {
  const lov = definition.lovId ? definitions.lovsById[definition.lovId] : undefined;
  const parentValues = groupValues[definition.dependsOn ?? ''] ?? rootValues[definition.dependsOn ?? ''];
  const options = getLovItems(lov, typeof parentValues === 'string' ? parentValues : undefined);

  if (definition.fallbackToText && definition.dependsOn && options.length === 0) {
    return (
      <TextInput
        style={[styles.input, hasError ? styles.inputError : null]}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        placeholder={definition.placeholder ?? `Enter ${definition.label.toLowerCase()}`}
        placeholderTextColor={COLORS.textDisabled}
      />
    );
  }

  const selectOptions: SelectOption[] = options.map((option) => ({ value: option.value, label: option.label }));

  if (definition.lovId === 'COUNTRY') {
    selectOptions.splice(0, selectOptions.length, ...COUNTRY_SELECT_OPTIONS);
  }

  if (definition.dependsOn && definition.lovId === 'STATE' && options.length === 0) {
    selectOptions.splice(0, selectOptions.length, ...INDIA_STATE_OPTIONS);
  }

  return (
    <SearchableSelectField
      label=""
      value={value}
      options={selectOptions}
      onSelect={(option) => onChange(option.value)}
      placeholder={definition.placeholder ?? `Select ${definition.label.toLowerCase()}`}
      searchPlaceholder={`Search ${definition.label.toLowerCase()}`}
      disabled={disabled}
      hasError={hasError}
    />
  );
}

export function DynamicProfileForm({
  definitions,
  values,
  errors,
  disabled = false,
  excludedKeys = [],
  showAdminOnly = false,
  onChange,
}: DynamicProfileFormProps) {
  return (
    <View style={styles.form}>
      {definitions.sections.map((section) => {
        const visibleAttributes = section.attributes.filter((attribute) => {
          if (excludedKeys.includes(attribute.key)) {
            return false;
          }

          if (!showAdminOnly && attribute.adminOnly) {
            return false;
          }

          return evaluateVisibleWhen(attribute.visibleWhen, values);
        });

        if (visibleAttributes.length === 0) {
          return null;
        }

        return (
          <View key={section.id}>
            <SectionHeader icon={section.icon} title={section.label} />
            {visibleAttributes.map((attribute) => {
              const fieldDisabled = disabled || isAttributeReadOnlyForRider(attribute);
              const handler = getProfileHandler(attribute);
              const value = values[attribute.key];
              const error = errors[attribute.key];
              const showReadOnlyBadge = fieldDisabled && (attribute.adminOnly || handler.readOnly);

              return (
                <View key={attribute.key}>
                  <FieldLabel label={attribute.label} required={attribute.required && !fieldDisabled} />
                  <FieldHelpText helpText={attribute.helpText} />
                  {showReadOnlyBadge ? <Text style={styles.readOnlyHint}>Read only</Text> : null}
                  <BaseFieldRenderer
                    definitions={definitions}
                    definition={attribute}
                    value={value}
                    errors={errors}
                    disabled={fieldDisabled}
                    rootValues={values}
                    groupValues={values}
                    onChange={(nextValue) => onChange(attribute.key, nextValue)}
                  />
                  <FieldError error={error} />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginTop: -2,
    marginBottom: 8,
  },
  readOnlyHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 13,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 110,
    paddingTop: 12,
    paddingBottom: 12,
  },
  inputError: {
    borderColor: COLORS.danger,
    borderWidth: 2,
  },
  errorText: {
    marginTop: -6,
    marginBottom: 12,
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  booleanRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 13,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  booleanRowError: {
    borderColor: COLORS.danger,
    borderWidth: 2,
  },
  booleanValue: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  selectButton: {
    minHeight: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 13,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  placeholderText: {
    fontSize: 16,
    color: COLORS.textDisabled,
  },
  groupContainer: {
    marginBottom: 4,
  },
  repeatableGroupList: {
    gap: 12,
    marginBottom: 12,
  },
  repeatableGroupCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    padding: 12,
  },
  repeatableGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  repeatableGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  repeatableAddButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  repeatableAddButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  unsupportedField: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    padding: 12,
    marginBottom: 12,
    justifyContent: 'center',
  },
  unsupportedText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
  multiSelectContent: {
    padding: 18,
    gap: 10,
  },
  multiSelectOption: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 13,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  multiSelectOptionLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginRight: 12,
  },
});

export default DynamicProfileForm;
