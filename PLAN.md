# Grandfather users using both purchase date and build number

**What changes**

- Users who originally downloaded the app **before March 9, 2026** (placeholder — you can change this later) **or** whose build number is `1` will be automatically recognized as grandfathered and get full access without a subscription.
- This uses two checks as a safety net: if one fails, the other can still catch legitimate legacy users.
- A console log will show which method matched so you can debug easily.
- The cutoff date is stored as a single constant you can easily update before your subscription launch.

**No visual changes** — this is purely behind-the-scenes logic.