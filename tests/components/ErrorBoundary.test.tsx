import React from 'react';
import { render, screen } from '@testing-library/react-native';

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
    render(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement(ThrowOnRender),
      ),
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });
});