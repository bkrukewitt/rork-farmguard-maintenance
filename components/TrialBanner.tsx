import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lock } from 'lucide-react-native';
import { usePurchases } from '@/contexts/PurchasesContext';
import { useFarmData } from '@/contexts/FarmDataContext';
import PaywallModal from '@/components/PaywallModal';
import { TRIAL_LIMITS } from '@/constants/trialLimits';

interface TrialBannerProps {
  message?: string;
}

export default function TrialBanner({ message }: TrialBannerProps) {
  const { isTrial, isSubscribed, trialDaysRemaining } = usePurchases();
  const { isDemoMode } = useFarmData();
  const [showPaywall, setShowPaywall] = useState(false);

  if (isSubscribed) return null;
  if (!isTrial && !isDemoMode) return null;

  const defaultMessage = isDemoMode
    ? `Sample farm — try the app (max ${TRIAL_LIMITS.MAX_EQUIPMENT} machines, ${TRIAL_LIMITS.MAX_MAINTENANCE_LOGS} logs).`
    : trialDaysRemaining > 0
      ? `Free trial — ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left. Up to ${TRIAL_LIMITS.MAX_EQUIPMENT} machines & ${TRIAL_LIMITS.MAX_MAINTENANCE_LOGS} logs.`
      : `Limited access — up to ${TRIAL_LIMITS.MAX_EQUIPMENT} machines & ${TRIAL_LIMITS.MAX_MAINTENANCE_LOGS} logs. Subscribe for unlimited.`;

  return (
    <>
      <View style={styles.container}>
        <Lock size={16} color="#92400E" />
        <Text style={styles.text}>
          {message ?? defaultMessage}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowPaywall(true)}
        >
          <Text style={styles.buttonText}>Subscribe</Text>
        </TouchableOpacity>
      </View>
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </>
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
