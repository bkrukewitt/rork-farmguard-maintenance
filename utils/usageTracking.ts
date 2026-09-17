import { trpcClient } from '@/lib/trpc';

export const USAGE_EVENTS = [
  'template_download_equipment',
  'template_download_parts',
  'import_equipment',
  'import_parts',
  'export_maintenance_pdf',
  'export_fuel_pdf',
  'export_fuel_excel',
  'export_low_stock',
  'export_backup_json',
  'restore_backup',
] as const;

export type UsageEventName = (typeof USAGE_EVENTS)[number];

/**
 * Fire-and-forget product usage event for Super Admin analytics.
 * Never throws to callers.
 */
export function trackUsage(
  farmId: string | null | undefined,
  deviceId: string | null | undefined,
  event: UsageEventName,
  metadata?: Record<string, unknown>,
): void {
  const trimmedFarmId = farmId?.trim();
  if (!trimmedFarmId || trimmedFarmId === 'demo') {
    return;
  }

  void trpcClient.farm.trackUsageEvent
    .mutate({
      farmId: trimmedFarmId,
      deviceId: deviceId?.trim() || undefined,
      event,
      metadata,
    })
    .catch((err) => {
      console.log('[UsageTracking] Failed to track event:', event, err);
    });
}
