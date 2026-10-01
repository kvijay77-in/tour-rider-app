/** Event list and event details stack nested in the active drawer. */

import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';

import { COLORS } from '../constants';
import { EventsScreen } from '../screens/events/EventsScreen';
import { EventDetailsScreen } from '../screens/events/EventDetailsScreen';
import type { EventsStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<EventsStackParamList>();

export function EventsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="EventsList"
        component={EventsScreen}
        options={({ navigation }) => ({
          title: 'Events',
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
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ title: 'Event details' }}
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

export default EventsStackNavigator;