import type { AuthUser } from '../context/AuthContext';
import type { RiderProfile } from '../types/rider';
import { getProfileHandler } from './handlers';
import type { ProfileAttributeDefinition, ProfileDefinitions, ProfileDraftValues, ProfileFieldDefinition, ProfileLovDefinition } from './types';

const INDIA_LOV_VALUE = 'IN';

function toFormValue(definition: ProfileFieldDefinition, value: unknown): unknown {
  if (value === undefined || value === null) {
    if (definition.type === 'GROUP' && definition.fields?.length) {
      const defaults = Object.fromEntries(
        definition.fields
          .map((field) => [field.key, getDefaultFieldValue(field)])
          .filter(([, fieldValue]) => fieldValue !== undefined),
      );
      return Object.keys(defaults).length > 0 ? defaults : undefined;
    }

    return getDefaultFieldValue(definition);
  }

  if (definition.type === 'NUMBER') {
    return typeof value === 'number' ? String(value) : value;
  }

  if (definition.type === 'GROUP' && definition.fields?.length) {
    const objectValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    return Object.fromEntries(definition.fields.map((field) => [field.key, toFormValue(field, objectValue[field.key])])) as Record<string, unknown>;
  }

  return value;
}

export function getDefaultFieldValue(definition: ProfileFieldDefinition): unknown {
  if (definition.type === 'SELECT' && definition.lovId === 'COUNTRY') {
    return INDIA_LOV_VALUE;
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
        .map((field) => [field.key, getDefaultFieldValue(field)])
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
  return Object.fromEntries(
    definitions.orderedAttributes.map((attribute) => {
      const rawValue = getEditableAttributeValue(profile, attribute, user);
      return [attribute.key, toFormValue(attribute, rawValue)];
    }),
  );
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
        const match = lov?.items.find((entry) => entry.value === item);
        return match?.label ?? String(item);
      })
      .join(', ');
  }

  if (attribute.type === 'SELECT' && typeof value === 'string') {
    const lov = attribute.lovId ? definitions.lovsById[attribute.lovId] : undefined;
    return lov?.items.find((item) => item.value === value)?.label ?? value;
  }

  if (attribute.type === 'BOOLEAN') {
    return value ? 'Yes' : 'No';
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
          return definitions.lovsById[field.lovId]?.items.find((item) => item.value === childValue)?.label ?? childValue;
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

  if (handler.readOnly && !isCreate && !handler.allowCreatePayload) {
    return false;
  }

  return true;
}
