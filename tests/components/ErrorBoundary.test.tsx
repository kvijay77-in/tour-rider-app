import React from 'react';
import TestRenderer from 'react-test-renderer';

import { ErrorBoundary } from '../../src/components/common/ErrorBoundary';
import { logger } from '../../src/utils/logger';

function ThrowOnRender() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  it('renders the fallback UI when a child throws', () => {
    let renderer: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        React.createElement(
          ErrorBoundary,
          null,
          React.createElement(ThrowOnRender),
        ),
      );
    });

    const renderedText = JSON.stringify(renderer!.toJSON());

    expect(renderedText).toContain('Something went wrong');
    expect(renderedText).toContain('Try Again');
  });
});