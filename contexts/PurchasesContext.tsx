import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { CustomerInfo, PurchasesOfferings } from 'react-native-purchases';
import { trpcClient } from '@/lib/trpc';

const GRANDFATHER_IOS_MAX_BUILD = '1';
const GRANDFATHER_ANDROID_MAX_VERSION_CODE = '15';
const GRANDFATHER_CUTOFF_DATE = '2026-03-15T00:00:00Z';

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

const rcApiKey = getRCApiKey();
console.log('[Purchases] Platform:', Platform.OS, '| __DEV__:', __DEV__);
console.log('[Purchases] API key present:', rcApiKey.length > 0, '| Prefix:', rcApiKey.substring(0, 8) || '(empty)');

Purchases.configure({ apiKey: rcApiKey });

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
      console.log('[Purchases] Fetching offerings...');
      try {
        const offerings = await Purchases.getOfferings();
        console.log('[Purchases] Offerings fetched successfully');
        console.log('[Purchases] Current offering:', offerings.current?.identifier ?? '(none)');
        console.log('[Purchases] All offering keys:', Object.keys(offerings.all));
        if (offerings.current) {
          console.log('[Purchases] Available packages:', offerings.current.availablePackages.map(p => p.identifier));
        } else {
          console.warn('[Purchases] No current offering found — check RevenueCat dashboard that an offering is set as current');
        }
        return offerings;
      } catch (err) {
        console.error('[Purchases] getOfferings error:', err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });

  const { mutateAsync: purchaseMutateAsync, isPending: isPurchasing, error: purchaseError } = useMutation({
    mutationFn: async (packageToPurchase: import('react-native-purchases').PurchasesPackage) => {
      console.log('[Purchases] Purchasing package:', packageToPurchase.identifier);
      try {
        const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
        console.log('[Purchases] Purchase successful');
        return customerInfo;
      } catch (err: unknown) {
        const error = err as { userCancelled?: boolean; code?: string; message?: string };
        if (error?.userCancelled) {
          console.log('[Purchases] User cancelled purchase');
          return null;
        }
        throw err;
      }
    },
    onSuccess: (customerInfo) => {
      if (customerInfo) {
        console.log('[Purchases] Setting customer info after purchase, entitlements:', Object.keys(customerInfo.entitlements.active));
        queryClient.setQueryData(['purchases', 'customerInfo'], customerInfo);
      }
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
      console.log('[Purchases] Setting customer info after restore, entitlements:', Object.keys(customerInfo.entitlements.active));
      queryClient.setQueryData(['purchases', 'customerInfo'], customerInfo);
    },
    onError: (error) => {
      console.error('[Purchases] Restore error:', error);
    },
  });

  const isGrandfathered = (() => {
    if (Platform.OS === 'web') return false;
    const info = customerInfoQuery.data as (CustomerInfo & { originalAppVersion?: string; originalPurchaseDate?: string }) | undefined;
    if (!info) return false;

    const originalVersion = info.originalAppVersion;
    const originalPurchaseDate = info.originalPurchaseDate;

    console.log('[Purchases] originalAppVersion:', originalVersion);
    console.log('[Purchases] originalPurchaseDate:', originalPurchaseDate);

    let grantedByBuild = false;
    let grantedByDate = false;

    if (originalVersion) {
      if (Platform.OS === 'ios') {
        const buildNum = parseInt(originalVersion, 10);
        const cutoff = parseInt(GRANDFATHER_IOS_MAX_BUILD, 10);
        if (!isNaN(buildNum) && !isNaN(cutoff)) {
          grantedByBuild = buildNum <= cutoff;
        }
      } else if (Platform.OS === 'android') {
        const versionCode = parseInt(originalVersion, 10);
        const cutoff = parseInt(GRANDFATHER_ANDROID_MAX_VERSION_CODE, 10);
        if (!isNaN(versionCode) && !isNaN(cutoff)) {
          grantedByBuild = versionCode <= cutoff;
        }
      }
    }

    if (originalPurchaseDate) {
      const purchaseTime = new Date(originalPurchaseDate).getTime();
      const cutoffTime = new Date(GRANDFATHER_CUTOFF_DATE).getTime();
      if (!isNaN(purchaseTime) && !isNaN(cutoffTime)) {
        grantedByDate = purchaseTime < cutoffTime;
      }
    }

    if (grantedByBuild) console.log('[Purchases] Grandfathered by build number:', originalVersion);
    if (grantedByDate) console.log('[Purchases] Grandfathered by purchase date:', originalPurchaseDate);

    return grantedByBuild || grantedByDate;
  })();

  const hasActiveEntitlement =
    customerInfoQuery.data?.entitlements.active[ENTITLEMENT_ID] !== undefined;

  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [rcUserId, setRcUserId] = useState<string | null>(null);

  const isSubscribed = hasActiveEntitlement || isGrandfathered;

  if (isGrandfathered) {
    console.log('[Purchases] User is grandfathered — full access granted');
  }

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void Purchases.getAppUserID().then(id => {
        console.log('[Purchases] RC User ID:', id);
        setRcUserId(id);
      }).catch(() => {});
    }
  }, [customerInfoQuery.data]);

  const startTrial = useCallback(async (farmId: string) => {
    try {
      const result = await trpcClient.farm.startTrial.mutate({ farmId });
      if (result.success) {
        setIsTrial(true);
        setTrialDaysRemaining(14);
        await AsyncStorage.setItem('farmguard_trial_active', 'true');
        console.log('[Purchases] Server-side trial started for farm:', farmId);
      } else if (result.alreadyUsed) {
        console.log('[Purchases] Trial already used for farm:', farmId);
        await AsyncStorage.removeItem('farmguard_trial_active');
        setIsTrial(false);
      }
      return result;
    } catch (error) {
      console.error('[Purchases] Error starting trial:', error);
      await AsyncStorage.setItem('farmguard_trial_active', 'true');
      setIsTrial(true);
      return { success: true, alreadyUsed: false };
    }
  }, []);

  const checkTrialStatus = useCallback(async (farmId: string) => {
    try {
      const info = await trpcClient.farm.getTrialInfo.query({ farmId });
      setIsTrial(info.active);
      setTrialDaysRemaining(info.daysRemaining);
      if (info.active) {
        await AsyncStorage.setItem('farmguard_trial_active', 'true');
      } else {
        await AsyncStorage.removeItem('farmguard_trial_active');
      }
      console.log(`[Purchases] Trial status: active=${info.active}, days=${info.daysRemaining}, used=${info.alreadyUsed}`);
      return info;
    } catch (error) {
      console.error('[Purchases] Error checking trial status:', error);
      const localTrial = await AsyncStorage.getItem('farmguard_trial_active');
      setIsTrial(localTrial === 'true');
      return { active: localTrial === 'true', daysRemaining: 0, alreadyUsed: false };
    }
  }, []);

  const endTrial = useCallback(async () => {
    await AsyncStorage.removeItem('farmguard_trial_active');
    setIsTrial(false);
    setTrialDaysRemaining(0);
    console.log('[Purchases] Free trial ended');
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem('farmguard_trial_active').then(val => {
      if (val === 'true') setIsTrial(true);
    });
  }, []);

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
    isTrial,
    trialDaysRemaining,
    rcUserId,
    startTrial,
    checkTrialStatus,
    endTrial,
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
    isTrial,
    trialDaysRemaining,
    rcUserId,
    startTrial,
    checkTrialStatus,
    endTrial,
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


