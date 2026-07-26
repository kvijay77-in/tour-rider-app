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

import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={styles.footer}>
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
    paddingTop: 0,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
  },
  signOutItem: {
    marginTop: 0,
  },
  signOutLabel: {
    fontWeight: '700',
  },
});

export default DrawerContent;
