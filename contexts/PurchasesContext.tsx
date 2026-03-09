import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOfferings } from 'react-native-purchases';

const GRANDFATHER_IOS_MAX_BUILD = '1';
const GRANDFATHER_ANDROID_MAX_VERSION_CODE = '12';

const ENTITLEMENT_ID = 'pro';

function getRCApiKey(): string {
  if (__DEV__ || Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '';
  }
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  }) ?? '';
}

Purchases.configure({ apiKey: getRCApiKey() });

export const [PurchasesProvider, usePurchases] = createContextHook(() => {
  const queryClient = useQueryClient();

  const customerInfoQuery = useQuery<CustomerInfo>({
    queryKey: ['purchases', 'customerInfo'],
    queryFn: async () => {
      console.log('[Purchases] Fetching customer info');
      const info = await Purchases.getCustomerInfo();
      console.log('[Purchases] Customer info fetched, active entitlements:', Object.keys(info.entitlements.active));
      return info;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const offeringsQuery = useQuery<PurchasesOfferings>({
    queryKey: ['purchases', 'offerings'],
    queryFn: async () => {
      console.log('[Purchases] Fetching offerings');
      const offerings = await Purchases.getOfferings();
      console.log('[Purchases] Offerings fetched, current:', offerings.current?.identifier);
      return offerings;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });

  const { mutateAsync: purchaseMutateAsync, isPending: isPurchasing, error: purchaseError } = useMutation({
    mutationFn: async (packageToPurchase: import('react-native-purchases').PurchasesPackage) => {
      console.log('[Purchases] Purchasing package:', packageToPurchase.identifier);
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      console.log('[Purchases] Purchase successful');
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(['purchases', 'customerInfo'], customerInfo);
      void queryClient.invalidateQueries({ queryKey: ['purchases', 'customerInfo'] });
    },
    onError: (error) => {
      console.error('[Purchases] Purchase error:', error);
    },
  });

  const { mutateAsync: restoreMutateAsync, isPending: isRestoring, error: restoreError } = useMutation({
    mutationFn: async () => {
      console.log('[Purchases] Restoring purchases');
      const customerInfo = await Purchases.restorePurchases();
      console.log('[Purchases] Restore successful');
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(['purchases', 'customerInfo'], customerInfo);
      void queryClient.invalidateQueries({ queryKey: ['purchases', 'customerInfo'] });
    },
    onError: (error) => {
      console.error('[Purchases] Restore error:', error);
    },
  });

  const isGrandfathered = (() => {
    if (Platform.OS === 'web') return false;
    const info = customerInfoQuery.data as (CustomerInfo & { originalAppVersion?: string }) | undefined;
    const originalVersion = info?.originalAppVersion;
    if (!originalVersion) return false;
    console.log('[Purchases] originalAppVersion:', originalVersion);
    if (Platform.OS === 'ios') {
      const buildNum = parseInt(originalVersion, 10);
      const cutoff = parseInt(GRANDFATHER_IOS_MAX_BUILD, 10);
      if (!isNaN(buildNum) && !isNaN(cutoff)) {
        return buildNum <= cutoff;
      }
      return originalVersion <= GRANDFATHER_IOS_MAX_BUILD;
    }
    if (Platform.OS === 'android') {
      const versionCode = parseInt(originalVersion, 10);
      const cutoff = parseInt(GRANDFATHER_ANDROID_MAX_VERSION_CODE, 10);
      if (!isNaN(versionCode) && !isNaN(cutoff)) {
        return versionCode <= cutoff;
      }
      return false;
    }
    return false;
  })();

  const hasActiveEntitlement =
    customerInfoQuery.data?.entitlements.active[ENTITLEMENT_ID] !== undefined;

  const isSubscribed = hasActiveEntitlement || isGrandfathered;

  if (isGrandfathered) {
    const info = customerInfoQuery.data as (CustomerInfo & { originalAppVersion?: string }) | undefined;
    console.log('[Purchases] User is grandfathered in (originalAppVersion:', info?.originalAppVersion, ')');
  }

  const purchasePackage = useCallback(
    (pkg: import('react-native-purchases').PurchasesPackage) => {
      return purchaseMutateAsync(pkg);
    },
    [purchaseMutateAsync]
  );

  const restorePurchases = useCallback(() => {
    return restoreMutateAsync();
  }, [restoreMutateAsync]);

  return useMemo(() => ({
    isSubscribed,
    isGrandfathered,
    isLoadingCustomerInfo: customerInfoQuery.isLoading,
    customerInfo: customerInfoQuery.data ?? null,
    offerings: offeringsQuery.data ?? null,
    isLoadingOfferings: offeringsQuery.isLoading,
    purchasePackage,
    isPurchasing,
    purchaseError,
    restorePurchases,
    isRestoring,
    restoreError,
    refetchCustomerInfo: customerInfoQuery.refetch,
  }), [
    isSubscribed,
    isGrandfathered,
    customerInfoQuery.isLoading,
    customerInfoQuery.data,
    offeringsQuery.data,
    offeringsQuery.isLoading,
    purchasePackage,
    isPurchasing,
    purchaseError,
    restorePurchases,
    isRestoring,
    restoreError,
    customerInfoQuery.refetch,
  ]);
});
