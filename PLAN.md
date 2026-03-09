# FarmGuard Maintenance App - Recent Changes

## Completed

- [x] **Fix paywall not dismissing after purchase** — Added `invalidateQueries` + `refetchQueries` after purchase/restore so SubscriptionGate re-evaluates immediately
- [x] **Free trial / preview mode** — Users can tap "Try Free Preview" on paywall to browse the app without subscribing. Trial users see a PREVIEW badge on dashboard and a TrialBanner component warns on data screens. Subscribing or tapping "Subscribe" on the banner exits trial mode.
- [x] **Remove default service intervals** — `DEFAULT_MAINTENANCE_INTERVALS` is now an empty array. No automatic intervals are created for new equipment.
- [x] **Remove overdue alerts from dashboard** — Removed Good/Due Soon/Overdue status cards. Dashboard now shows equipment count, services this month, and open work orders.
- [x] **Rework dashboard** — New layout with header stats, 3 quick actions (Add Equipment, Log Service, Work Order), My Work Orders section, Low Stock Alerts, Fleet Overview (top equipment by hours), and Recent Activity feed (combined maintenance logs + completed work orders)
- [x] **Work orders in maintenance log** — Completed work orders now appear in the maintenance log alongside regular maintenance entries. Added "Orders" filter tab.
- [x] **Maintenance log filtering** — Added search bar, equipment filter dropdown, and type filter tabs (All, Routine, Repairs, Inspections, Orders)
- [x] **Employee-to-user linking** — Admins can link employees to farm member devices via a link button in Settings > Farm Members. Linked employees' work orders appear on that device's dashboard.
- [x] **Work order photos** — Added `WorkOrderImage` type. Users can add photos from camera or gallery when editing work orders. Photos display in both edit and view modes.
- [x] **Grandfather users** — Users who originally downloaded before March 9, 2026 or with build number 1 get full access without subscription.
