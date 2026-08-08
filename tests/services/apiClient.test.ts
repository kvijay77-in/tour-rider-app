/**
 * Unit tests for src/services/api/apiClient.ts
 */

import {
  ApiError,
  isNetworkError,
  setApiBaseUrl,
  setApiRequestLoggingControls,
  setAuthTokenProvider,
  setAuthInvalidatedCallback,
  apiClient,
} from '../../src/services/api/apiClient';
import { logger } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch;

// Suppress logger output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

beforeEach(() => {
  mockFetch.mockReset();
  jest.clearAllMocks();
  setApiBaseUrl('https://api.example.com');
  setAuthTokenProvider(async () => 'test-jwt-token');
  setApiRequestLoggingControls({ enabled: true, debugGetRequests: false });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('stores statusCode and errorCode', () => {
    const err = new ApiError('Not found', 404, 'NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.errorCode).toBe('NOT_FOUND');
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores optional responseBody', () => {
    const body = { error: { code: 'E1', message: 'fail' } };
    const err = new ApiError('fail', 500, 'E1', body);
    expect(err.responseBody).toEqual(body);
  });
});

// ---------------------------------------------------------------------------
// isNetworkError
// ---------------------------------------------------------------------------

describe('isNetworkError', () => {
  it('returns true for "Network request failed" TypeError', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
  });

  it('returns true for "Failed to fetch" TypeError', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns true for "Load failed" TypeError', () => {
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
  });

  it('returns false for non-network TypeError', () => {
    expect(isNetworkError(new TypeError('undefined is not a function'))).toBe(false);
  });

  it('returns false for non-TypeError errors', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isNetworkError('string')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// apiClient.get — success
// ---------------------------------------------------------------------------

describe('apiClient.get', () => {
  it('makes a GET request with auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: '1' }, timestamp: '2026-01-01T00:00:00Z' }),
    });

    const result = await apiClient.get<{ id: string }>('/v1/resource');
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/resource');
    expect(options.method).toBe('GET');
    expect(options.headers['Authorization']).toBe('Bearer test-jwt-token');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('appends query params to URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.get('/v1/items', { params: { page: '2', limit: '10' } });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });
});

// ---------------------------------------------------------------------------
// apiClient.post
// ---------------------------------------------------------------------------

describe('apiClient.post', () => {
  it('sends JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'new' }, timestamp: '2026-01-01T00:00:00Z' }),
    });

    const body = { name: 'Test' };
    await apiClient.post('/v1/resource', body);

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(JSON.stringify(body));
  });

  it('logs the request payload for POST requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'new' }, timestamp: '2026-01-01T00:00:00Z' }),
    });

    const body = { name: 'Test', count: 1 };
    await apiClient.post('/v1/resource', body);

    expect(logger.debug).toHaveBeenCalledWith(
      'ApiClient',
      'POST payload (normalized)',
      expect.objectContaining({ payload: body }),
    );
  });
});

// ---------------------------------------------------------------------------
// apiClient — error handling
// ---------------------------------------------------------------------------

describe('apiClient error handling', () => {
  it('throws ApiError for 4xx responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
        timestamp: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(apiClient.get('/v1/missing')).rejects.toThrow(ApiError);

    try {
      await apiClient.get('/v1/missing');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(404);
      expect((e as ApiError).errorCode).toBe('NOT_FOUND');
    }
  });

  it('retries on 500 errors and eventually throws', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal error' },
        timestamp: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(
      apiClient.get('/v1/broken', { maxRetries: 1, timeoutMs: 1000 }),
    ).rejects.toThrow(ApiError);

    // Initial attempt + 1 retry = 2 calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 30000);

  it('calls onAuthInvalidated callback on 401 when token refresh fails', async () => {
    const onInvalidated = jest.fn();
    setAuthInvalidatedCallback(onInvalidated);
    // Token provider returns null on refresh (simulating expired)
    setAuthTokenProvider(async () => null);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
        timestamp: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(apiClient.get('/v1/protected', { maxRetries: 0 })).rejects.toThrow();
    expect(onInvalidated).toHaveBeenCalledTimes(1);

    // Clean up
    setAuthTokenProvider(async () => 'test-jwt-token');
    setAuthInvalidatedCallback(() => {});
  });

  it('times out and throws when request exceeds timeout', async () => {
    mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal;
        if (!signal) {
          return;
        }

        signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    await expect(
      apiClient.get('/v1/slow', { timeoutMs: 10, maxRetries: 0 }),
    ).rejects.toThrow(ApiError);
  });

  it('logs expected API errors at info level and not warn', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
        timestamp: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(
      apiClient.get('/v1/missing', {
        isExpectedError: (error) => error.statusCode === 404,
        maxRetries: 0,
      }),
    ).rejects.toThrow(ApiError);

    expect(logger.info).toHaveBeenCalledWith(
      'ApiClient',
      'Expected API error (attempt 1)',
      expect.objectContaining({ statusCode: 404, errorCode: 'NOT_FOUND' }),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      'ApiClient',
      'Request error (attempt 1)',
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// apiClient — debug gating and request logging controls
// ---------------------------------------------------------------------------

describe('apiClient debug logging controls', () => {
  it('does not emit debug logs for GET by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.get('/v1/no-debug');

    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('emits debug logs for POST by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'new' }, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.post('/v1/resource', { name: 'Test' });

    expect(logger.debug).toHaveBeenCalled();
  });

  it('can enable debug logs for GET requests', async () => {
    setApiRequestLoggingControls({ debugGetRequests: true });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.get('/v1/debug-get');

    expect(logger.debug).toHaveBeenCalled();
  });

  it('can disable request debug logs for all methods', async () => {
    setApiRequestLoggingControls({ enabled: false, debugGetRequests: true });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'new' }, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.post('/v1/resource', { name: 'Test' });

    expect(logger.debug).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// apiClient.put / apiClient.delete
// ---------------------------------------------------------------------------

describe('apiClient.put', () => {
  it('makes a PUT request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {}, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.put('/v1/resource/1', { name: 'Updated' });
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
  });
});

describe('apiClient.delete', () => {
  it('makes a DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, timestamp: '2026-01-01T00:00:00Z' }),
    });

    await apiClient.delete('/v1/resource/1');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });
});
