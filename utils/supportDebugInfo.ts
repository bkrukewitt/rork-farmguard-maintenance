import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { CustomerInfo } from 'react-native-purchases';

export interface SupportDebugSnapshot {
  farmId: string;
  deviceId: string;
  displayName: string;
  memberCount: number;
  lastSyncTime: number | string | null;
  equipmentCount: number;
  maintenanceLogsCount: number;
  consumablesCount: number;
  intervalsCount: number;
  serviceRoutinesCount: number;
  inspectionRoutinesCount: number;
  isDemoMode: boolean;
  rcUserId: string | null;
  isSubscribed: boolean;
  isGrandfathered: boolean;
  isFarmLegacyPro: boolean;
  isTrial: boolean;
  trialDaysRemaining: number;
  customerInfo: CustomerInfo | null;
  isLoadingCustomerInfo: boolean;
}

export function buildSupportDebugText(snapshot: SupportDebugSnapshot): string {
  const appVersion = Constants.expoConfig?.version ?? '(unknown)';
  const nativeBuild =
    Constants.nativeBuildVersion ??
    (Platform.OS === 'ios' ? Constants.platform?.ios?.buildNumber : Constants.platform?.android?.versionCode) ??
    '(unknown)';

  const info = snapshot.customerInfo as (CustomerInfo & {
    originalAppVersion?: string;
    originalPurchaseDate?: string;
  }) | null;

  const activeEntitlements = info
    ? Object.keys(info.entitlements?.active ?? {}).join(', ') || '(none)'
    : snapshot.isLoadingCustomerInfo
      ? '(loading)'
      : '(none)';

  const lines = [
    '--- FarmGuard support debug ---',
    `Platform: ${Platform.OS}`,
    `App version: ${appVersion}`,
    `Native build: ${nativeBuild}`,
    `Farm ID: ${snapshot.farmId || '(none)'}`,
    `Device ID: ${snapshot.deviceId || '(none)'}`,
    `Display name: ${snapshot.displayName || '(none)'}`,
    `Member count: ${snapshot.memberCount}`,
    `Last sync: ${
      snapshot.lastSyncTime
        ? typeof snapshot.lastSyncTime === 'number'
          ? new Date(snapshot.lastSyncTime).toLocaleString()
          : snapshot.lastSyncTime
        : 'Never'
    }`,
    `Demo mode: ${snapshot.isDemoMode ? 'yes' : 'no'}`,
    '--- Subscription ---',
    `RC App User ID: ${snapshot.rcUserId || '(none)'}`,
    `Subscribed (app gate): ${snapshot.isSubscribed ? 'yes' : 'no'}`,
    `Grandfathered (device/RC): ${snapshot.isGrandfathered ? 'yes' : 'no'}`,
    `Legacy Pro (farm flag): ${snapshot.isFarmLegacyPro ? 'yes' : 'no'}`,
    `Trial active: ${snapshot.isTrial ? 'yes' : 'no'}`,
    `Trial days remaining: ${snapshot.trialDaysRemaining}`,
    `RC original app version: ${info?.originalAppVersion ?? '(none)'}`,
    `RC original purchase date: ${info?.originalPurchaseDate ?? '(none)'}`,
    `RC active entitlements: ${activeEntitlements}`,
    '--- Data counts ---',
    `Equipment: ${snapshot.equipmentCount}`,
    `Maintenance logs: ${snapshot.maintenanceLogsCount}`,
    `Consumables: ${snapshot.consumablesCount}`,
    `Intervals: ${snapshot.intervalsCount}`,
    `Service routines: ${snapshot.serviceRoutinesCount}`,
    `Inspection routines: ${snapshot.inspectionRoutinesCount}`,
  ];

  return lines.join('\n');
}
