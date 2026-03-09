import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lock } from 'lucide-react-native';
import { usePurchases } from '@/contexts/PurchasesContext';

interface TrialBannerProps {
  message?: string;
}

export default function TrialBanner({ message }: TrialBannerProps) {
  const { isTrial, isSubscribed, endTrial } = usePurchases();

  if (!isTrial || isSubscribed) return null;

  return (
    <View style={styles.container}>
      <Lock size={16} color="#92400E" />
      <Text style={styles.text}>
        {message ?? 'Preview mode — subscribe to add and manage data.'}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          void endTrial();
        }}
      >
        <Text style={styles.buttonText}>Subscribe</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B30',
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500' as const,
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
