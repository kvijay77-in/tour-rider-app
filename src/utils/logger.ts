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

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const prefix = `[${LEVEL_NAMES[level]}] [${tag}]`;
  const extra = data !== undefined
    ? (data instanceof Error ? formatError(data) : (typeof data === 'string' ? data : JSON.stringify(data)))
    : '';

  const line = extra ? `${prefix} ${message} — ${extra}` : `${prefix} ${message}`;

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
