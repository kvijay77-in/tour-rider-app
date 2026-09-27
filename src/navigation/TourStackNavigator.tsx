/**
 * Tour stack nested inside drawer navigation.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';

import { COLORS } from '../constants';
import { TourScreen } from '../screens/tour/TourScreen';
import { RideDetailsScreen } from '../screens/tour/RideDetailsScreen';
import type { TourStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<TourStackParamList>();

export function TourStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TourRides"
        component={TourScreen}
        options={({ navigation }) => ({
          title: 'Tour',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
            >
              <Ionicons name="menu" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{
          title: 'Ride Details',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
});

export default TourStackNavigator;
