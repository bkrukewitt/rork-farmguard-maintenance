import { getFarmLegacyProFromDb } from './supabase-server';

const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1';
/** Must match PurchasesContext / RevenueCat dashboard entitlement identifier. */
const ENTITLEMENT_ID = 'FarmGuard Maintenance Pro';

const GRANDFATHER_IOS_MAX_BUILD = '1';
const GRANDFATHER_ANDROID_MAX_VERSION_CODE = '15';
const GRANDFATHER_CUTOFF_DATE = '2026-03-15T00:00:00Z';

function getServerApiKey(): string {
  return process.env.REVENUECAT_SERVER_API_KEY ?? '';
}

interface RCEntitlement {
  expires_date: string | null;
  purchase_date: string;
  product_identifier: string;
}

interface RCSubscriberResponse {
  subscriber: {
    entitlements: Record<string, RCEntitlement>;
    original_app_user_id: string;
    original_application_version: string | null;
    original_purchase_date: string | null;
    first_seen: string;
  };
}

export interface SubscriptionStatus {
  isSubscribed: boolean;
  isGrandfathered: boolean;
  isTrial: boolean;
  hasAccess: boolean;
}

async function fetchSubscriberInfo(rcUserId: string): Promise<RCSubscriberResponse | null> {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    console.log('[RevenueCat] No server API key configured — skipping subscription check');
    return null;
  }

  try {
    console.log(`[RevenueCat] Fetching subscriber info for: ${rcUserId}`);
    const response = await fetch(`${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(rcUserId)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RevenueCat] API error ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json() as RCSubscriberResponse;
    console.log(`[RevenueCat] Subscriber info fetched for: ${rcUserId}`);
    return data;
  } catch (error) {
    console.error('[RevenueCat] Error fetching subscriber info:', error);
    return null;
  }
}

function checkGrandfathered(
  subscriber: RCSubscriberResponse['subscriber'],
  platform?: 'ios' | 'android',
): boolean {
  const originalVersion = subscriber.original_application_version;
  const originalPurchaseDate = subscriber.original_purchase_date;

  let grantedByBuild = false;
  let grantedByDate = false;

  if (originalVersion) {
    const buildNum = parseInt(originalVersion, 10);
    if (!isNaN(buildNum)) {
      if (platform === 'ios') {
        const cutoff = parseInt(GRANDFATHER_IOS_MAX_BUILD, 10);
        if (!isNaN(cutoff)) grantedByBuild = buildNum <= cutoff;
      } else if (platform === 'android') {
        const cutoff = parseInt(GRANDFATHER_ANDROID_MAX_VERSION_CODE, 10);
        if (!isNaN(cutoff)) grantedByBuild = buildNum <= cutoff;
      } else {
        const iosCutoff = parseInt(GRANDFATHER_IOS_MAX_BUILD, 10);
        const androidCutoff = parseInt(GRANDFATHER_ANDROID_MAX_VERSION_CODE, 10);
        grantedByBuild =
          (!isNaN(iosCutoff) && buildNum <= iosCutoff) ||
          (!isNaN(androidCutoff) && buildNum <= androidCutoff);
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

  if (grantedByBuild) console.log(`[RevenueCat] Grandfathered by build: ${originalVersion}`);
  if (grantedByDate) console.log(`[RevenueCat] Grandfathered by date: ${originalPurchaseDate}`);

  return grantedByBuild || grantedByDate;
}

function checkActiveEntitlement(subscriber: RCSubscriberResponse['subscriber']): boolean {
  const entitlement = subscriber.entitlements[ENTITLEMENT_ID];
  if (!entitlement) return false;

  if (!entitlement.expires_date) return true;

  const expiresAt = new Date(entitlement.expires_date).getTime();
  const now = Date.now();
  return expiresAt > now;
}

export async function verifySubscription(rcUserId: string | null | undefined): Promise<SubscriptionStatus> {
  if (!rcUserId) {
    console.log('[RevenueCat] No RC user ID provided — allowing access (graceful fallback)');
    return { isSubscribed: false, isGrandfathered: false, isTrial: false, hasAccess: true };
  }

  const apiKey = getServerApiKey();
  if (!apiKey) {
    console.log('[RevenueCat] No server API key — allowing access (not configured)');
    return { isSubscribed: false, isGrandfathered: false, isTrial: false, hasAccess: true };
  }

  const subscriberData = await fetchSubscriberInfo(rcUserId);
  if (!subscriberData) {
    console.log('[RevenueCat] Could not fetch subscriber data — allowing access (graceful fallback)');
    return { isSubscribed: false, isGrandfathered: false, isTrial: false, hasAccess: true };
  }

  const subscriber = subscriberData.subscriber;
  const isSubscribed = checkActiveEntitlement(subscriber);
  const isGrandfathered = checkGrandfathered(subscriber);

  const hasAccess = isSubscribed || isGrandfathered;

  console.log(`[RevenueCat] User ${rcUserId}: subscribed=${isSubscribed}, grandfathered=${isGrandfathered}, hasAccess=${hasAccess}`);

  return {
    isSubscribed,
    isGrandfathered,
    isTrial: false,
    hasAccess,
  };
}

export async function requireSubscription(rcUserId: string | null | undefined, farmId: string): Promise<void> {
  const legacyPro = await getFarmLegacyProFromDb(farmId);
  if (legacyPro) {
    console.log(`[RevenueCat] Farm ${farmId} has legacy Pro flag — allowing access`);
    return;
  }

  const status = await verifySubscription(rcUserId);

  if (status.hasAccess) {
    return;
  }

  const trialActive = await checkTrialStatus(farmId);
  if (trialActive) {
    console.log(`[RevenueCat] Farm ${farmId} has active trial — allowing access`);
    return;
  }

  console.log(`[RevenueCat] Access denied for user ${rcUserId} on farm ${farmId} — no subscription, grandfathering, or trial`);
  const { TRPCError } = await import('@trpc/server');
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'An active subscription is required to make changes. Please subscribe or start a free trial.',
  });
}

interface TrialRecord {
  farmId: string;
  startedAt: string;
  active: boolean;
}

const TRIAL_DURATION_DAYS = 14;

const DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

function getDbHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${DB_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function getDbKeyUrl(key: string): string {
  return `${DB_ENDPOINT}/${DB_NAMESPACE}/${encodeURIComponent(key)}`;
}

async function getTrialRecord(farmId: string): Promise<TrialRecord | null> {
  try {
    const url = getDbKeyUrl(`trial:${farmId}`);
    const response = await fetch(url, { headers: getDbHeaders() });
    if (!response.ok) return null;
    return (await response.json()) as TrialRecord;
  } catch {
    return null;
  }
}

async function setTrialRecord(farmId: string, record: TrialRecord): Promise<boolean> {
  try {
    const url = getDbKeyUrl(`trial:${farmId}`);
    const response = await fetch(url, {
      method: 'PUT',
      headers: getDbHeaders(),
      body: JSON.stringify(record),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkTrialStatus(farmId: string): Promise<boolean> {
  const record = await getTrialRecord(farmId);
  if (!record || !record.active) return false;

  const startedAt = new Date(record.startedAt).getTime();
  const now = Date.now();
  const elapsed = now - startedAt;
  const trialMs = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

  if (elapsed > trialMs) {
    console.log(`[Trial] Trial expired for farm: ${farmId}`);
    await setTrialRecord(farmId, { ...record, active: false });
    return false;
  }

  console.log(`[Trial] Trial active for farm: ${farmId}, days remaining: ${Math.ceil((trialMs - elapsed) / (24 * 60 * 60 * 1000))}`);
  return true;
}

export async function startTrial(farmId: string): Promise<{ success: boolean; alreadyUsed: boolean }> {
  const existing = await getTrialRecord(farmId);
  if (existing) {
    console.log(`[Trial] Farm ${farmId} already has a trial record — cannot restart`);
    return { success: false, alreadyUsed: true };
  }

  const record: TrialRecord = {
    farmId,
    startedAt: new Date().toISOString(),
    active: true,
  };

  const saved = await setTrialRecord(farmId, record);
  console.log(`[Trial] Trial ${saved ? 'started' : 'failed to start'} for farm: ${farmId}`);
  return { success: saved, alreadyUsed: false };
}

export async function getTrialInfo(farmId: string): Promise<{ active: boolean; daysRemaining: number; alreadyUsed: boolean }> {
  const record = await getTrialRecord(farmId);
  if (!record) return { active: false, daysRemaining: 0, alreadyUsed: false };

  if (!record.active) return { active: false, daysRemaining: 0, alreadyUsed: true };

  const startedAt = new Date(record.startedAt).getTime();
  const now = Date.now();
  const elapsed = now - startedAt;
  const trialMs = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const remaining = trialMs - elapsed;

  if (remaining <= 0) {
    await setTrialRecord(farmId, { ...record, active: false });
    return { active: false, daysRemaining: 0, alreadyUsed: true };
  }

  return {
    active: true,
    daysRemaining: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
    alreadyUsed: false,
  };
}
