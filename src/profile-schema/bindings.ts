import type { AuthUser } from '../context/AuthContext';
import type { RiderProfile } from '../types/rider';
import { getProfileHandler } from './handlers';
import type { ProfileAttributeDefinition, ProfileDefinitions, ProfileDraftValues, ProfileFieldDefinition, ProfileLovDefinition } from './types';

function normalizeLovMatchValue(value: string): string {
  return value.trim().toLowerCase();
}

function findLovItemByStoredValue(
  lov: ProfileLovDefinition | undefined,
  value: string,
  parentValue?: string,
) {
  const normalizedValue = normalizeLovMatchValue(value);
  const options = getLovItems(lov, parentValue);

  return options.find((item) => (
    normalizeLovMatchValue(item.value) === normalizedValue
    || normalizeLovMatchValue(item.label) === normalizedValue
  ));
}

function toFormValue(
  definition: ProfileFieldDefinition,
  value: unknown,
  definitions: ProfileDefinitions,
  currentValues: ProfileDraftValues = {},
): unknown {
  if (value === undefined || value === null) {
    if (definition.type === 'GROUP' && definition.fields?.length) {
      const defaults: Record<string, unknown> = {};
      for (const field of definition.fields) {
        const fieldValue = getDefaultFieldValue(field, definitions);
        if (fieldValue !== undefined) {
          defaults[field.key] = fieldValue;
        }
      }
      return Object.keys(defaults).length > 0 ? defaults : undefined;
    }

    return getDefaultFieldValue(definition, definitions);
  }

  if (definition.type === 'NUMBER') {
    return typeof value === 'number' ? String(value) : value;
  }

  if (definition.type === 'GROUP' && definition.fields?.length) {
    const objectValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const nextValue: Record<string, unknown> = {};
    for (const field of definition.fields) {
      const fieldCurrentValues = { ...objectValue, ...nextValue };
      nextValue[field.key] = toFormValue(field, objectValue[field.key], definitions, fieldCurrentValues);
    }
    return nextValue;
  }

  if (definition.type === 'SELECT' && typeof value === 'string') {
    const lov = definition.lovId ? definitions.lovsById[definition.lovId] : undefined;
    const parentValue = definition.dependsOn && typeof currentValues[definition.dependsOn] === 'string'
      ? currentValues[definition.dependsOn] as string
      : undefined;
    return findLovItemByStoredValue(lov, value, parentValue)?.value ?? value;
  }

  if (definition.type === 'MULTI_SELECT' && Array.isArray(value)) {
    const lov = definition.lovId ? definitions.lovsById[definition.lovId] : undefined;
    return value.map((entry) => (
      typeof entry === 'string'
        ? (findLovItemByStoredValue(lov, entry)?.value ?? entry)
        : entry
    ));
  }

  return value;
}

export function getDefaultFieldValue(
  definition: ProfileFieldDefinition,
  definitions?: ProfileDefinitions,
): unknown {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }

  if (definition.type === 'SELECT' && definition.lovId === 'COUNTRY') {
    return getLovItems(definitions?.lovsById.COUNTRY)[0]?.value;
  }

  if (definition.type === 'MULTI_SELECT') {
    return [];
  }

  if (definition.type === 'BOOLEAN') {
    return false;
  }

  if (definition.type === 'GROUP' && definition.fields?.length) {
    const defaults = Object.fromEntries(
      definition.fields
        .map((field) => [field.key, getDefaultFieldValue(field, definitions)])
        .filter(([, value]) => value !== undefined),
    );
    return Object.keys(defaults).length > 0 ? defaults : undefined;
  }

  return undefined;
}

export function getProfileCoreValue(profile: RiderProfile | null | undefined, path?: string): unknown {
  if (!profile || !path) {
    return undefined;
  }

  return (profile as unknown as Record<string, unknown>)[path];
}

export function getAttributeValue(
  profile: RiderProfile | null | undefined,
  attribute: ProfileAttributeDefinition,
): unknown {
  if (!profile) {
    return undefined;
  }

  if (attribute.storage.scope === 'CORE') {
    return getProfileCoreValue(profile, attribute.storage.path);
  }

  return profile.attributes?.[attribute.key];
}

export function getEditableAttributeValue(
  profile: RiderProfile | null | undefined,
  attribute: ProfileAttributeDefinition,
  user: AuthUser | null,
): unknown {
  if (attribute.handler === 'COGNITO_EMAIL') {
    return user?.email ?? getAttributeValue(profile, attribute);
  }

  return getAttributeValue(profile, attribute);
}

export function createProfileDraftValues(
  profile: RiderProfile | null | undefined,
  definitions: ProfileDefinitions,
  user: AuthUser | null,
): ProfileDraftValues {
  const draftValues: ProfileDraftValues = {};

  for (const attribute of definitions.orderedAttributes) {
    const rawValue = getEditableAttributeValue(profile, attribute, user);
    draftValues[attribute.key] = toFormValue(attribute, rawValue, definitions, draftValues);
  }

  return draftValues;
}

export function mergeDraftValuesWithDefinitions(
  existingValues: ProfileDraftValues,
  profile: RiderProfile | null | undefined,
  definitions: ProfileDefinitions,
  user: AuthUser | null,
): ProfileDraftValues {
  const freshValues = createProfileDraftValues(profile, definitions, user);

  return Object.fromEntries(
    definitions.orderedAttributes.map((attribute) => {
      const preservedValue = existingValues[attribute.key];
      return [attribute.key, preservedValue !== undefined ? preservedValue : freshValues[attribute.key]];
    }),
  );
}

export function getLovItems(
  lov: ProfileLovDefinition | undefined,
  parentValue?: string,
): ProfileLovDefinition['items'] {
  if (!lov) {
    return [];
  }

  if (!lov.parentLovId || !parentValue) {
    return lov.items;
  }

  return lov.items.filter((item) => item.parent === parentValue);
}

export function getAttributeDisplayValue(
  attribute: ProfileAttributeDefinition,
  value: unknown,
  definitions: ProfileDefinitions,
): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  if (attribute.type === 'MULTI_SELECT' && Array.isArray(value)) {
    const lov = attribute.lovId ? definitions.lovsById[attribute.lovId] : undefined;
    return value
      .map((item) => {
        const match = typeof item === 'string' ? findLovItemByStoredValue(lov, item) : undefined;
        return match?.label ?? String(item);
      })
      .join(', ');
  }

  if (attribute.type === 'SELECT' && typeof value === 'string') {
    const lov = attribute.lovId ? definitions.lovsById[attribute.lovId] : undefined;
    return findLovItemByStoredValue(lov, value)?.label ?? value;
  }

  if (attribute.type === 'BOOLEAN') {
    return value ? 'Yes' : 'No';
  }

  if ((attribute.type === 'FILE' || attribute.type === 'IMAGE') && value && typeof value === 'object') {
    const fileValue = value as Record<string, unknown>;
    return typeof fileValue.fileName === 'string' && fileValue.fileName.trim().length > 0
      ? fileValue.fileName
      : 'Uploaded file';
  }

  if (attribute.type === 'GROUP' && value && typeof value === 'object' && attribute.fields?.length) {
    const objectValue = value as Record<string, unknown>;
    const segments = attribute.fields
      .map((field) => {
        const childValue = objectValue[field.key];
        if (childValue === undefined || childValue === null || childValue === '') {
          return null;
        }

        if (field.type === 'SELECT' && typeof childValue === 'string' && field.lovId) {
          const parentValue = field.dependsOn && typeof objectValue[field.dependsOn] === 'string'
            ? objectValue[field.dependsOn] as string
            : undefined;
          return findLovItemByStoredValue(definitions.lovsById[field.lovId], childValue, parentValue)?.label ?? childValue;
        }

        return String(childValue);
      })
      .filter((item): item is string => Boolean(item));

    return segments.length > 0 ? segments.join(', ') : '—';
  }

  return String(value);
}

export function shouldIncludeAttributeInPayload(
  attribute: ProfileAttributeDefinition,
  isCreate: boolean,
): boolean {
  if (attribute.adminOnly) {
    return false;
  }

  const handler = getProfileHandler(attribute);
  if (handler.omitFromPayload) {
    return false;
  }

  if (handler.readOnly && (!isCreate || !handler.allowCreatePayload)) {
    return false;
  }

  return true;
}
