/**
 * Home screen with profile summary, quick navigation cards, and announcements placeholder.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProfileSummaryCard } from '../../components/home/ProfileSummaryCard';
import { HomeSectionCard } from '../../components/home/HomeSectionCard';
import { useRider } from '../../hooks/useRider';

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

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const incomingMessage = route.params?.successMessage;
    if (!incomingMessage) {
      return;
    }

    setSuccessMessage(incomingMessage);
    navigation.setParams?.({ successMessage: undefined });

    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation, route.params?.successMessage]);

  if (isLoading && !profile) {
    return <LoadingSpinner message="Loading home..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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

        <View style={styles.rowThree}>
          <Card style={styles.newsCard}>
            <Ionicons name="construct-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.newsTitle}>Announcements & News</Text>
            <Text style={styles.newsSubtitle}>Under Construction</Text>
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
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
    flex: 3,
    minHeight: 150,
  },
  rowTwo: {
    flex: 2,
    minHeight: 130,
    flexDirection: 'row',
    gap: 12,
  },
  rowThree: {
    flex: 5,
    minHeight: 220,
  },
  newsCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: 10,
  },
  newsTitle: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  newsSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default HomeScreen;
