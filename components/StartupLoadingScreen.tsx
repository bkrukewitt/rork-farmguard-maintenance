import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Shield } from 'lucide-react-native';

/**
 * Shown after the native splash is dismissed while subscription / startup work finishes.
 * Keeps the same dark green brand as the paywall so the transition feels intentional.
 */
export default function StartupLoadingScreen() {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="FarmGuard is loading"
    >
      <View style={styles.iconRing}>
        <Shield size={36} color="#FFFFFF" strokeWidth={1.5} />
      </View>
      <Text style={styles.appName}>FarmGuard</Text>
      <ActivityIndicator size="large" color="#FFDE00" style={styles.spinner} />
      <Text style={styles.hint}>Starting up…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A2E10',
    paddingHorizontal: 32,
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#367C2B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFDE00',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  spinner: {
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
