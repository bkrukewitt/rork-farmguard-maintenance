import React, { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import { useAdminAccess } from '@/contexts/AdminAccessContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function AdminTabScreen() {
  const { isSuperAdmin } = useAdminAccess();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isSuperAdmin) {
      router.replace('/(tabs)/settings' as never);
    }
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Redirect href="/(tabs)/settings" />
      </View>
    );
  }

  return <SuperAdminPanel />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
