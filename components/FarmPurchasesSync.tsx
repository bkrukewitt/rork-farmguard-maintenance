import { useEffect } from 'react';
import { useFarmData } from '@/contexts/FarmDataContext';
import { usePurchases } from '@/contexts/PurchasesContext';

/**
 * When the user joins or switches farms, refresh server-side trial + farm legacy Pro flags.
 */
export default function FarmPurchasesSync() {
  const { farmId, isDemoMode } = useFarmData();
  const { refreshFarmAccess } = usePurchases();

  useEffect(() => {
    if (!farmId || isDemoMode) {
      void refreshFarmAccess(null);
      return;
    }
    void refreshFarmAccess(farmId);
  }, [farmId, isDemoMode, refreshFarmAccess]);

  return null;
}
