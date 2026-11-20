/**
 * Minimal React Native mock for unit tests running in Node.
 * Only the exports referenced by source modules under test are stubbed.
 */

import React from 'react';

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: <T extends Record<string, unknown>>(style: T | T[] | null | undefined): T | undefined =>
    Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) as T : style ?? undefined,
};

export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const Modal = ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
  visible ? React.createElement('Modal', null, children) : null;
export const TouchableOpacity = 'TouchableOpacity';
export const ActivityIndicator = 'ActivityIndicator';
export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
};

export const Platform = {
  OS: 'ios' as const,
  select: <T>(specifics: { ios?: T; android?: T; default?: T }): T | undefined =>
    specifics.ios ?? specifics.default,
};

export class NativeEventEmitter {
  addListener() { return { remove: () => {} }; }
  removeAllListeners() {}
}

export default {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Platform,
  NativeEventEmitter,
};
