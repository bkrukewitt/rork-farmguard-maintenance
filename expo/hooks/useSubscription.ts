import { useCallback, useMemo } from 'react';
import { usePurchases } from '@/contexts/PurchasesContext';

const ENTITLEMENT_ID = 'FarmGuard Maintenance Pro';

export interface SubscriptionStatus {
  isProUser: boolean;
  hasEntitlement: boolean;
  grandfathered: boolean;
  productIdentifier: string | null;
  expirationDate: string | null;
  willRenew: boolean | null;
  isRestoring: boolean;
  restore: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

export function useSubscription(): SubscriptionStatus {
  const {
    customerInfo,
    isGrandfathered,
    isRestoring,
    restorePurchases,
    refetchCustomerInfo,
  } = usePurchases();

  const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  const hasEntitlement = Boolean(entitlement);
  const grandfathered = Boolean(isGrandfathered);
  const isProUser = grandfathered || hasEntitlement;

  const productIdentifier =
    entitlement?.productIdentifier ??
    (customerInfo?.activeSubscriptions?.[0] ?? null);

  const expirationDate = entitlement?.expirationDate ?? null;
  const willRenew =
    typeof entitlement?.willRenew === 'boolean' ? entitlement.willRenew : null;

  const restore = useCallback(async () => {
    await restorePurchases();
  }, [restorePurchases]);

  const refresh = useCallback(async () => {
    return await refetchCustomerInfo();
  }, [refetchCustomerInfo]);

  return useMemo(
    () => ({
      isProUser,
      hasEntitlement,
      grandfathered,
      productIdentifier,
      expirationDate,
      willRenew,
      isRestoring,
      restore,
      refresh,
    }),
    [
      isProUser,
      hasEntitlement,
      grandfathered,
      productIdentifier,
      expirationDate,
      willRenew,
      isRestoring,
      restore,
      refresh,
    ],
  );
}
