/**
 * Custom drawer content with explicit sign-out action.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: 8 },
        ]}
      >
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <DrawerItem
          label="Sign Out"
          onPress={logout}
          icon={({ color, size }) => (
            <Ionicons name="log-out-outline" size={size} color={color} />
          )}
          labelStyle={styles.signOutLabel}
          style={styles.signOutItem}
          activeTintColor={COLORS.danger}
          inactiveTintColor={COLORS.danger}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  signOutItem: {
    marginTop: 0,
  },
  signOutLabel: {
    fontWeight: '700',
  },
});

export default DrawerContent;
