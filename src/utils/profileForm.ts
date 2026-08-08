import { countries, type TCountryCode } from 'countries-list';
import indiaStates from '../config/indiaStates.json';

import type { RiderProfile } from '../types/rider';
import { isNotEmpty, isValidPhone } from './validation';

export type GenderOption = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export type ProfileFormField =
  | 'name'
  | 'phone'
  | 'dateOfBirth'
  | 'gender'
  | 'addressLine1'
  | 'city'
  | 'state'
  | 'country'
  | 'postalCode'
  | 'emergencyContactName'
  | 'emergencyContactRelationship'
  | 'emergencyContactPhone'
  | 'photo';

export type ProfileFormErrors = Partial<Record<ProfileFormField, true>>;

export interface CountryOption {
  code: TCountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

export interface ProfileFormValues {
  name: string;
  phoneCountryCode: TCountryCode;
  phoneCallingCode: string;
  phoneNumber: string;
  dateOfBirth: Date | null;
  gender: GenderOption | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  countryCode: TCountryCode;
  country: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyPhoneCountryCode: TCountryCode;
  emergencyPhoneCallingCode: string;
  emergencyContactPhone: string;
}

export const GENDER_OPTIONS: GenderOption[] = ['Male', 'Female', 'Other', 'Prefer not to say'];

export const INDIA_STATES = indiaStates as readonly string[];

function countryFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}

export const COUNTRY_OPTIONS: CountryOption[] = Object.entries(countries)
  .map(([code, country]) => ({
    code: code as TCountryCode,
    name: country.name,
    callingCode: String(country.phone[0] ?? ''),
    flag: countryFlag(code),
  }))
  .filter((country) => country.callingCode.length > 0)
  .sort((first, second) => first.name.localeCompare(second.name));

const INDIA = COUNTRY_OPTIONS.find((country) => country.code === 'IN') as CountryOption;

export function combinePhoneNumber(callingCode: string, phoneNumber: string): string {
  return `+${callingCode.replace(/\D/g, '')}${phoneNumber.replace(/\D/g, '')}`;
}

export function splitPhoneNumber(phone?: string): {
  countryCode: TCountryCode;
  callingCode: string;
  phoneNumber: string;
} {
  const digits = phone?.replace(/\D/g, '') ?? '';
  const matchingCountry = phone?.trim().startsWith('+')
    ? [...COUNTRY_OPTIONS]
      .sort((first, second) => second.callingCode.length - first.callingCode.length)
      .find((country) => digits.startsWith(country.callingCode))
    : undefined;
  const country = matchingCountry ?? INDIA;

  return {
    countryCode: country.code,
    callingCode: country.callingCode,
    phoneNumber: matchingCountry ? digits.slice(country.callingCode.length) : digits,
  };
}

function toDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createProfileFormValues(profile?: RiderProfile | null): ProfileFormValues {
  const phone = splitPhoneNumber(profile?.phone);
  const emergencyPhone = splitPhoneNumber(profile?.emergencyContact?.phone);
  const selectedCountry = COUNTRY_OPTIONS.find((option) => option.name === profile?.address?.country) ?? INDIA;

  return {
    name: profile?.name ?? '',
    phoneCountryCode: phone.countryCode,
    phoneCallingCode: phone.callingCode,
    phoneNumber: phone.phoneNumber,
    dateOfBirth: toDate(profile?.dateOfBirth),
    gender: (profile?.gender as GenderOption | undefined) ?? null,
    addressLine1: profile?.address?.line1 ?? '',
    addressLine2: profile?.address?.line2 ?? '',
    city: profile?.address?.city ?? '',
    state: profile?.address?.state ?? '',
    countryCode: selectedCountry.code,
    country: selectedCountry.name,
    postalCode: profile?.address?.postalCode ?? '',
    emergencyContactName: profile?.emergencyContact?.name ?? '',
    emergencyContactRelationship: profile?.emergencyContact?.relation ?? '',
    emergencyPhoneCountryCode: emergencyPhone.countryCode,
    emergencyPhoneCallingCode: emergencyPhone.callingCode,
    emergencyContactPhone: emergencyPhone.phoneNumber,
  };
}

function isValidLocalPhone(callingCode: string, phoneNumber: string): boolean {
  const localDigits = phoneNumber.replace(/\D/g, '');
  return localDigits.length >= 6
    && localDigits.length <= 15
    && isValidPhone(combinePhoneNumber(callingCode, phoneNumber));
}

export function validateProfileForm(values: ProfileFormValues, hasPhoto: boolean): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  if (!isNotEmpty(values.name)) errors.name = true;
  if (!isValidLocalPhone(values.phoneCallingCode, values.phoneNumber)) errors.phone = true;
  if (!values.dateOfBirth) errors.dateOfBirth = true;
  if (!values.gender) errors.gender = true;
  if (!isNotEmpty(values.addressLine1)) errors.addressLine1 = true;
  if (!isNotEmpty(values.city)) errors.city = true;
  if (!isNotEmpty(values.state)) errors.state = true;
  if (!isNotEmpty(values.country)) errors.country = true;
  if (!isNotEmpty(values.postalCode)) errors.postalCode = true;
  if (!isNotEmpty(values.emergencyContactName)) errors.emergencyContactName = true;
  if (!isNotEmpty(values.emergencyContactRelationship)) errors.emergencyContactRelationship = true;
  if (!isValidLocalPhone(values.emergencyPhoneCallingCode, values.emergencyContactPhone)) {
    errors.emergencyContactPhone = true;
  }

  return errors;
}