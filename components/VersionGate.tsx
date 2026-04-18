import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import Constants from 'expo-constants';
import { trpc } from '@/lib/trpc';
import colors from '@/constants/colors';
import { BUNDLED_MIN_SUPPORTED_VERSION } from '@/constants/minAppVersion';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

function compareVersions(current: string, minimum: string): number {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const c = parse(current);
  const m = parse(minimum);
  const len = Math.max(c.length, m.length);
  for (let i = 0; i < len; i++) {
    const diff = (c[i] ?? 0) - (m[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface VersionGateProps {
  children: React.ReactNode;
}

export default function VersionGate({ children }: VersionGateProps) {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const [fadeAnim] = useState(new Animated.Value(0));

  const { data, isLoading, isError, refetch } = trpc.farm.getMinVersion.useQuery(undefined, {
    staleTime: 1000 * 60 * 10,
    retry: 3,
    initialData: { minVersion: BUNDLED_MIN_SUPPORTED_VERSION },
  });

  const isOutdated =
    data?.minVersion != null && compareVersions(currentVersion, data.minVersion) < 0;

  useEffect(() => {
    if (!isLoading && isOutdated) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, isOutdated, fadeAnim]);

  if (isError) {
    console.warn('[VersionGate] Could not fetch min version, allowing through');
    return <>{children}</>;
  }

  if (isOutdated) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <AlertTriangle size={48} color={colors.warning} strokeWidth={1.5} />
          </View>

          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.subtitle}>
            You&apos;re running version{' '}
            <Text style={styles.versionBadge}>{currentVersion}</Text>
          </Text>
          <Text style={styles.body}>
            FarmGuard Maintenance requires version{' '}
            <Text style={styles.minVersion}>{data?.minVersion}</Text> or newer.
            {'\n\n'}Please update the app to continue syncing with your farm.
          </Text>

          <TouchableOpacity
            style={styles.updateButton}
            activeOpacity={0.85}
            onPress={() => {
              const url =
                Platform.OS === 'ios'
                  ? 'https://apps.apple.com/app/id6746048789'
                  : 'https://play.google.com/store/apps/details?id=app.rork.farmguardmaintenance';
              Linking.openURL(url).catch(() =>
                console.warn('[VersionGate] Could not open store URL')
              );
            }}
          >
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.7}
            onPress={() => refetch()}
          >
            <RefreshCw size={14} color={colors.textSecondary} />
            <Text style={styles.retryText}>Check Again</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerVersion}>Current version: {currentVersion}</Text>
      </Animated.View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEF9E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#F9E79F',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  versionBadge: {
    fontWeight: '600' as const,
    color: colors.danger,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  minVersion: {
    fontWeight: '700' as const,
    color: colors.primary,
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerVersion: {
    marginTop: 24,
    fontSize: 12,
    color: colors.textLight,
  },
});
