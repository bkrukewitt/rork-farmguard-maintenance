import AsyncStorage from '@react-native-async-storage/async-storage';

export type DashboardWidgetId =
  | 'quickActions'
  | 'myWorkOrders'
  | 'fuelMonth'
  | 'lowStock'
  | 'fleetOverview'
  | 'recentActivity';

export const DASHBOARD_WIDGETS: {
  id: DashboardWidgetId;
  label: string;
  description: string;
}[] = [
  { id: 'quickActions', label: 'Quick Actions', description: 'Add equipment, log service, work order' },
  { id: 'myWorkOrders', label: 'My Work Orders', description: 'Orders assigned to this device' },
  { id: 'fuelMonth', label: 'Fuel This Month', description: 'Gallons and spend this month' },
  { id: 'lowStock', label: 'Low Stock Alerts', description: 'Parts at or below threshold' },
  { id: 'fleetOverview', label: 'Fleet Overview', description: 'Top equipment by hours' },
  { id: 'recentActivity', label: 'Recent Activity', description: 'Latest services and completed orders' },
];

export const DEFAULT_DASHBOARD_ORDER: DashboardWidgetId[] = DASHBOARD_WIDGETS.map(w => w.id);

const STORAGE_KEY = 'farmguard_dashboard_prefs_v1';

export interface DashboardPreferences {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}

export function getDefaultDashboardPreferences(): DashboardPreferences {
  return {
    order: [...DEFAULT_DASHBOARD_ORDER],
    hidden: [],
  };
}

function normalizePrefs(raw: Partial<DashboardPreferences> | null): DashboardPreferences {
  const defaults = getDefaultDashboardPreferences();
  if (!raw) return defaults;

  const known = new Set(DEFAULT_DASHBOARD_ORDER);
  const order = (raw.order ?? [])
    .filter((id): id is DashboardWidgetId => known.has(id as DashboardWidgetId));
  for (const id of DEFAULT_DASHBOARD_ORDER) {
    if (!order.includes(id)) order.push(id);
  }

  const hidden = (raw.hidden ?? [])
    .filter((id): id is DashboardWidgetId => known.has(id as DashboardWidgetId));

  return { order, hidden };
}

export async function loadDashboardPreferences(): Promise<DashboardPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultDashboardPreferences();
    return normalizePrefs(JSON.parse(raw) as Partial<DashboardPreferences>);
  } catch {
    return getDefaultDashboardPreferences();
  }
}

export async function saveDashboardPreferences(prefs: DashboardPreferences): Promise<void> {
  const normalized = normalizePrefs(prefs);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function isWidgetVisible(prefs: DashboardPreferences, id: DashboardWidgetId): boolean {
  return !prefs.hidden.includes(id);
}

export function moveWidget(
  order: DashboardWidgetId[],
  id: DashboardWidgetId,
  direction: 'up' | 'down'
): DashboardWidgetId[] {
  const index = order.indexOf(id);
  if (index < 0) return order;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
