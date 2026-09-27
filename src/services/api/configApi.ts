import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { AppConfigEntry } from '../../profile-schema';

const TAG = 'ConfigApi';

function normalizeConfigPayload(payload: unknown): PaginatedResponse<AppConfigEntry> {
  if (Array.isArray(payload)) {
    return { items: payload as AppConfigEntry[] };
  }

  if (!payload || typeof payload !== 'object') {
    return { items: [] };
  }

  const response = payload as Record<string, unknown>;
  const items =
    (Array.isArray(response.items) ? response.items : undefined)
    ?? (Array.isArray(response.configs) ? response.configs : undefined)
    ?? (Array.isArray(response.results) ? response.results : undefined)
    ?? (Array.isArray(response.data) ? response.data : undefined)
    ?? [];

  return {
    items: items as AppConfigEntry[],
    ...(typeof response.nextToken === 'string' ? { nextToken: response.nextToken } : {}),
    ...(typeof response.total === 'number' ? { total: response.total } : {}),
  };
}

export async function getAppConfigEntries(): Promise<ApiResponse<PaginatedResponse<AppConfigEntry>>> {
  logger.debug(TAG, 'Fetching application config entries');
  const response = await apiClient.get<unknown>('/v1/config', {
    isExpectedError: (error) => error.statusCode >= 400 && error.statusCode < 500,
  });

  if (!response.success) {
    return response as ApiResponse<PaginatedResponse<AppConfigEntry>>;
  }

  return {
    ...response,
    data: normalizeConfigPayload(response.data),
  } as ApiResponse<PaginatedResponse<AppConfigEntry>>;
}
