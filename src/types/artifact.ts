/** Tour and ride document metadata returned by tour-data-api. */

export type ArtifactScope = 'tour' | 'ride';

export interface ArtifactManifestItem {
  artifactId: string;
  s3Key: string;
  contentType: string;
  version?: number;
  title?: string;
  description?: string;
  downloadUrl: string;
  expiresIn?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ArtifactDisplayMetadata = Omit<ArtifactManifestItem, 'downloadUrl'>;