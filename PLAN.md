# Add server-side RevenueCat subscription verification


## Overview
Add server-side subscription and grandfathering verification so the backend can confirm a user's subscription status before allowing data writes — preventing anyone from bypassing the paywall by tampering with client-side values.

---

### What will change

**1. New server-side subscription check** ✅
- [x] Backend calls RevenueCat's REST API to verify active subscription or grandfathered status
- [x] Check runs before every data-writing tRPC operation (add/edit/delete equipment, logs, consumables, routines, work orders, etc.)
- [x] Read-only operations (getData, getMemberCount, getMinVersion) remain unrestricted
- [x] Graceful fallback: if RevenueCat API key isn't configured or API is unreachable, access is allowed (no lockout)

**2. App sends its RevenueCat user ID with write requests** ✅
- [x] All tRPC mutation inputs now accept optional `rcUserId` field
- [x] PurchasesContext fetches and exposes the RevenueCat anonymous user ID via `Purchases.getAppUserID()`
- [x] New `checkSubscription` tRPC endpoint combines subscription + trial status in one call

**3. Trial verification moves server-side** ✅
- [x] Trial records stored in RorkDB (`trial:{farmId}`) with start date and active flag
- [x] 14-day trial duration enforced server-side — cannot be restarted by clearing app data
- [x] New tRPC endpoints: `startTrial`, `getTrialInfo`
- [x] PurchasesContext updated to use server-side trial endpoints instead of local AsyncStorage flag
- [x] TrialBanner now shows days remaining
- [x] Paywall `startTrial` now calls server-side endpoint

**4. Grandfathering verified on server** ✅
- [x] Server checks RevenueCat's `original_application_version` and `original_purchase_date`
- [x] Same cutoff logic as client-side (iOS build <= 1, Android versionCode <= 12, date < 2026-03-09)
- [x] Verified server-side so it can't be spoofed by client

---

### What stays the same
- The app still uses the RevenueCat SDK for displaying paywalls and making purchases
- The user experience doesn't change — subscribed/grandfathered users won't notice anything
- Free trial flow remains the same from the user's perspective

---

### Files changed

| File | Change |
|------|--------|
| `backend/utils/revenuecat.ts` | **New** — Server-side RevenueCat API client, subscription verification, trial management |
| `backend/trpc/routes/farm.ts` | **Modified** — Added `rcUserId` to all mutations, `requireSubscription` check, new trial/subscription endpoints |
| `contexts/PurchasesContext.tsx` | **Modified** — Server-side trial, RC user ID exposure, `checkTrialStatus` |
| `components/Paywall.tsx` | **Modified** — Uses farmId for server-side trial start |
| `components/TrialBanner.tsx` | **Modified** — Shows trial days remaining |

---

### Setup required from you
1. **Rotate your RevenueCat secret key** (since the old one was exposed in chat)
2. **Add the new key** as a server environment variable named `REVENUECAT_SERVER_API_KEY`
