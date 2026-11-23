import type { ProfileAttributeDefinition, ProfileDefinitions, ProfileDraftValues, ProfileFieldDefinition, ProfileValidationErrors } from './types';
import { getLovItems } from './bindings';
import { getProfileHandler, isAttributeReadOnlyForRider } from './handlers';
import { evaluateVisibleWhen } from './visibility';

function isEmptyValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return value === undefined || value === null;
}

function isPhoneValue(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return /^\+\d{6,15}$/.test(`+${digits}`);
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDateValue(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }

  const normalized = value.trim();
  const [yearString, monthString, dayString] = normalized.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

function resolveRelativeDate(reference: Date, input: string): string | null {
  const match = input.match(/^(-?\d+)([dmy])$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const date = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
  ));

  if (unit === 'd') {
    date.setUTCDate(date.getUTCDate() + amount);
  } else if (unit === 'm') {
    date.setUTCMonth(date.getUTCMonth() + amount);
  } else if (unit === 'y') {
    date.setUTCFullYear(date.getUTCFullYear() + amount);
  }

  return date.toISOString().split('T')[0] ?? null;
}

function compareDateValues(first: string, second: string): number {
  return first.localeCompare(second);
}

function validateFieldValue(
  definition: ProfileFieldDefinition,
  value: unknown,
  definitions: ProfileDefinitions,
  currentValues: ProfileDraftValues,
  path: string,
  errors: ProfileValidationErrors,
): void {
  const isRequired = Boolean(definition.required);

  if (definition.type === 'GROUP') {
    const objectValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const visibleFields = definition.fields?.filter((field) => evaluateVisibleWhen(field.visibleWhen, objectValue)) ?? [];
    const hasGroupContent = visibleFields.some((field) => !isEmptyValue(objectValue[field.key]));
    const hasRequiredVisibleChildren = visibleFields.some((field) => Boolean(field.required));

    if (isRequired && !hasGroupContent && !hasRequiredVisibleChildren) {
      errors[path] = `${definition.label} is required.`;
      return;
    }

    for (const field of visibleFields) {
      const childPath = `${path}.${field.key}`;
      validateFieldValue(field, objectValue[field.key], definitions, objectValue, childPath, errors);
    }

    return;
  }

  if (isRequired && isEmptyValue(value)) {
    errors[path] = `${definition.label} is required.`;
    return;
  }

  if (isEmptyValue(value) && definition.type !== 'MULTI_SELECT') {
    return;
  }

  switch (definition.type) {
    case 'TEXT':
    case 'TEXTAREA': {
      const stringValue = String(value).trim();
      const minLength = definition.validation?.minLength;
      const maxLength = definition.validation?.maxLength;
      const pattern = definition.validation?.pattern;
      if (typeof minLength === 'number' && stringValue.length < minLength) {
        errors[path] = `${definition.label} must be at least ${minLength} characters.`;
        return;
      }
      if (typeof maxLength === 'number' && stringValue.length > maxLength) {
        errors[path] = `${definition.label} must be ${maxLength} characters or fewer.`;
        return;
      }
      if (pattern && !(new RegExp(pattern).test(stringValue))) {
        errors[path] = `${definition.label} format is invalid.`;
      }
      return;
    }
    case 'EMAIL': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
        errors[path] = 'Enter a valid email address.';
      }
      return;
    }
    case 'PHONE': {
      if (!isPhoneValue(String(value))) {
        errors[path] = 'Enter a valid phone number.';
      }
      return;
    }
    case 'URL': {
      try {
        new URL(String(value));
      } catch {
        errors[path] = 'Enter a valid URL.';
      }
      return;
    }
    case 'NUMBER': {
      const numberValue = parseNumberValue(value);
      if (numberValue === null) {
        errors[path] = `${definition.label} must be a valid number.`;
        return;
      }
      if (typeof definition.validation?.min === 'number' && numberValue < definition.validation.min) {
        errors[path] = `${definition.label} must be at least ${definition.validation.min}.`;
        return;
      }
      if (typeof definition.validation?.max === 'number' && numberValue > definition.validation.max) {
        errors[path] = `${definition.label} must be ${definition.validation.max} or less.`;
        return;
      }
      if (typeof definition.validation?.decimals === 'number') {
        const fraction = String(value).split('.')[1] ?? '';
        if (fraction.length > definition.validation.decimals) {
          errors[path] = `${definition.label} must have no more than ${definition.validation.decimals} decimal places.`;
        }
      }
      return;
    }
    case 'DATE': {
      const normalizedDate = normalizeDateValue(value);
      if (!normalizedDate) {
        errors[path] = `${definition.label} must be in YYYY-MM-DD format.`;
        return;
      }

      const today = new Date();
      const minDate = definition.validation?.minDate?.startsWith('-') || definition.validation?.minDate?.startsWith('+')
        ? resolveRelativeDate(today, definition.validation.minDate)
        : definition.validation?.minDate ?? null;
      const maxDate = definition.validation?.maxDate?.startsWith('-') || definition.validation?.maxDate?.startsWith('+')
        ? resolveRelativeDate(today, definition.validation.maxDate)
        : definition.validation?.maxDate ?? null;

      if (minDate && compareDateValues(normalizedDate, minDate) < 0) {
        errors[path] = `${definition.label} must be on or after ${minDate}.`;
        return;
      }
      if (maxDate && compareDateValues(normalizedDate, maxDate) > 0) {
        errors[path] = `${definition.label} must be on or before ${maxDate}.`;
      }
      return;
    }
    case 'SELECT': {
      if (typeof value !== 'string') {
        errors[path] = `${definition.label} must be selected.`;
        return;
      }
      const lov = definition.lovId ? definitions.lovsById[definition.lovId] : undefined;
      const parentValue = definition.dependsOn ? currentValues[definition.dependsOn] : undefined;
      const options = getLovItems(lov, typeof parentValue === 'string' ? parentValue : undefined);
      if (definition.fallbackToText && options.length === 0) {
        return;
      }
      if (options.length > 0 && !options.some((item) => item.value === value)) {
        errors[path] = `${definition.label} must be selected from the list.`;
      }
      return;
    }
    case 'MULTI_SELECT': {
      if (!Array.isArray(value)) {
        errors[path] = `${definition.label} must be a list.`;
        return;
      }
      if (typeof definition.validation?.minItems === 'number' && value.length < definition.validation.minItems) {
        errors[path] = `Select at least ${definition.validation.minItems} option(s) for ${definition.label}.`;
        return;
      }
      if (typeof definition.validation?.maxItems === 'number' && value.length > definition.validation.maxItems) {
        errors[path] = `Select no more than ${definition.validation.maxItems} option(s) for ${definition.label}.`;
      }
      return;
    }
    case 'BOOLEAN':
      return;
    case 'FILE':
    case 'IMAGE': {
      if (!value || typeof value !== 'object') {
        errors[path] = `${definition.label} file information is invalid.`;
        return;
      }
      const fileValue = value as Record<string, unknown>;
      const sizeBytes = typeof fileValue.sizeBytes === 'number' ? fileValue.sizeBytes : undefined;
      const contentType = typeof fileValue.contentType === 'string' ? fileValue.contentType : undefined;
      if (typeof definition.validation?.maxFileSizeBytes === 'number' && sizeBytes && sizeBytes > definition.validation.maxFileSizeBytes) {
        errors[path] = `${definition.label} must be ${definition.validation.maxFileSizeBytes} bytes or smaller.`;
        return;
      }
      if (definition.validation?.allowedMimeTypes?.length && contentType && !definition.validation.allowedMimeTypes.includes(contentType)) {
        errors[path] = `${definition.label} type is not supported.`;
      }
      return;
    }
    default:
      return;
  }
}

export function validateProfileDraftValues(
  definitions: ProfileDefinitions,
  values: ProfileDraftValues,
  options: { skipReadOnly?: boolean; excludedKeys?: string[] } = {},
): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};
  const excludedKeys = new Set(options.excludedKeys);

  for (const attribute of definitions.orderedAttributes) {
    // Attributes that are not shown in the form cannot be edited, so they are not validated.
    if (excludedKeys.has(attribute.key)) {
      continue;
    }

    if (!evaluateVisibleWhen(attribute.visibleWhen, values)) {
      continue;
    }

    if (options.skipReadOnly && isAttributeReadOnlyForRider(attribute)) {
      continue;
    }

    // Handler-managed attributes that never go into the save payload (e.g. PROFILE_PHOTO) hold a
    // stored reference such as an S3 key rather than form data. The screens validate them directly.
    if (getProfileHandler(attribute).omitFromPayload) {
      continue;
    }

    validateFieldValue(attribute, values[attribute.key], definitions, values, attribute.key, errors);
  }

  return errors;
}

export function hasRequiredSystemProfileValues(
  definitions: ProfileDefinitions | null,
  values: ProfileDraftValues,
): boolean {
  if (!definitions) {
    return false;
  }

  return definitions.orderedAttributes
    .filter((attribute) => attribute.system && attribute.required)
    .every((attribute) => !isEmptyValue(values[attribute.key]));
}

export function getVisibleEditableAttributes(
  definitions: ProfileDefinitions,
  values: ProfileDraftValues,
): ProfileAttributeDefinition[] {
  return definitions.orderedAttributes.filter((attribute) => {
    if (!evaluateVisibleWhen(attribute.visibleWhen, values)) {
      return false;
    }

    return !isAttributeReadOnlyForRider(attribute);
  });
}
