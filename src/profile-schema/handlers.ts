import type { ProfileAttributeDefinition } from './types';

export interface ProfileHandlerDefinition {
  readOnly: boolean;
  omitFromPayload?: boolean;
  allowCreatePayload?: boolean;
}

const DEFAULT_HANDLER: ProfileHandlerDefinition = {
  readOnly: false,
};

const PROFILE_HANDLERS: Record<string, ProfileHandlerDefinition> = {
  PROFILE_PHOTO: {
    readOnly: false,
    omitFromPayload: true,
  },
  COGNITO_EMAIL: {
    readOnly: true,
    allowCreatePayload: true,
  },
  PERSONAL_CODE: {
    readOnly: true,
  },
};

export function getProfileHandler(attribute: Pick<ProfileAttributeDefinition, 'handler'>): ProfileHandlerDefinition {
  if (!attribute.handler) {
    return DEFAULT_HANDLER;
  }

  return PROFILE_HANDLERS[attribute.handler] ?? DEFAULT_HANDLER;
}

export function isAttributeReadOnlyForRider(attribute: ProfileAttributeDefinition): boolean {
  if (attribute.adminOnly) {
    return true;
  }

  return getProfileHandler(attribute).readOnly;
}

export function findAttributeByHandler(
  attributes: ProfileAttributeDefinition[],
  handler: string,
): ProfileAttributeDefinition | undefined {
  return attributes.find((attribute) => attribute.handler === handler);
}
