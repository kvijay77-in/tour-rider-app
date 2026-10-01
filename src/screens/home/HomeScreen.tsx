/**
 * Home screen with profile summary, quick navigation cards, and latest notifications.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProfileSummaryCard } from '../../components/home/ProfileSummaryCard';
import { HomeSectionCard } from '../../components/home/HomeSectionCard';
import { SelfCheckInPanel } from '../../components/checkin/SelfCheckInPanel';
import { useRider } from '../../hooks/useRider';
import { useNotifications } from '../../hooks/useNotifications';
import { getRelativeTime } from '../../utils/dateFormatter';

interface HomeNavigation {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  setParams?: (params: { successMessage?: string }) => void;
}

interface HomeRoute {
  params?: {
    successMessage?: string;
  };
}

interface Props {
  navigation: HomeNavigation;
  route?: HomeRoute;
}

export function HomeScreen({ navigation, route }: Props) {
  const { profile, isLoading } = useRider();
  const { latestItems } = useNotifications();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const incomingMessage = route?.params?.successMessage;
    if (!incomingMessage) {
      return;
    }

    setSuccessMessage(incomingMessage);
    navigation.setParams?.({ successMessage: undefined });

    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation, route?.params?.successMessage]);

  if (isLoading && !profile) {
    return <LoadingSpinner message="Loading home..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {successMessage ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{successMessage}</Text>
          </View>
        ) : null}

        <View style={styles.rowOne}>
          <ProfileSummaryCard
            profile={profile}
            onPress={() => navigation.navigate('ViewProfile')}
          />
        </View>

        <View style={styles.rowTwo}>
          <HomeSectionCard
            title="Training Challenge"
            subtitle="Track your prep journey"
            imageSource={require('../../../assets/TC_2026.jpg')}
            onPress={() => navigation.navigate('TrainingChallenge')}
          />
          <HomeSectionCard
            title="Tour"
            subtitle="ToT 2026"
            imageSource={require('../../../assets/rideplan-2026.png')}
            onPress={() => navigation.navigate('Tour')}
          />
        </View>

        <SelfCheckInPanel />

        <View style={styles.rowThree}>
          <Card style={styles.newsCard}>
            <View style={styles.newsHeader}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
              <Text style={styles.newsTitle}>Latest Notifications</Text>
            </View>

            {latestItems.length ? latestItems.map((item) => (
              <View key={item.notificationId} style={styles.notificationRow}>
                <View style={styles.notificationTextBlock}>
                  <Text style={styles.notificationTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.notificationBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
                <Text style={styles.notificationTime}>{getRelativeTime(item.createdAt)}</Text>
              </View>
            )) : (
              <Text style={styles.newsSubtitle}>No notifications yet.</Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open notifications inbox"
              onPress={() => navigation.navigate('Notifications')}
              style={({ pressed }) => [styles.newsLinkButton, pressed ? styles.newsLinkPressed : null]}
            >
              <Text style={styles.newsLink}>Open notifications inbox</Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  banner: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bannerText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '600',
  },
  rowOne: {
    flexShrink: 0,
    minHeight: 150,
  },
  rowTwo: {
    flexShrink: 0,
    minHeight: 130,
    flexDirection: 'row',
    gap: 12,
  },
  rowThree: {
    flexShrink: 0,
    minHeight: 220,
  },
  newsCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsTitle: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  newsSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  notificationRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    gap: 4,
  },
  notificationTextBlock: {
    gap: 2,
  },
  notificationTitle: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  notificationBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.textDisabled,
  },
  newsLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  newsLinkButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  newsLinkPressed: {
    opacity: 0.7,
  },
});

export default HomeScreen;
