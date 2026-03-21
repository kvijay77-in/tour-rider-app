/**
 * Unit tests for src/utils/logger.ts
 */

import { logger, LogLevel } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Capture console output
// ---------------------------------------------------------------------------

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  errorSpy = jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logger', () => {
  // Note: in the test environment __DEV__ is true, so activeLevel is DEBUG.
  // All levels should produce output.

  it('logger.debug writes to console.log', () => {
    logger.debug('TestTag', 'debug message');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('[DEBUG]');
    expect(logSpy.mock.calls[0][0]).toContain('[TestTag]');
    expect(logSpy.mock.calls[0][0]).toContain('debug message');
  });

  it('logger.info writes to console.log', () => {
    logger.info('TestTag', 'info message');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('[INFO]');
  });

  it('logger.warn writes to console.warn', () => {
    logger.warn('TestTag', 'warn message');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[WARN]');
  });

  it('logger.error writes to console.error', () => {
    logger.error('TestTag', 'error message');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
  });

  it('includes extra data when provided', () => {
    logger.info('TestTag', 'with data', { key: 'value' });
    const output: string = logSpy.mock.calls[0][0];
    expect(output).toContain('key');
    expect(output).toContain('value');
  });

  it('formats Error objects with name and message', () => {
    const err = new Error('something broke');
    logger.error('TestTag', 'caught', err);
    const output: string = errorSpy.mock.calls[0][0];
    expect(output).toContain('Error: something broke');
  });

  it('formats Error objects with extra properties', () => {
    const err = new Error('api failure') as Error & {
      statusCode?: number;
      errorCode?: string;
    };
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    logger.error('TestTag', 'api error', err);
    const output: string = errorSpy.mock.calls[0][0];
    expect(output).toContain('statusCode=404');
    expect(output).toContain('errorCode=NOT_FOUND');
  });

  it('handles string data directly', () => {
    logger.info('TestTag', 'msg', 'extra-string');
    const output: string = logSpy.mock.calls[0][0];
    expect(output).toContain('extra-string');
  });
});

describe('LogLevel enum', () => {
  it('has correct numeric ordering', () => {
    expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
    expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
    expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
    expect(LogLevel.ERROR).toBeLessThan(LogLevel.NONE);
  });
});
