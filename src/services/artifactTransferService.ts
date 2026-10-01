import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ArtifactDisplayMetadata, ArtifactManifestItem } from '../types/artifact';

export type ArtifactProgressHandler = (progress: { bytesWritten: number; totalBytes: number }) => void;
export type FreshArtifactReader = (artifactId: string) => Promise<ArtifactManifestItem>;

export function getArtifactFilename(s3Key: string, artifactId: string): string {
  const finalPathSegment = s3Key.split('/').pop() || artifactId;
  let decodedName = finalPathSegment;
  try {
    decodedName = decodeURIComponent(finalPathSegment);
  } catch {
    decodedName = finalPathSegment;
  }
  return decodedName || artifactId;
}

export function getArtifactLocalFilename(s3Key: string, artifactId: string): string {
  return getArtifactFilename(s3Key, artifactId).replace(/[^a-zA-Z0-9._-]/g, '_') || artifactId;
}

async function downloadArtifact(
  artifact: ArtifactManifestItem,
  onProgress: ArtifactProgressHandler,
): Promise<string> {
  const destination = new File(Paths.document, getArtifactLocalFilename(artifact.s3Key, artifact.artifactId));
  const localFile = await File.downloadFileAsync(artifact.downloadUrl, destination, {
    idempotent: true,
    onProgress,
  });
  return localFile.uri;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown transfer error';
}

export async function downloadAndOpenArtifact(
  metadata: ArtifactDisplayMetadata,
  readFreshArtifact: FreshArtifactReader,
  onProgress: ArtifactProgressHandler,
): Promise<void> {
  let currentArtifact = await readFreshArtifact(metadata.artifactId);
  let localUri: string;

  try {
    localUri = await downloadArtifact(currentArtifact, onProgress);
  } catch {
    try {
      currentArtifact = await readFreshArtifact(metadata.artifactId);
      localUri = await downloadArtifact(currentArtifact, onProgress);
    } catch (retryError) {
      throw new Error(`Document download failed after refreshing its link: ${describeError(retryError)}`);
    }
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('The system document viewer is not available on this device.');
  }

  await Sharing.shareAsync(localUri, {
    mimeType: currentArtifact.contentType,
    dialogTitle: currentArtifact.title ?? getArtifactFilename(currentArtifact.s3Key, currentArtifact.artifactId),
    ...(currentArtifact.contentType === 'application/pdf' ? { UTI: 'com.adobe.pdf' } : {}),
  });
}