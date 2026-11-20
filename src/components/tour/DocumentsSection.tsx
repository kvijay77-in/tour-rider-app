import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../../constants';
import { Card } from '../common/Card';
import { getRideArtifacts, getTourArtifacts } from '../../services/api/artifactApi';
import { downloadAndOpenArtifact, getArtifactFilename } from '../../services/artifactTransferService';
import type { ArtifactDisplayMetadata, ArtifactManifestItem, ArtifactScope } from '../../types/artifact';

type Props = {
  tourId: string;
  rideId?: string;
  refreshKey?: number;
};

type TransferState = {
  artifactId: string;
  status: 'downloading' | 'complete' | 'error';
  bytesWritten: number;
  totalBytes: number;
  error?: string;
};

function displayError(error: unknown): string {
  return error instanceof Error ? error.message : 'Document unavailable. Check your connection and try again.';
}

function artifactIcon(contentType: string): keyof typeof MaterialIcons.glyphMap {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'picture-as-pdf';
  return 'description';
}

function formatUpdatedDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : `Updated ${parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

function stripDownloadUrl(item: ArtifactManifestItem): ArtifactDisplayMetadata {
  const { downloadUrl: _downloadUrl, ...metadata } = item;
  return metadata;
}

export function DocumentsSection({ tourId, rideId, refreshKey = 0 }: Props) {
  const scope: ArtifactScope = rideId ? 'ride' : 'tour';
  const [items, setItems] = useState<ArtifactDisplayMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<TransferState | null>(null);

  const loadManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = scope === 'ride' && rideId
        ? await getRideArtifacts(tourId, rideId)
        : await getTourArtifacts(tourId);
      if (!response.success) {
        throw new Error(response.error?.message ?? 'Documents could not be loaded.');
      }
      setItems((response.data ?? []).map(stripDownloadUrl));
    } catch (loadError) {
      setItems([]);
      setError(displayError(loadError));
    } finally {
      setLoading(false);
    }
  }, [rideId, scope, tourId]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest, refreshKey]);

  const readFreshArtifact = useCallback(async (artifactId: string): Promise<ArtifactManifestItem> => {
    const response = scope === 'ride' && rideId
      ? await getRideArtifacts(tourId, rideId, artifactId)
      : await getTourArtifacts(tourId, artifactId);
    if (!response.success) {
      throw new Error(response.error?.message ?? 'A fresh document link could not be loaded.');
    }
    const artifact = response.data?.find((item) => item.artifactId === artifactId);
    if (!artifact?.downloadUrl) {
      throw new Error('A current download link is unavailable for this document.');
    }
    return artifact;
  }, [rideId, scope, tourId]);

  const openArtifact = useCallback(async (metadata: ArtifactDisplayMetadata) => {
    setTransfer({ artifactId: metadata.artifactId, status: 'downloading', bytesWritten: 0, totalBytes: -1 });
    try {
      await downloadAndOpenArtifact(metadata, readFreshArtifact, (progress) => {
        setTransfer((current) => current?.artifactId === metadata.artifactId
          ? { ...current, bytesWritten: progress.bytesWritten, totalBytes: progress.totalBytes }
          : current);
      });
      setTransfer((current) => current?.artifactId === metadata.artifactId
        ? { ...current, status: 'complete' }
        : current);
    } catch (transferError) {
      setTransfer((current) => current?.artifactId === metadata.artifactId
        ? { ...current, status: 'error', error: displayError(transferError) }
        : current);
    }
  }, [readFreshArtifact]);

  if (!loading && !error && items.length === 0) return null;

  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Documents</Text>
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
      </View>

      {loading ? <Text style={styles.message}>Loading documents...</Text> : null}
      {error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable
            testID="documents-retry"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Retry loading documents"
            onPress={() => void loadManifest()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {items.map((item) => {
        const filename = getArtifactFilename(item.s3Key, item.artifactId);
        const activeTransfer = transfer?.artifactId === item.artifactId ? transfer : null;
        const updatedDate = formatUpdatedDate(item.updatedAt);
        const metadata = [item.contentType, item.version !== undefined ? `Version ${item.version}` : null, updatedDate]
          .filter((value): value is string => Boolean(value));
        const progressPercent = activeTransfer && activeTransfer.totalBytes > 0
          ? Math.min(100, Math.round(activeTransfer.bytesWritten * 100 / activeTransfer.totalBytes))
          : null;

        return (
          <View key={item.artifactId} style={styles.documentRow}>
            <MaterialIcons name={artifactIcon(item.contentType)} size={24} color={COLORS.primary} />
            <View style={styles.documentContent}>
              <Text style={styles.documentTitle}>{item.title || filename}</Text>
              <Text style={styles.filename} numberOfLines={2}>{filename}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <Text style={styles.metadata}>{metadata.join(' · ')}</Text>
              {activeTransfer?.status === 'downloading' ? (
                <View style={styles.progressArea}>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`Downloading ${item.title || filename}`}
                    accessibilityValue={progressPercent !== null ? { min: 0, max: 100, now: progressPercent } : undefined}
                    style={styles.progressTrack}
                  >
                    {progressPercent !== null ? <View style={[styles.progressFill, { width: `${progressPercent}%` }]} /> : null}
                  </View>
                  <Text style={styles.progressText}>
                    {progressPercent !== null ? `${progressPercent}%` : `Downloading (${Math.round(activeTransfer.bytesWritten / 1024)} KB)`}
                  </Text>
                </View>
              ) : null}
              {activeTransfer?.status === 'complete' ? <Text style={styles.success}>Document ready to view or share.</Text> : null}
              {activeTransfer?.status === 'error' ? <Text accessibilityRole="alert" style={styles.error}>{activeTransfer.error}</Text> : null}
            </View>
            <Pressable
              testID={`open-document-${item.artifactId}`}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title || filename}`}
              disabled={transfer?.status === 'downloading'}
              onPress={() => void openArtifact(item)}
              style={[styles.openButton, transfer?.status === 'downloading' ? styles.disabled : null]}
            >
              <MaterialIcons name="file-download" size={20} color={COLORS.white} />
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { padding: 14, gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  message: { color: COLORS.textSecondary, fontSize: 14 },
  error: { color: COLORS.danger, fontSize: 13, marginTop: 4 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 5, paddingHorizontal: 10 },
  retryText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  documentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  documentContent: { flex: 1, minWidth: 0 },
  documentTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  filename: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  description: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  metadata: { color: COLORS.textDisabled, fontSize: 11, marginTop: 5 },
  openButton: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  disabled: { opacity: 0.45 },
  progressArea: { marginTop: 8 },
  progressTrack: { height: 5, backgroundColor: COLORS.gray[200], borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: COLORS.success },
  progressText: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  success: { color: COLORS.success, fontSize: 12, marginTop: 5 },
});

export default DocumentsSection;