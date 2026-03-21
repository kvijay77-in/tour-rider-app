/**
 * Minimal React Native mock for unit tests running in Node.
 * Only the exports referenced by source modules under test are stubbed.
 */

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
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
  Platform,
  NativeEventEmitter,
};
