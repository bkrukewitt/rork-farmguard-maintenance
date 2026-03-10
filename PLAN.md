# Security Hardening — All Issues

## Overview

Address all 10 security vulnerabilities identified in the audit, while keeping the current farm password approach and enforcing it server-side.

---

### 🔴 Critical Fixes

**1. Add server-side farm password verification to API routes** ✅

- [x] Every tRPC procedure that reads or writes farm data requires a `farmPassword` field in addition to `farmId`
- [x] The server fetches the stored password from Supabase and compares it before allowing the request
- [x] If the password doesn't match, the request is rejected with an "Unauthorized" error
- [x] The `getMinVersion` endpoint stays public (no password needed)
- [x] New `verifyFarmPassword` endpoint added so clients never receive the actual password

**2. Restrict CORS to your app's domain only** ✅

- [x] CORS restricted to `rork.app`, `preview.rork.app`, and the API base URL
- [x] Only `GET`, `POST`, `OPTIONS` methods allowed
- [x] Max-age set to 24 hours for preflight caching

**3. Farm ID no longer acts as sole access control** ✅

- [x] Server-side password enforcement means knowing a farm ID alone is not enough
- [x] Password verification happens on the server — never exposed to the client

---

### 🟠 Medium Fixes

**4. Add rate limiting to the API** ✅

- [x] In-memory rate limiter: 60 requests/minute per client IP
- [x] Returns 429 status with retry headers when exceeded
- [x] Auto-cleanup of expired entries every 60 seconds

**5. Enforce subscription/trial status server-side** ⚠️ (Requires additional setup)

- [ ] Needs RevenueCat server-side API key (not currently configured)
- [ ] Would require adding `REVENUECAT_SERVER_API_KEY` env var
- [ ] Once configured, the server can validate receipts before allowing writes
- Note: This is a future enhancement that requires RevenueCat REST API integration

**6. Strengthen grandfathering logic** ⚠️ (Requires additional setup)

- [ ] Same dependency as #5 — needs server-side RevenueCat API access
- [ ] Server would call RevenueCat API to verify `originalAppVersion` claims
- Note: Current client-side logic via RevenueCat SDK is reasonably secure since RevenueCat signs the data

**7. Sanitize text inputs on the server** ✅

- [x] `sanitizeString()` strips script tags, HTML, `javascript:` URIs, event handlers, and data URIs
- [x] `sanitizeObject()` recursively sanitizes all string fields in nested objects/arrays
- [x] Applied to all tRPC mutation inputs (equipment, logs, consumables, routines, etc.)

---

### 🟡 Best Practice Fixes

**8. Keep console logging as-is** ✅

- [x] Logs remain for debugging per user preference

**9. Keep Supabase client** ✅

- [x] Supabase is the primary database — no changes needed
- [x] Created `backend/supabase-rls-policies.sql` with RLS policies for user to apply

**10. Encrypt sensitive local data** ✅

- [x] Farm password moved from plain AsyncStorage to Expo SecureStore
- [x] Automatic migration: existing AsyncStorage passwords are moved to SecureStore on first load
- [x] Old AsyncStorage password entry is cleaned up after migration

---

## Files Changed

| File | Change |
|------|--------|
| `backend/utils/sanitize.ts` | **New** — Input sanitization utility |
| `backend/utils/rate-limiter.ts` | **New** — In-memory rate limiter |
| `backend/utils/supabase-server.ts` | **New** — Server-side Supabase client + password verification |
| `backend/hono.ts` | **Modified** — Restricted CORS, added rate limiting middleware |
| `backend/trpc/routes/farm.ts` | **Modified** — Password verification + sanitization on all routes |
| `backend/supabase-rls-policies.sql` | **New** — Supabase RLS policies (user must run in dashboard) |
| `contexts/FarmDataContext.tsx` | **Modified** — SecureStore for password, server-side password verification |
| `app/(tabs)/settings.tsx` | **Modified** — Uses new server-side password verification flow |

---

## Manual Steps Required

1. **Run Supabase RLS SQL** — Open `backend/supabase-rls-policies.sql` and execute it in your Supabase Dashboard → SQL Editor
2. **RevenueCat server key** — For items #5 and #6, you'll need to add a `REVENUECAT_SERVER_API_KEY` environment variable with your RevenueCat secret API key
