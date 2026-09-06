import { useEffect } from 'react';
import { useFarmData } from '@/contexts/FarmDataContext';
import { usePurchases } from '@/contexts/PurchasesContext';

/**
 * When the user joins or switches farms, refresh server-side trial + farm legacy Pro flags.
 * Also clears leftover demo mode after a successful subscribe.
 */
export default function FarmPurchasesSync() {
  const { farmId, isDemoMode, exitDemoMode } = useFarmData();
  const { refreshFarmAccess, isSubscribed } = usePurchases();

  useEffect(() => {
    if (!farmId || isDemoMode) {
      void refreshFarmAccess(null);
      return;
    }
    void refreshFarmAccess(farmId);
  }, [farmId, isDemoMode, refreshFarmAccess]);

  useEffect(() => {
    if (isSubscribed && isDemoMode) {
      void exitDemoMode();
    }
  }, [isSubscribed, isDemoMode, exitDemoMode]);

  return null;
}
