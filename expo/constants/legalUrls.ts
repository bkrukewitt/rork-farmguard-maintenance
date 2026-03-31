/**
 * Apple requires functional Privacy + Terms links on the subscription screen.
 * Defaults point at hosted Flycricket docs; override with EXPO_PUBLIC_* in EAS / .env if URLs change.
 */
const DEFAULT_PRIVACY_POLICY_URL =
  'https://doc-hosting.flycricket.io/farmguard-maintenance-privacy-policy/cd2cbf42-014b-4999-8cf8-69114b25eb0a/privacy';
const DEFAULT_TERMS_OF_USE_URL =
  'https://doc-hosting.flycricket.io/farmguard-terms/747aa982-c8a8-4bfa-8ed9-1386353619a1/terms';

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || DEFAULT_PRIVACY_POLICY_URL;
export const TERMS_OF_USE_URL =
  process.env.EXPO_PUBLIC_TERMS_OF_USE_URL?.trim() || DEFAULT_TERMS_OF_USE_URL;

/** Display name for subscription disclosure (align with App Store / RevenueCat entitlement copy). */
export const SUBSCRIPTION_DISPLAY_NAME = 'FarmGuard Maintenance Pro';
