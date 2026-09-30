/**
 * Unit tests for src/config/reviewAccess.ts (store-reviewer backend routing).
 */

const mockConfigureAmplifyForOrganizer = jest.fn();
const mockSetApiBaseUrl = jest.fn();
const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

const PRIMARY = {
  organizerId: 'ORG1',
  organizerName: 'Organizer',
  cognitoPoolId: 'ap-south-1_PROD',
  cognitoClientId: 'prod-client',
  apiBaseUrl: 'https://prod.example.com',
};

let mockOrganizer: typeof PRIMARY | null = PRIMARY;

jest.mock('../../src/config/subscription.config', () => ({
  get subscriptionConfig() {
    return { mode: 'single', organizer: mockOrganizer };
  },
}));
jest.mock('../../src/config/amplify', () => ({
  configureAmplifyForOrganizer: (...args: unknown[]) => mockConfigureAmplifyForOrganizer(...args),
}));
jest.mock('../../src/services/api/apiClient', () => ({
  setApiBaseUrl: (...args: unknown[]) => mockSetApiBaseUrl(...args),
}));
jest.mock('expo-secure-store', () => mockSecureStore);
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type ReviewAccessModule = typeof import('../../src/config/reviewAccess');

const REVIEW_ENV = {
  EXPO_PUBLIC_REVIEW_USERNAME: 'Reviewer@Example.com',
  EXPO_PUBLIC_REVIEW_AWS_REGION: 'ap-south-1',
  EXPO_PUBLIC_REVIEW_AWS_USER_POOL_ID: 'ap-south-1_DEV',
  EXPO_PUBLIC_REVIEW_AWS_USER_POOL_WEB_CLIENT_ID: 'dev-client',
  EXPO_PUBLIC_REVIEW_AWS_IDENTITY_POOL_ID: '',
  EXPO_PUBLIC_REVIEW_TOUR_DATA_API_BASE_URL: 'https://dev.example.com/',
};

const originalEnv = process.env;

function loadModule(env: Record<string, string> = REVIEW_ENV): ReviewAccessModule {
  process.env = { ...originalEnv, ...env };
  let loaded: ReviewAccessModule | undefined;
  jest.isolateModules(() => {
    loaded = require('../../src/config/reviewAccess') as ReviewAccessModule;
  });
  loaded!.initBackendRouting();
  return loaded!;
}

describe('reviewAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrganizer = PRIMARY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('routes the reviewer email (case-insensitive exact match) to the Review profile', () => {
    const reviewAccess = loadModule();

    expect(reviewAccess.routeBackendForLogin('  reviewer@example.COM ')).toBe('review');
    expect(mockConfigureAmplifyForOrganizer).toHaveBeenCalledWith(expect.objectContaining({
      cognitoPoolId: 'ap-south-1_DEV',
      cognitoClientId: 'dev-client',
      apiBaseUrl: 'https://dev.example.com',
    }));
    expect(mockConfigureAmplifyForOrganizer.mock.calls[0][0]).not.toHaveProperty('identityPoolId');
    expect(mockSetApiBaseUrl).toHaveBeenCalledWith('https://dev.example.com');
    expect(reviewAccess.getActiveBackendKind()).toBe('review');
  });

  it('keeps other emails on the primary profile without reconfiguring', () => {
    const reviewAccess = loadModule();

    expect(reviewAccess.routeBackendForLogin('rider@example.com')).toBe('primary');
    expect(reviewAccess.routeBackendForLogin('reviewer@example.com.au')).toBe('primary');
    expect(mockConfigureAmplifyForOrganizer).not.toHaveBeenCalled();
    expect(mockSetApiBaseUrl).not.toHaveBeenCalled();
  });

  it('only reconfigures when the active profile actually changes', () => {
    const reviewAccess = loadModule();

    reviewAccess.routeBackendForLogin('reviewer@example.com');
    reviewAccess.routeBackendForLogin('reviewer@example.com');
    expect(mockConfigureAmplifyForOrganizer).toHaveBeenCalledTimes(1);

    reviewAccess.routeBackendForLogin('rider@example.com');
    expect(mockConfigureAmplifyForOrganizer).toHaveBeenCalledTimes(2);
    expect(mockConfigureAmplifyForOrganizer).toHaveBeenLastCalledWith(PRIMARY);
    expect(mockSetApiBaseUrl).toHaveBeenLastCalledWith('https://prod.example.com');

    reviewAccess.routeBackendToPrimary();
    expect(mockConfigureAmplifyForOrganizer).toHaveBeenCalledTimes(2);
  });

  it('routeBackendToPrimary switches back from the Review profile', () => {
    const reviewAccess = loadModule();

    reviewAccess.routeBackendToReview();
    reviewAccess.routeBackendToPrimary();

    expect(reviewAccess.getActiveBackendKind()).toBe('primary');
    expect(mockConfigureAmplifyForOrganizer).toHaveBeenLastCalledWith(PRIMARY);
  });

  it.each([
    ['username', 'EXPO_PUBLIC_REVIEW_USERNAME'],
    ['user pool', 'EXPO_PUBLIC_REVIEW_AWS_USER_POOL_ID'],
    ['client', 'EXPO_PUBLIC_REVIEW_AWS_USER_POOL_WEB_CLIENT_ID'],
    ['API URL', 'EXPO_PUBLIC_REVIEW_TOUR_DATA_API_BASE_URL'],
  ])('is disabled (fail-safe) when the review %s is empty', (_label, key) => {
    const reviewAccess = loadModule({ ...REVIEW_ENV, [key]: '' });

    expect(reviewAccess.isReviewRoutingEnabled()).toBe(false);
    expect(reviewAccess.routeBackendForLogin('reviewer@example.com')).toBe('primary');
    expect(reviewAccess.routeBackendToReview()).toBe(false);
    expect(mockConfigureAmplifyForOrganizer).not.toHaveBeenCalled();
  });

  it('is disabled when there is no primary organizer profile', () => {
    mockOrganizer = null;
    const reviewAccess = loadModule();

    expect(reviewAccess.isReviewRoutingEnabled()).toBe(false);
    expect(reviewAccess.routeBackendForLogin('reviewer@example.com')).toBe('primary');
    expect(mockConfigureAmplifyForOrganizer).not.toHaveBeenCalled();
  });

  it('persists and clears the review.active flag in SecureStore', async () => {
    const reviewAccess = loadModule();

    await reviewAccess.setReviewSessionActive(true);
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('review.active', 'true');

    await reviewAccess.setReviewSessionActive(false);
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('review.active');

    mockSecureStore.getItemAsync.mockResolvedValueOnce('true');
    await expect(reviewAccess.isReviewSessionActive()).resolves.toBe(true);
    mockSecureStore.getItemAsync.mockResolvedValueOnce(null);
    await expect(reviewAccess.isReviewSessionActive()).resolves.toBe(false);
  });
});
