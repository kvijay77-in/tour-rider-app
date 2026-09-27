import { countries, type TCountryCode } from 'countries-list';
import indiaStates from '../config/indiaStates.json';

export interface CountryOption {
  code: TCountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

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

export const INDIA_COUNTRY = COUNTRY_OPTIONS.find((country) => country.code === 'IN') as CountryOption;
export const INDIA_STATES = indiaStates as readonly string[];

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
  const country = matchingCountry ?? INDIA_COUNTRY;

  return {
    countryCode: country.code,
    callingCode: country.callingCode,
    phoneNumber: matchingCountry ? digits.slice(country.callingCode.length) : digits,
  };
}
