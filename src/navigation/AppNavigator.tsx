/**
 * Authenticated app subtree.
 *
 * Mounts authenticated-only providers and renders the main tab navigator.
 */

import React from 'react';

import { RiderProvider } from '../context/RiderContext';
import { TourProvider } from '../context/TourContext';
import { MainNavigator } from './MainNavigator';

export function AppNavigator() {
  return (
    <RiderProvider>
      <TourProvider>
        <MainNavigator />
      </TourProvider>
    </RiderProvider>
  );
}
