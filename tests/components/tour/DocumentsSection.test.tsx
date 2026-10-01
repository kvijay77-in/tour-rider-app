import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DocumentsSection } from '../../../src/components/tour/DocumentsSection';
import { getRideArtifacts, getTourArtifacts } from '../../../src/services/api/artifactApi';
import { downloadAndOpenArtifact } from '../../../src/services/artifactTransferService';
import type { ArtifactManifestItem } from '../../../src/types/artifact';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

jest.mock('../../../src/services/api/artifactApi', () => ({
  getTourArtifacts: jest.fn(),
  getRideArtifacts: jest.fn(),
}));

jest.mock('../../../src/services/artifactTransferService', () => ({
  getArtifactFilename: (s3Key: string) => s3Key.split('/').pop(),
  downloadAndOpenArtifact: jest.fn(),
}));

const mockedGetTourArtifacts = getTourArtifacts as jest.MockedFunction<typeof getTourArtifacts>;
const mockedGetRideArtifacts = getRideArtifacts as jest.MockedFunction<typeof getRideArtifacts>;
const mockedDownloadAndOpen = downloadAndOpenArtifact as jest.MockedFunction<typeof downloadAndOpenArtifact>;

const artifact: ArtifactManifestItem = {
  artifactId: 'plan',
  s3Key: 'tours/T1/ride-plan.pdf',
  contentType: 'application/pdf',
  title: 'Ride plan',
  description: 'Route and schedule',
  version: 2,
  updatedAt: '2026-09-30T10:00:00Z',
  downloadUrl: 'signed-url-must-not-render',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedDownloadAndOpen.mockImplementation(async (_metadata, readFreshArtifact, onProgress) => {
    await readFreshArtifact('plan');
    onProgress({ bytesWritten: 50, totalBytes: 100 });
  });
});

it('suppresses the Documents section when the manifest is empty', async () => {
  mockedGetTourArtifacts.mockResolvedValue({ success: true, data: [], timestamp: '' });
  const { queryByText } = render(<DocumentsSection tourId="T1" />);
  await waitFor(() => expect(queryByText('Loading documents...')).toBeNull());
  expect(queryByText('Documents')).toBeNull();
});

it('renders returned metadata without retaining the presigned URL and shows progress', async () => {
  mockedGetTourArtifacts.mockResolvedValue({ success: true, data: [artifact], timestamp: '' });
  const { getByText, getByTestId, queryByText } = render(<DocumentsSection tourId="T1" />);

  await waitFor(() => expect(getByText('Ride plan')).toBeTruthy());
  expect(getByText('ride-plan.pdf')).toBeTruthy();
  expect(getByText('Route and schedule')).toBeTruthy();
  expect(getByText('application/pdf · Version 2 · Updated Sep 30, 2026')).toBeTruthy();
  expect(queryByText('signed-url-must-not-render')).toBeNull();

  fireEvent.press(getByTestId('open-document-plan'));
  await waitFor(() => expect(getByText('Document ready to view or share.')).toBeTruthy());
  expect(mockedGetTourArtifacts).toHaveBeenCalledWith('T1', 'plan');
});

it('loads ride-scoped manifests and presents manifest failures with retry', async () => {
  mockedGetRideArtifacts.mockResolvedValueOnce({ success: false, error: { code: 'API_ERROR', message: 'Unavailable' }, timestamp: '' });
  mockedGetRideArtifacts.mockResolvedValueOnce({ success: true, data: [], timestamp: '' });
  const { getByText, getByTestId } = render(<DocumentsSection tourId="T1" rideId="R1" />);

  await waitFor(() => expect(getByText('Unavailable')).toBeTruthy());
  fireEvent.press(getByTestId('documents-retry'));
  await waitFor(() => expect(getByText('Documents')).toBeTruthy());
  expect(mockedGetRideArtifacts).toHaveBeenNthCalledWith(1, 'T1', 'R1');
  expect(mockedGetRideArtifacts).toHaveBeenNthCalledWith(2, 'T1', 'R1');
});