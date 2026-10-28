import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { ImageSourcePropType } from 'react-native';

import { getTourArtifacts } from '../services/api/artifactApi';
import type { ArtifactManifestItem } from '../types/artifact';
import { logger } from '../utils/logger';

export type TourImageId = 'ride-plan' | 'tour-elevation' | 'training-challenge';

type ImageState = {
  tourId?: string;
  refreshKey?: number;
  sources: Partial<Record<TourImageId, ImageSourcePropType>>;
  errors: Partial<Record<TourImageId, string>>;
  loading: boolean;
  error?: string;
};

function imageSources(items: ArtifactManifestItem[]): ImageState['sources'] {
  const sources: ImageState['sources'] = {};
  for (const artifactId of ['ride-plan', 'tour-elevation', 'training-challenge'] as const) {
    const item = items.find((artifact) => artifact.artifactId === artifactId);
    if (item?.contentType.startsWith('image/') && item.downloadUrl) {
      sources[artifactId] = { uri: item.downloadUrl };
    }
  }
  return sources;
}

export function useTourArtifactImages(tourId?: string, refreshKey = 0) {
  const [state, setState] = useState<ImageState>({ sources: {}, errors: {}, loading: false });
  const generation = useRef(0);
  const retried = useRef(new Set<TourImageId>());

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    retried.current.clear();
    setState({ tourId, refreshKey, sources: {}, errors: {}, loading: Boolean(tourId) });
    if (!tourId) return;
    try {
      const response = await getTourArtifacts(tourId);
      if (!response.success) throw new Error('Tour images could not be loaded.');
      if (request === generation.current) {
        setState({ tourId, refreshKey, sources: imageSources(response.data ?? []), errors: {}, loading: false });
      }
    } catch {
      if (request === generation.current) {
        logger.warn('TourArtifactImages', 'Unable to load tour images');
        setState({ tourId, refreshKey, sources: {}, errors: {}, loading: false, error: 'Tour images could not be loaded.' });
      }
    }
  }, [tourId, refreshKey]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => {
      generation.current += 1;
      setState({ sources: {}, errors: {}, loading: false });
    };
  }, [refresh]));

  const onImageError = useCallback(async (artifactId: TourImageId) => {
    if (!tourId) return;
    const request = generation.current;
    const markFailed = () => {
      if (request !== generation.current) return;
      setState((current) => ({
        ...current,
        sources: { ...current.sources, [artifactId]: undefined },
        errors: { ...current.errors, [artifactId]: 'Image could not be loaded.' },
      }));
    };
    if (retried.current.has(artifactId)) {
      markFailed();
      return;
    }
    retried.current.add(artifactId);
    setState((current) => ({ ...current, sources: { ...current.sources, [artifactId]: undefined } }));
    try {
      const response = await getTourArtifacts(tourId, artifactId);
      const source = response.success ? imageSources(response.data ?? [])[artifactId] : undefined;
      if (!source) throw new Error('Image unavailable');
      if (request === generation.current) {
        setState((current) => ({ ...current, sources: { ...current.sources, [artifactId]: source } }));
      }
    } catch {
      markFailed();
    }
  }, [tourId]);

  const current: ImageState = state.tourId === tourId && state.refreshKey === refreshKey
    ? state
    : { sources: {}, errors: {}, loading: Boolean(tourId) };
  return { ...current, refresh, onImageError };
}