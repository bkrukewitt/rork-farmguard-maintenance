import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { usePurchases } from '@/contexts/PurchasesContext';
import Paywall from '@/components/Paywall';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isSubscribed, isLoadingCustomerInfo } = usePurchases();

  if (isLoadingCustomerInfo) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#367C2B" />
      </View>
    );
  }

  if (!isSubscribed) {
    return <Paywall />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A2E10',
  },
});
