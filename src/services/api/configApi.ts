import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { AppConfigEntry } from '../../profile-schema';

const TAG = 'ConfigApi';

export interface ConfigEntriesResponse extends PaginatedResponse<AppConfigEntry> {
  definitionsVersion?: string;
}

function normalizeConfigPayload(payload: unknown): ConfigEntriesResponse {
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
    ...(typeof response.definitionsVersion === 'string' ? { definitionsVersion: response.definitionsVersion } : {}),
    ...(typeof response.nextToken === 'string' ? { nextToken: response.nextToken } : {}),
    ...(typeof response.total === 'number' ? { total: response.total } : {}),
  };
}

export async function getAppConfigEntries(): Promise<ApiResponse<ConfigEntriesResponse>> {
  logger.debug(TAG, 'Fetching application config entries');
  const response = await apiClient.get<unknown>('/v1/config', {
    isExpectedError: (error) => error.statusCode >= 400 && error.statusCode < 500,
  });

  if (!response.success) {
    return response as ApiResponse<ConfigEntriesResponse>;
  }

  return {
    ...response,
    data: normalizeConfigPayload(response.data),
  } as ApiResponse<ConfigEntriesResponse>;
}
