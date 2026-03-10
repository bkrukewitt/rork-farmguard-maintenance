# Fix Paywall crash: "Cannot read property 'farmId' of undefined"

**Problem**
The Paywall screen tries to access farm data, but the farm data system hasn't loaded yet at that point in the app. This causes the crash.

**Fix**
- Move the farm data system to load *before* the subscription check, so the Paywall can safely access the farm ID for starting a trial.
- This is a one-line reorder in the app's startup structure — no visual or functional changes.