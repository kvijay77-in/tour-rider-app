import type { RiderProfile } from '../types/rider';
import { getAttributeValue, shouldIncludeAttributeInPayload } from './bindings';
import type { ProfileDefinitions, ProfileDraftValues, ProfileFieldDefinition } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeValue(definition: ProfileFieldDefinition, value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  switch (definition.type) {
    case 'TEXT':
    case 'TEXTAREA':
    case 'EMAIL':
    case 'PHONE':
    case 'URL':
    case 'DATE':
    case 'SELECT':
      return normalizeString(value);
    case 'NUMBER': {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
      }
      const stringValue = normalizeString(value);
      if (!stringValue) {
        return undefined;
      }
      const parsed = Number(stringValue);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? value : undefined;
    case 'MULTI_SELECT':
      return Array.isArray(value)
        ? value.map((entry) => normalizeString(entry)).filter((entry): entry is string => Boolean(entry))
        : undefined;
    case 'FILE':
    case 'IMAGE': {
      if (!isPlainObject(value)) {
        return undefined;
      }

      const s3Key = normalizeString(value.s3Key);
      if (!s3Key) {
        return undefined;
      }

      return {
        s3Key,
        ...(normalizeString(value.fileName) ? { fileName: normalizeString(value.fileName) } : {}),
        ...(normalizeString(value.contentType) ? { contentType: normalizeString(value.contentType) } : {}),
        ...(typeof value.sizeBytes === 'number' && Number.isFinite(value.sizeBytes) ? { sizeBytes: value.sizeBytes } : {}),
        ...(normalizeString(value.uploadedAt) ? { uploadedAt: normalizeString(value.uploadedAt) } : {}),
      };
    }
    case 'GROUP': {
      if (definition.repeatable) {
        if (!Array.isArray(value)) {
          return undefined;
        }

        const list = value
          .map((entry) => sanitizeGroupValue(definition, entry))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry));
        return list.length > 0 ? list : undefined;
      }

      return sanitizeGroupValue(definition, value);
    }
    default:
      return value;
  }
}

function getClearedValue(definition: ProfileFieldDefinition): unknown {
  if (definition.type === 'MULTI_SELECT') {
    return [];
  }

  if (definition.type === 'GROUP' && definition.repeatable) {
    return [];
  }

  return null;
}

function sanitizeGroupValue(
  definition: ProfileFieldDefinition,
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isPlainObject(value) || !definition.fields?.length) {
    return undefined;
  }

  const sanitizedEntries = definition.fields
    .map((field) => [field.key, sanitizeValue(field, value[field.key])] as const)
    .filter(([, entryValue]) => entryValue !== undefined && !(Array.isArray(entryValue) && entryValue.length === 0));

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

function areValuesEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export interface BuildProfileSavePayloadOptions {
  profile: RiderProfile | null;
  definitions: ProfileDefinitions;
  values: ProfileDraftValues;
}

export function buildProfileSavePayload({
  profile,
  definitions,
  values,
}: BuildProfileSavePayloadOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    definitionsVersion: definitions.definitionsVersion,
  };
  const attributeUpdates: Record<string, unknown> = {};
  const isCreate = !profile;

  for (const attribute of definitions.orderedAttributes) {
    if (!shouldIncludeAttributeInPayload(attribute, isCreate)) {
      continue;
    }

    const sanitizedValue = sanitizeValue(attribute, values[attribute.key]);
    const currentValue = sanitizeValue(attribute, getAttributeValue(profile, attribute));

    if (sanitizedValue === undefined) {
      if (!isCreate && currentValue !== undefined) {
        const clearedValue = getClearedValue(attribute);
        if (!areValuesEqual(clearedValue, currentValue)) {
          if (attribute.storage.scope === 'CORE' && attribute.storage.path) {
            payload[attribute.storage.path] = clearedValue;
          } else {
            attributeUpdates[attribute.key] = clearedValue;
          }
        }
      }
      continue;
    }

    if (areValuesEqual(sanitizedValue, currentValue)) {
      continue;
    }

    if (attribute.storage.scope === 'CORE' && attribute.storage.path) {
      payload[attribute.storage.path] = sanitizedValue;
    } else {
      attributeUpdates[attribute.key] = sanitizedValue;
    }
  }

  if (Object.keys(attributeUpdates).length > 0) {
    payload.attributes = attributeUpdates;
  }

  return payload;
}
