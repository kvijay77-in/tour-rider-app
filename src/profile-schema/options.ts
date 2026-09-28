import { countries, type TCountryCode } from 'countries-list';
import indiaStates from '../config/indiaStates.json';
import type { ProfileDefinitions } from './types';

export interface CountryOption {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

function countryFlag(countryCode: string): string {
  if (countryCode.length !== 2) {
    return '';
  }

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

export function getPhoneCountryOptions(definitions?: ProfileDefinitions): CountryOption[] {
  const configuredCountries = definitions?.lovsById.COUNTRY?.items
    .map((item) => {
      const callingCode = typeof item.meta?.callingCode === 'string' ? item.meta.callingCode.replace(/\D/g, '') : '';
      if (!callingCode) {
        return null;
      }

      return {
        code: item.value,
        name: item.label,
        callingCode,
        flag: countryFlag(item.value),
      } satisfies CountryOption;
    })
    .filter((item): item is CountryOption => Boolean(item));

  return configuredCountries?.length ? configuredCountries : COUNTRY_OPTIONS;
}

export function splitPhoneNumber(
  phone: string | undefined,
  countryOptions: CountryOption[] = COUNTRY_OPTIONS,
): {
  countryCode: string;
  callingCode: string;
  phoneNumber: string;
} {
  const digits = phone?.replace(/\D/g, '') ?? '';
  const matchingCountry = phone?.trim().startsWith('+')
    ? [...countryOptions]
      .sort((first, second) => second.callingCode.length - first.callingCode.length)
      .find((country) => digits.startsWith(country.callingCode))
    : undefined;
  const country = matchingCountry ?? countryOptions[0] ?? INDIA_COUNTRY;

  return {
    countryCode: country.code,
    callingCode: country.callingCode,
    phoneNumber: matchingCountry ? digits.slice(country.callingCode.length) : digits,
  };
}
