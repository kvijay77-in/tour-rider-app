import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import type { TCountryCode } from 'countries-list';

import { COLORS } from '../../constants';
import { formatDate } from '../../utils/dateFormatter';
import {
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  INDIA_STATES,
  type CountryOption,
  type ProfileFormErrors,
  type ProfileFormField,
  type ProfileFormValues,
} from '../../utils/profileForm';
import { SearchableSelectField, type SelectOption } from '../common/SearchableSelectField';

interface Props {
  email: string;
  values: ProfileFormValues;
  errors: ProfileFormErrors;
  disabled?: boolean;
  onChange: <Key extends keyof ProfileFormValues>(
    field: Key,
    value: ProfileFormValues[Key],
    errorField?: ProfileFormField,
  ) => void;
}

const COUNTRY_SELECT_OPTIONS: SelectOption[] = COUNTRY_OPTIONS.map((country) => ({
  value: country.code,
  label: country.name,
  leading: country.flag,
  detail: `+${country.callingCode}`,
}));

const INDIA_STATE_OPTIONS: SelectOption[] = INDIA_STATES.map((state) => ({ value: state, label: state }));

export function ProfileFormFields({ email, values, errors, disabled = false, onChange }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const inputStyle = (hasError?: boolean) => [styles.input, hasError ? styles.inputError : null];
  const selectCountry = (option: SelectOption, prefix: 'phone' | 'emergencyPhone') => {
    const country = COUNTRY_OPTIONS.find((item) => item.code === option.value) as CountryOption;
    onChange(`${prefix}CountryCode` as keyof ProfileFormValues, country.code as never);
    onChange(
      `${prefix}CallingCode` as keyof ProfileFormValues,
      country.callingCode as never,
      prefix === 'phone' ? 'phone' : 'emergencyContactPhone',
    );
  };
  const onDateValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    onChange('dateOfBirth', selectedDate, 'dateOfBirth');
  };

  return (
    <View style={styles.form}>
      <SectionHeader icon="person-outline" title="Personal details" />
      <Text style={styles.label}>Full name *</Text>
      <TextInput
        style={inputStyle(errors.name)}
        value={values.name}
        onChangeText={(value) => onChange('name', value, 'name')}
        editable={!disabled}
        placeholder="Enter your full name"
        placeholderTextColor={COLORS.textDisabled}
      />

      <Text style={styles.label}>Email *</Text>
      <TextInput style={[styles.input, styles.readOnlyInput]} value={email} editable={false} />

      <Text style={styles.label}>Phone no. *</Text>
      <View style={styles.phoneRow}>
        <SearchableSelectField
          label=""
          value={values.phoneCountryCode}
          options={COUNTRY_SELECT_OPTIONS}
          onSelect={(option) => selectCountry(option, 'phone')}
          placeholder="Code"
          searchPlaceholder="Search country or code"
          disabled={disabled}
          hasError={errors.phone}
          compact
          selectedLabel={`+${values.phoneCallingCode}`}
        />
        <TextInput
          style={[styles.input, styles.phoneInput, errors.phone ? styles.inputError : null]}
          value={values.phoneNumber}
          onChangeText={(value) => onChange('phoneNumber', value, 'phone')}
          editable={!disabled}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={COLORS.textDisabled}
        />
      </View>

      <Text style={styles.label}>Date of birth *</Text>
      <TouchableOpacity
        style={[styles.selectButton, errors.dateOfBirth ? styles.inputError : null]}
        onPress={() => setShowDatePicker(true)}
        disabled={disabled}
      >
        <Text style={values.dateOfBirth ? styles.selectText : styles.placeholderText}>
          {values.dateOfBirth ? formatDate(values.dateOfBirth.toISOString()) : 'Select date of birth'}
        </Text>
        <MaterialIcons name="calendar-today" size={19} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {showDatePicker ? (
        <DateTimePicker
          value={values.dateOfBirth ?? new Date(1990, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onValueChange={onDateValueChange}
          onDismiss={() => Platform.OS !== 'ios' && setShowDatePicker(false)}
          onNeutralButtonPress={() => Platform.OS !== 'ios' && setShowDatePicker(false)}
        />
      ) : null}

      <Text style={styles.label}>Gender *</Text>
      <View style={[styles.genderRow, errors.gender ? styles.choiceGroupError : null]}>
        {GENDER_OPTIONS.map((option) => {
          const selected = values.gender === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.genderChip, selected ? styles.genderChipSelected : null]}
              onPress={() => onChange('gender', option, 'gender')}
              disabled={disabled}
            >
              <Text style={[styles.genderChipText, selected ? styles.genderChipTextSelected : null]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionHeader icon="home" title="Address" />
      <Text style={styles.label}>Line 1 *</Text>
      <TextInput
        style={inputStyle(errors.addressLine1)}
        value={values.addressLine1}
        onChangeText={(value) => onChange('addressLine1', value, 'addressLine1')}
        editable={!disabled}
        placeholder="House no. and street"
        placeholderTextColor={COLORS.textDisabled}
      />
      <Text style={styles.label}>Line 2</Text>
      <TextInput
        style={styles.input}
        value={values.addressLine2}
        onChangeText={(value) => onChange('addressLine2', value)}
        editable={!disabled}
        placeholder="Apartment, suite or landmark"
        placeholderTextColor={COLORS.textDisabled}
      />
      <Text style={styles.label}>City *</Text>
      <TextInput
        style={inputStyle(errors.city)}
        value={values.city}
        onChangeText={(value) => onChange('city', value, 'city')}
        editable={!disabled}
        placeholder="City"
        placeholderTextColor={COLORS.textDisabled}
      />
      <SearchableSelectField
        label="Country *"
        value={values.countryCode}
        options={COUNTRY_SELECT_OPTIONS}
        onSelect={(option) => {
          const country = COUNTRY_OPTIONS.find((item) => item.code === option.value) as CountryOption;
          onChange('countryCode', country.code as TCountryCode);
          onChange('country', country.name, 'country');
          onChange('state', '', 'state');
        }}
        placeholder="Select country"
        searchPlaceholder="Search countries"
        disabled={disabled}
        hasError={errors.country}
      />
      {values.country === 'India' ? (
        <SearchableSelectField
          label="State *"
          value={values.state}
          options={INDIA_STATE_OPTIONS}
          onSelect={(option) => onChange('state', option.value, 'state')}
          placeholder="Select state"
          searchPlaceholder="Search states"
          disabled={disabled}
          hasError={errors.state}
        />
      ) : (
        <>
          <Text style={styles.label}>State / Province *</Text>
          <TextInput
            style={inputStyle(errors.state)}
            value={values.state}
            onChangeText={(value) => onChange('state', value, 'state')}
            editable={!disabled}
            placeholder="State or province"
            placeholderTextColor={COLORS.textDisabled}
          />
        </>
      )}
      <Text style={styles.label}>Postal code *</Text>
      <TextInput
        style={inputStyle(errors.postalCode)}
        value={values.postalCode}
        onChangeText={(value) => onChange('postalCode', value, 'postalCode')}
        editable={!disabled}
        placeholder="Postal code"
        placeholderTextColor={COLORS.textDisabled}
      />

      <SectionHeader icon="contact-phone" title="Emergency contact" />
      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={inputStyle(errors.emergencyContactName)}
        value={values.emergencyContactName}
        onChangeText={(value) => onChange('emergencyContactName', value, 'emergencyContactName')}
        editable={!disabled}
        placeholder="Contact name"
        placeholderTextColor={COLORS.textDisabled}
      />
      <Text style={styles.label}>Relation *</Text>
      <TextInput
        style={inputStyle(errors.emergencyContactRelationship)}
        value={values.emergencyContactRelationship}
        onChangeText={(value) => onChange('emergencyContactRelationship', value, 'emergencyContactRelationship')}
        editable={!disabled}
        placeholder="Relationship to rider"
        placeholderTextColor={COLORS.textDisabled}
      />
      <Text style={styles.label}>Phone no. *</Text>
      <View style={styles.phoneRow}>
        <SearchableSelectField
          label=""
          value={values.emergencyPhoneCountryCode}
          options={COUNTRY_SELECT_OPTIONS}
          onSelect={(option) => selectCountry(option, 'emergencyPhone')}
          placeholder="Code"
          searchPlaceholder="Search country or code"
          disabled={disabled}
          hasError={errors.emergencyContactPhone}
          compact
          selectedLabel={`+${values.emergencyPhoneCallingCode}`}
        />
        <TextInput
          style={[styles.input, styles.phoneInput, errors.emergencyContactPhone ? styles.inputError : null]}
          value={values.emergencyContactPhone}
          onChangeText={(value) => onChange('emergencyContactPhone', value, 'emergencyContactPhone')}
          editable={!disabled}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={COLORS.textDisabled}
        />
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof MaterialIcons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialIcons name={icon} size={19} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  inputError: {
    borderColor: COLORS.danger,
    borderWidth: 2,
  },
  readOnlyInput: {
    backgroundColor: COLORS.gray[100],
    color: COLORS.textSecondary,
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
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    borderRadius: 8,
  },
  choiceGroupError: {
    borderWidth: 2,
    borderColor: COLORS.danger,
    padding: 6,
  },
  genderChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },
  genderChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  genderChipTextSelected: {
    color: COLORS.white,
  },
});