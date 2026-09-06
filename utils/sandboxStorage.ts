import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEMO_CONSUMABLES,
  DEMO_CUSTOM_FUEL_TYPES,
  DEMO_EMPLOYEES,
  DEMO_EQUIPMENT,
  DEMO_FUEL_LOGS,
  DEMO_INTERVALS,
  DEMO_MAINTENANCE_LOGS,
  DEMO_WORK_ORDERS,
} from '@/constants/demoData';
import { TRIAL_LIMITS } from '@/constants/trialLimits';

/** Prefix so sandbox data never shares keys with a real farm. */
export const SANDBOX_PREFIX = 'sandbox_';

export function sandboxKey(liveKey: string): string {
  return `${SANDBOX_PREFIX}${liveKey}`;
}

const LIVE_KEYS = [
  'farmguard_equipment',
  'farmguard_maintenance_logs',
  'farmguard_intervals',
  'farmguard_consumables',
  'farmguard_service_routines',
  'farmguard_inspection_routines',
  'farmguard_work_orders',
  'farmguard_employees',
  'farmguard_fuel_logs',
  'farmguard_custom_fuel_types',
  'farmguard_deleted_ids',
] as const;

/** Seed a writable local sandbox from demo constants (trimmed to trial caps). */
export async function seedSandboxData(): Promise<void> {
  const equipment = DEMO_EQUIPMENT.slice(0, TRIAL_LIMITS.MAX_EQUIPMENT).map(eq => ({
    ...eq,
    notes: eq.notes?.includes('Demo equipment')
      ? 'Sample machine — try logging a service or editing details.'
      : eq.notes,
  }));
  const equipmentIds = new Set(equipment.map(e => e.id));

  const maintenanceLogs = DEMO_MAINTENANCE_LOGS
    .filter(l => equipmentIds.has(l.equipmentId))
    .slice(0, TRIAL_LIMITS.MAX_MAINTENANCE_LOGS);
  const intervals = DEMO_INTERVALS.filter(i => equipmentIds.has(i.equipmentId));
  const workOrders = DEMO_WORK_ORDERS.filter(w => !w.equipmentId || equipmentIds.has(w.equipmentId));
  const fuelLogs = DEMO_FUEL_LOGS.filter(f => equipmentIds.has(f.equipmentId));

  await AsyncStorage.multiSet([
    [sandboxKey('farmguard_equipment'), JSON.stringify(equipment)],
    [sandboxKey('farmguard_maintenance_logs'), JSON.stringify(maintenanceLogs)],
    [sandboxKey('farmguard_intervals'), JSON.stringify(intervals)],
    [sandboxKey('farmguard_consumables'), JSON.stringify(DEMO_CONSUMABLES)],
    [sandboxKey('farmguard_service_routines'), JSON.stringify([])],
    [sandboxKey('farmguard_inspection_routines'), JSON.stringify([])],
    [sandboxKey('farmguard_work_orders'), JSON.stringify(workOrders)],
    [sandboxKey('farmguard_employees'), JSON.stringify(DEMO_EMPLOYEES)],
    [sandboxKey('farmguard_fuel_logs'), JSON.stringify(fuelLogs)],
    [sandboxKey('farmguard_custom_fuel_types'), JSON.stringify(DEMO_CUSTOM_FUEL_TYPES)],
    [sandboxKey('farmguard_deleted_ids'), JSON.stringify([])],
  ]);
}

export async function clearSandboxData(): Promise<void> {
  await AsyncStorage.multiRemove(LIVE_KEYS.map(k => sandboxKey(k)));
}

/** Wipe live local entity data (used when converting sandbox → empty real farm). */
export async function clearLiveFarmEntityData(): Promise<void> {
  await AsyncStorage.multiRemove([...LIVE_KEYS]);
}

export async function sandboxHasEquipment(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(sandboxKey('farmguard_equipment'));
  return !!raw;
}
