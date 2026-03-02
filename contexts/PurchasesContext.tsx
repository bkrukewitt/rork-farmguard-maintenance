import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOfferings } from 'react-native-purchases';

const ENTITLEMENT_ID = 'FarmGuard Maintenance Pro';

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
      queryClient.invalidateQueries({ queryKey: ['purchases', 'customerInfo'] });
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
      queryClient.invalidateQueries({ queryKey: ['purchases', 'customerInfo'] });
    },
    onError: (error) => {
      console.error('[Purchases] Restore error:', error);
    },
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active[ENTITLEMENT_ID] !== undefined;

  const purchasePackage = useCallback(
    (pkg: import('react-native-purchases').PurchasesPackage) => {
      return purchaseMutateAsync(pkg);
    },
    [purchaseMutateAsync]
  );

  const restorePurchases = useCallback(() => {
    return restoreMutateAsync();
  }, [restoreMutateAsync]);

  return {
    isSubscribed,
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
  };
});
