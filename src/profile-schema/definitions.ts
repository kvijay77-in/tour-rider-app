import type {
  AppConfigEntry,
  ProfileAttributeDefinition,
  ProfileDefinitions,
  ProfileFieldDefinition,
  ProfileLovDefinition,
  ProfileLovItem,
  ProfileSectionConfig,
  ProfileSectionWithAttributes,
} from './types';
import {
  PROFILE_ATTRIBUTE_CONFIG_TYPE,
  PROFILE_LOV_CONFIG_TYPE,
  PROFILE_SECTION_CONFIG_TYPE,
} from './types';

function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

function normalizeFieldDefinition(key: string, config: Record<string, unknown>): ProfileFieldDefinition {
  const fields = Array.isArray(config.fields)
    ? config.fields
      .filter((field): field is Record<string, unknown> => Boolean(field && typeof field === 'object'))
      .map((field) => normalizeFieldDefinition(String(field.key ?? ''), field))
      .filter((field) => field.key)
    : undefined;

  return {
    key,
    label: String(config.label ?? key),
    ...(typeof config.helpText === 'string' ? { helpText: config.helpText } : {}),
    ...(typeof config.placeholder === 'string' ? { placeholder: config.placeholder } : {}),
    type: String(config.type ?? 'TEXT') as ProfileFieldDefinition['type'],
    ...(typeof config.lovId === 'string' ? { lovId: config.lovId } : {}),
    ...(config.validation && typeof config.validation === 'object'
      ? { validation: config.validation as ProfileFieldDefinition['validation'] }
      : {}),
    ...(config.visibleWhen && typeof config.visibleWhen === 'object'
      ? { visibleWhen: config.visibleWhen as ProfileFieldDefinition['visibleWhen'] }
      : {}),
    ...(typeof config.dependsOn === 'string' ? { dependsOn: config.dependsOn } : {}),
    ...(typeof config.fallbackToText === 'boolean' ? { fallbackToText: config.fallbackToText } : {}),
    ...(fields?.length ? { fields } : {}),
    ...(typeof config.repeatable === 'boolean' ? { repeatable: config.repeatable } : {}),
    ...(typeof config.maxItems === 'number' ? { maxItems: config.maxItems } : {}),
    ...(typeof config.required === 'boolean' ? { required: config.required } : {}),
    ...(typeof config.handler === 'string' ? { handler: config.handler } : {}),
    ...(config.handlerOptions && typeof config.handlerOptions === 'object'
      ? { handlerOptions: config.handlerOptions as Record<string, unknown> }
      : {}),
  };
}

function toAttributeDefinition(entry: AppConfigEntry<Record<string, unknown>>): ProfileAttributeDefinition | null {
  if (!entry.enabled) {
    return null;
  }

  const config = entry.config;
  if (!config || typeof config !== 'object') {
    return null;
  }

  const base = normalizeFieldDefinition(entry.configId, config);
  const storage = config.storage && typeof config.storage === 'object'
    ? config.storage as ProfileAttributeDefinition['storage']
    : { scope: 'ATTRIBUTES' as const };

  return {
    ...base,
    sectionId: String(config.sectionId ?? ''),
    order: Number(config.order ?? 0),
    storage,
    required: Boolean(config.required),
    adminOnly: Boolean(config.adminOnly),
    sensitive: Boolean(config.sensitive),
    visibleToAllMgmtUsers: Boolean(config.visibleToAllMgmtUsers),
    system: Boolean(config.system),
  };
}

function toSection(entry: AppConfigEntry<ProfileSectionConfig>) {
  if (!entry.enabled) {
    return null;
  }

  return {
    id: entry.configId,
    label: String(entry.config?.label ?? entry.configId),
    ...(typeof entry.config?.icon === 'string' ? { icon: entry.config.icon } : {}),
    order: Number(entry.config?.order ?? 0),
    ...(typeof entry.config?.description === 'string' ? { description: entry.config.description } : {}),
  };
}

function toLov(entry: AppConfigEntry<Record<string, unknown>>): ProfileLovDefinition | null {
  if (!entry.enabled) {
    return null;
  }

  const config = entry.config;
  if (!config || typeof config !== 'object') {
    return null;
  }

  const items = Array.isArray(config.items)
    ? sortByOrder(
      config.items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          value: String(item.value ?? ''),
          label: String(item.label ?? item.value ?? ''),
          order: Number(item.order ?? 0),
          enabled: item.enabled !== false,
          ...(typeof item.parent === 'string' ? { parent: item.parent } : {}),
          ...(item.meta && typeof item.meta === 'object' ? { meta: item.meta as Record<string, unknown> } : {}),
        }))
        .filter((item): item is ProfileLovItem => item.enabled && item.value.length > 0),
    )
    : [];

  return {
    id: entry.configId,
    label: String(config.label ?? entry.configId),
    ...(typeof config.parentLovId === 'string' ? { parentLovId: config.parentLovId } : {}),
    items,
  };
}

function buildDefinitionsVersion(entries: AppConfigEntry[]): string {
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => `${entry.configType}:${entry.configId}:${String(entry.version)}`)
    .sort((first, second) => first.localeCompare(second))
    .join('|');
}

export function buildProfileDefinitions(entries: AppConfigEntry[]): ProfileDefinitions {
  const relevantEntries = entries.filter((entry) => (
    entry.configType === PROFILE_SECTION_CONFIG_TYPE
    || entry.configType === PROFILE_ATTRIBUTE_CONFIG_TYPE
    || entry.configType === PROFILE_LOV_CONFIG_TYPE
  ));

  const sections = relevantEntries
    .filter((entry): entry is AppConfigEntry<ProfileSectionConfig> => entry.configType === PROFILE_SECTION_CONFIG_TYPE)
    .map((entry) => toSection(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));

  const attributeDefinitions = relevantEntries
    .filter((entry): entry is AppConfigEntry<Record<string, unknown>> => entry.configType === PROFILE_ATTRIBUTE_CONFIG_TYPE)
    .map((entry) => toAttributeDefinition(entry))
    .filter((entry): entry is ProfileAttributeDefinition => Boolean(entry));

  const orderedAttributes = sortByOrder(
    attributeDefinitions.filter((entry) => Boolean(entry.sectionId) && Boolean(sectionMap[entry.sectionId])),
  );

  const sectionsWithAttributes: ProfileSectionWithAttributes[] = sortByOrder(sections)
    .map((section) => ({
      ...section,
      attributes: orderedAttributes
        .filter((attribute) => attribute.sectionId === section.id)
        .sort((first, second) => first.order - second.order),
    }))
    .filter((section) => section.attributes.length > 0);

  const lovs = relevantEntries
    .filter((entry): entry is AppConfigEntry<Record<string, unknown>> => entry.configType === PROFILE_LOV_CONFIG_TYPE)
    .map((entry) => toLov(entry))
    .filter((entry): entry is ProfileLovDefinition => Boolean(entry));

  return {
    definitionsVersion: buildDefinitionsVersion(relevantEntries),
    sections: sectionsWithAttributes,
    orderedAttributes,
    attributesByKey: Object.fromEntries(orderedAttributes.map((attribute) => [attribute.key, attribute])),
    lovsById: Object.fromEntries(lovs.map((lov) => [lov.id, lov])),
    rawEntries: relevantEntries,
  };
}
