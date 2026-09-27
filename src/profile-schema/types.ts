export const PROFILE_SECTION_CONFIG_TYPE = 'RIDER_PROFILE_SECTION';
export const PROFILE_ATTRIBUTE_CONFIG_TYPE = 'RIDER_PROFILE_ATTRIBUTE';
export const PROFILE_LOV_CONFIG_TYPE = 'LOV';

export const PROFILE_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'URL',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'FILE',
  'IMAGE',
  'GROUP',
] as const;

export type ProfileFieldType = typeof PROFILE_FIELD_TYPES[number];
export type VisibleWhenOperator = 'EQ' | 'NEQ' | 'IN' | 'NOT_EMPTY';
export type RiderProfileCorePath =
  | 'name'
  | 'phone'
  | 'address'
  | 'emergencyContact'
  | 'photoS3Key'
  | 'personalCode'
  | 'email'
  | 'dateOfBirth'
  | 'gender';

export interface AppConfigEntry<T = unknown> {
  configType: string;
  configId: string;
  enabled: boolean;
  config: T;
  version: string | number;
}

export interface ProfileSectionConfig {
  label: string;
  icon?: string;
  order: number;
  description?: string;
}

export interface ProfileVisibleWhen {
  attribute: string;
  op: VisibleWhenOperator;
  value?: unknown;
}

export interface ProfileStorageBinding {
  scope: 'CORE' | 'ATTRIBUTES';
  path?: RiderProfileCorePath;
}

export interface ProfileValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  minDate?: string;
  maxDate?: string;
  minItems?: number;
  maxItems?: number;
  allowedMimeTypes?: string[];
  maxFileSizeBytes?: number;
}

export interface ProfileLovItem {
  value: string;
  label: string;
  order: number;
  enabled: boolean;
  parent?: string;
  meta?: Record<string, unknown>;
}

export interface ProfileLovDefinition {
  id: string;
  label: string;
  parentLovId?: string;
  items: ProfileLovItem[];
}

export interface ProfileFieldDefinition {
  key: string;
  label: string;
  helpText?: string;
  placeholder?: string;
  type: ProfileFieldType;
  lovId?: string;
  validation?: ProfileValidationRules;
  visibleWhen?: ProfileVisibleWhen;
  dependsOn?: string;
  fallbackToText?: boolean;
  fields?: ProfileFieldDefinition[];
  repeatable?: boolean;
  maxItems?: number;
  required?: boolean;
  handler?: string;
  handlerOptions?: Record<string, unknown>;
}

export interface ProfileAttributeDefinition extends ProfileFieldDefinition {
  sectionId: string;
  order: number;
  storage: ProfileStorageBinding;
  adminOnly: boolean;
  sensitive: boolean;
  visibleToAllMgmtUsers: boolean;
  system: boolean;
}

export interface ProfileSectionDefinition {
  id: string;
  label: string;
  icon?: string;
  order: number;
  description?: string;
}

export interface ProfileSectionWithAttributes extends ProfileSectionDefinition {
  attributes: ProfileAttributeDefinition[];
}

export interface ProfileDefinitions {
  definitionsVersion: string;
  sections: ProfileSectionWithAttributes[];
  orderedAttributes: ProfileAttributeDefinition[];
  attributesByKey: Record<string, ProfileAttributeDefinition>;
  lovsById: Record<string, ProfileLovDefinition>;
  rawEntries: AppConfigEntry[];
}

export interface ProfileFileValue {
  s3Key?: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
}

export type ProfileDraftValues = Record<string, unknown>;
export type ProfileValidationErrors = Record<string, string>;
