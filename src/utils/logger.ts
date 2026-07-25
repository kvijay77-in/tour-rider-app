/**
 * Structured logger for the Tour Rider App.
 *
 * Provides consistent, level-gated logging across all modules.
 * Levels: DEBUG < INFO < WARN < ERROR
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('ApiClient', 'GET /tours/active', { status: 200 });
 *   logger.error('TourContext', 'Failed to fetch tour', err);
 *
 * The active level is controlled via EXPO_PUBLIC_LOG_LEVEL (default: WARN in
 * production, DEBUG in development).
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.NONE]: 'NONE',
};

function resolveLevel(): LogLevel {
  const envLevel = process.env.EXPO_PUBLIC_LOG_LEVEL?.toUpperCase();
  if (envLevel && envLevel in LogLevel) {
    return LogLevel[envLevel as keyof typeof LogLevel];
  }
  return __DEV__ ? LogLevel.DEBUG : LogLevel.WARN;
}

const activeLevel = resolveLevel();

function shouldLog(level: LogLevel): boolean {
  return level >= activeLevel;
}

function serializeError(error: Error): Record<string, unknown> {
  const details: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };

  const errorWithMeta = error as Error & {
    statusCode?: number;
    errorCode?: string;
    cause?: unknown;
  };

  if (error.stack) {
    details.stack = error.stack;
  }

  if (errorWithMeta.statusCode !== undefined) {
    details.statusCode = errorWithMeta.statusCode;
  }

  if (errorWithMeta.errorCode) {
    details.errorCode = errorWithMeta.errorCode;
  }

  if (errorWithMeta.cause !== undefined) {
    details.cause = errorWithMeta.cause;
  }

  return details;
}

/**
 * Format an error for logging — extracts class name, message and relevant properties.
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    const parts: string[] = [`${err.name}: ${err.message}`];
    const apiErr = err as Error & { statusCode?: number; errorCode?: string };
    if (apiErr.statusCode !== undefined) {
      parts.push(`statusCode=${apiErr.statusCode}`);
    }
    if (apiErr.errorCode) {
      parts.push(`errorCode=${apiErr.errorCode}`);
    }
    return parts.join(' | ');
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function createJsonReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();

  return (_key: string, value: unknown): unknown => {
    if (value instanceof Error) {
      return serializeError(value);
    }

    if (typeof value === 'bigint') {
      return `${value}n`;
    }

    if (typeof value === 'function') {
      return `[Function ${value.name || 'anonymous'}]`;
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (typeof value === 'undefined') {
      return '[undefined]';
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);
    }

    return value;
  };
}

function serializeData(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Error) {
    return formatError(data);
  }

  if (typeof data === 'undefined') {
    return '[undefined]';
  }

  try {
    const serialized = JSON.stringify(data, createJsonReplacer());
    if (serialized !== undefined) {
      return serialized;
    }
  } catch {
    // Fall through to a best-effort string conversion.
  }

  return String(data);
}

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const prefix = `[${LEVEL_NAMES[level]}] [${tag}]`;
  const extra = data !== undefined ? serializeData(data) : '';

  const line = extra ? `${prefix} ${message} - ${extra}` : `${prefix} ${message}`;

  switch (level) {
    case LogLevel.ERROR:
      console.error(line);
      break;
    case LogLevel.WARN:
      console.warn(line);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(line);
      break;
  }
}

export const logger = {
  debug: (tag: string, message: string, data?: unknown) => log(LogLevel.DEBUG, tag, message, data),
  info:  (tag: string, message: string, data?: unknown) => log(LogLevel.INFO, tag, message, data),
  warn:  (tag: string, message: string, data?: unknown) => log(LogLevel.WARN, tag, message, data),
  error: (tag: string, message: string, data?: unknown) => log(LogLevel.ERROR, tag, message, data),
};
