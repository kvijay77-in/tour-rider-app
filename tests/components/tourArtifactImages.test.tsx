import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTourArtifactImages } from '../../src/hooks/useTourArtifactImages';
import { getTourArtifacts } from '../../src/services/api/artifactApi';

let mockFocused = true;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => {
    const react = require('react');
    react.useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));
jest.mock('../../src/services/api/artifactApi', () => ({ getTourArtifacts: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ logger: { warn: jest.fn() } }));

const mockedGet = jest.mocked(getTourArtifacts);

function mount(tourId?: string) {
  return renderHook<ReturnType<typeof useTourArtifactImages>, { id: string | undefined; refreshKey: number }>(
    ({ id, refreshKey }) => useTourArtifactImages(id, refreshKey), {
    initialProps: { id: tourId, refreshKey: 0 },
  });
}

function manifest(artifactId = 'ride-plan', downloadUrl = 'https://example.com/image', contentType = 'image/png') {
  return { success: true, data: [{ artifactId, downloadUrl, contentType, s3Key: 'tour/image.png' }], timestamp: '' };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockedGet.mockResolvedValue(manifest());
});

test('loads the tour manifest and selects images by stable artifact ID, not filename', async () => {
  const { result } = mount('T1');
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockedGet).toHaveBeenCalledWith('T1');
  expect(result.current.sources['ride-plan']).toEqual({ uri: 'https://example.com/image' });
  expect(result.current.sources['training-challenge']).toBeUndefined();
});

test('selects all three configured tour image types', async () => {
  mockedGet.mockResolvedValue({
    success: true,
    data: ['ride-plan', 'tour-elevation', 'training-challenge'].map((id) => manifest(id).data[0]),
    timestamp: '',
  });
  const { result } = mount('T1');
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(Object.keys(result.current.sources)).toEqual(['ride-plan', 'tour-elevation', 'training-challenge']);
});

test('does not request without a tour or use PDF artifacts as images', async () => {
  const { result, rerender } = mount();
  expect(mockedGet).not.toHaveBeenCalled();
  mockedGet.mockResolvedValue(manifest('ride-plan', 'https://example.com/doc', 'application/pdf'));
  rerender({ id: 'T1', refreshKey: 0 });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.sources).toEqual({});
});

test('refreshes a failed image link exactly once and exposes terminal failure', async () => {
  const { result } = mount('T1');
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockedGet.mockResolvedValue(manifest('ride-plan', 'https://example.com/fresh'));
  await act(async () => result.current.onImageError('ride-plan'));
  expect(mockedGet).toHaveBeenLastCalledWith('T1', 'ride-plan');
  expect(result.current.sources['ride-plan']).toEqual({ uri: 'https://example.com/fresh' });
  await act(async () => result.current.onImageError('ride-plan'));
  expect(mockedGet).toHaveBeenCalledTimes(2);
  expect(result.current.sources['ride-plan']).toBeUndefined();
  expect(result.current.errors['ride-plan']).toBeTruthy();
});

test('ignores a stale response after the selected tour changes', async () => {
  let resolveOld!: (value: ReturnType<typeof manifest>) => void;
  mockedGet.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const { result, rerender } = mount('T1');
  mockedGet.mockResolvedValue(manifest('tour-elevation', 'https://example.com/T2'));
  rerender({ id: 'T2', refreshKey: 0 });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => resolveOld(manifest()));
  expect(result.current.sources['ride-plan']).toBeUndefined();
  expect(result.current.sources['tour-elevation']).toEqual({ uri: 'https://example.com/T2' });
});

test('marks an image unavailable when its refreshed manifest has no image', async () => {
  const { result } = mount('T1');
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockedGet.mockResolvedValue({ success: true, data: [], timestamp: '' });
  await act(async () => result.current.onImageError('ride-plan'));
  expect(result.current.sources['ride-plan']).toBeUndefined();
  expect(result.current.errors['ride-plan']).toBeTruthy();
});

test('handles empty manifests, failures, and manual refresh', async () => {
  mockedGet.mockRejectedValueOnce(new Error('Network error'));
  const { result, rerender } = mount('T1');
  await waitFor(() => expect(result.current.error).toBeTruthy());
  mockedGet.mockResolvedValue({ success: true, data: [], timestamp: '' });
  await act(async () => result.current.refresh());
  expect(result.current.error).toBeUndefined();
  expect(result.current.sources).toEqual({});
  rerender({ id: 'T1', refreshKey: 1 });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockedGet).toHaveBeenCalledTimes(3);
});

test('clears presigned URLs on blur and requests fresh ones on refocus', async () => {
  const { result, rerender } = mount('T1');
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockFocused = false;
  rerender({ id: 'T1', refreshKey: 0 });
  expect(result.current.sources).toEqual({});
  mockedGet.mockResolvedValue(manifest('ride-plan', 'https://example.com/refocused'));
  mockFocused = true;
  rerender({ id: 'T1', refreshKey: 0 });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.sources['ride-plan']).toEqual({ uri: 'https://example.com/refocused' });
  expect(mockedGet).toHaveBeenCalledTimes(2);
});