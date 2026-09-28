import type { ProfileAttributeDefinition, ProfileDraftValues, ProfileVisibleWhen } from './types';

function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((entry) => hasContent(entry));
  }

  return value !== undefined && value !== null;
}

export function evaluateVisibleWhen(
  condition: ProfileVisibleWhen | undefined,
  values: ProfileDraftValues,
): boolean {
  if (!condition) {
    return true;
  }

  const actual = values[condition.attribute];

  switch (condition.op) {
    case 'EQ':
      return actual === condition.value;
    case 'NEQ':
      return actual !== condition.value;
    case 'IN': {
      const allowedValues = Array.isArray(condition.value) ? condition.value : [];
      return allowedValues.includes(actual);
    }
    case 'NOT_EMPTY':
      return hasContent(actual);
    default:
      return true;
  }
}

export function isAttributeVisible(
  attribute: Pick<ProfileAttributeDefinition, 'visibleWhen'>,
  values: ProfileDraftValues,
): boolean {
  return evaluateVisibleWhen(attribute.visibleWhen, values);
}
