import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  downloadAndOpenArtifact,
  getArtifactFilename,
  getArtifactLocalFilename,
} from '../../src/services/artifactTransferService';
import type { ArtifactDisplayMetadata, ArtifactManifestItem } from '../../src/types/artifact';

jest.mock('expo-file-system', () => {
  const MockFile = jest.fn().mockImplementation((_directory: unknown, filename: string) => ({
    uri: `file:///documents/${filename}`,
  }));
  Object.assign(MockFile, { downloadFileAsync: jest.fn() });
  return { File: MockFile, Paths: { document: 'file:///documents' } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const mockedDownload = File.downloadFileAsync as jest.MockedFunction<typeof File.downloadFileAsync>;
const mockedIsAvailable = Sharing.isAvailableAsync as jest.MockedFunction<typeof Sharing.isAvailableAsync>;
const mockedShare = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>;

const metadata: ArtifactDisplayMetadata = {
  artifactId: 'guide',
  s3Key: 'tours/T1/Ride Plan.pdf',
  contentType: 'application/pdf',
  title: 'Ride plan',
  version: 1,
};

function artifact(downloadUrl: string): ArtifactManifestItem {
  return { ...metadata, downloadUrl };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedIsAvailable.mockResolvedValue(true);
  mockedShare.mockResolvedValue(undefined);
});

it('downloads to local documents with progress and opens the system share sheet', async () => {
  const onProgress = jest.fn();
  mockedDownload.mockImplementation(async (_url, _destination, options) => {
    options?.onProgress?.({ bytesWritten: 50, totalBytes: 100 });
    return { uri: 'file:///documents/Ride_Plan.pdf' } as never;
  });
  const readFreshArtifact = jest.fn().mockResolvedValue(artifact('signed-url'));

  await downloadAndOpenArtifact(metadata, readFreshArtifact, onProgress);

  expect(readFreshArtifact).toHaveBeenCalledTimes(1);
  expect(mockedDownload).toHaveBeenCalledWith('signed-url', expect.objectContaining({
    uri: 'file:///documents/Ride_Plan.pdf',
  }), expect.objectContaining({ idempotent: true, onProgress: expect.any(Function) }));
  expect(onProgress).toHaveBeenCalledWith({ bytesWritten: 50, totalBytes: 100 });
  expect(mockedShare).toHaveBeenCalledWith('file:///documents/Ride_Plan.pdf', expect.objectContaining({
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  }));
});

it('refreshes the manifest and retries exactly once after a failed transfer', async () => {
  mockedDownload
    .mockRejectedValueOnce(new Error('HTTP 403'))
    .mockResolvedValueOnce({ uri: 'file:///documents/Ride_Plan.pdf' } as never);
  const readFreshArtifact = jest.fn()
    .mockResolvedValueOnce(artifact('expired-url'))
    .mockResolvedValueOnce(artifact('fresh-url'));

  await downloadAndOpenArtifact(metadata, readFreshArtifact, jest.fn());

  expect(readFreshArtifact).toHaveBeenCalledTimes(2);
  expect(mockedDownload).toHaveBeenNthCalledWith(1, 'expired-url', expect.anything(), expect.anything());
  expect(mockedDownload).toHaveBeenNthCalledWith(2, 'fresh-url', expect.anything(), expect.anything());
  expect(mockedShare).toHaveBeenCalledTimes(1);
});

it('does not make a second retry when the refreshed link also fails', async () => {
  mockedDownload.mockRejectedValue(new Error('HTTP 403'));
  const readFreshArtifact = jest.fn()
    .mockResolvedValueOnce(artifact('expired-url'))
    .mockResolvedValueOnce(artifact('still-expired-url'));

  await expect(downloadAndOpenArtifact(metadata, readFreshArtifact, jest.fn()))
    .rejects.toThrow('Document download failed after refreshing its link');
  expect(readFreshArtifact).toHaveBeenCalledTimes(2);
  expect(mockedDownload).toHaveBeenCalledTimes(2);
  expect(mockedShare).not.toHaveBeenCalled();
});

it('reports unavailable system sharing after download without retrying', async () => {
  mockedDownload.mockResolvedValue({ uri: 'file:///documents/Ride_Plan.pdf' } as never);
  mockedIsAvailable.mockResolvedValue(false);
  const readFreshArtifact = jest.fn().mockResolvedValue(artifact('signed-url'));

  await expect(downloadAndOpenArtifact(metadata, readFreshArtifact, jest.fn()))
    .rejects.toThrow('system document viewer is not available');
  expect(readFreshArtifact).toHaveBeenCalledTimes(1);
  expect(mockedDownload).toHaveBeenCalledTimes(1);
  expect(mockedShare).not.toHaveBeenCalled();
});

it('derives a filesystem-safe filename from the artifact key', () => {
  expect(getArtifactFilename('tours/T1/Ride Plan 2026.pdf', 'fallback')).toBe('Ride Plan 2026.pdf');
  expect(getArtifactLocalFilename('tours/T1/Ride Plan 2026.pdf', 'fallback')).toBe('Ride_Plan_2026.pdf');
  expect(getArtifactFilename('tours/T1/', 'guide')).toBe('guide');
});