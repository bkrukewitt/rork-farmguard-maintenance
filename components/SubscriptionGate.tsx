import React from 'react';
import { usePurchases } from '@/contexts/PurchasesContext';
import { useFarmData } from '@/contexts/FarmDataContext';
import Paywall from '@/components/Paywall';
import StartupLoadingScreen from '@/components/StartupLoadingScreen';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isSubscribed, isLoadingCustomerInfo, isTrial } = usePurchases();
  const { isDemoMode } = useFarmData();

  console.log('[SubscriptionGate] isSubscribed:', isSubscribed, 'isTrial:', isTrial, 'isDemoMode:', isDemoMode, 'isLoading:', isLoadingCustomerInfo);

  if (isLoadingCustomerInfo) {
    return <StartupLoadingScreen />;
  }

  if (!isSubscribed && !isTrial && !isDemoMode) {
    return <Paywall />;
  }

  return <>{children}</>;
}
