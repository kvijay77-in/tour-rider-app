/**
 * Root navigator — splits unauthenticated and authenticated app subtrees
 * based on AuthContext state.
 */

import React from 'react';

import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}
