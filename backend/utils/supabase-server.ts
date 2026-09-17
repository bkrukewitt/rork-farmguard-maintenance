import { createClient } from '@supabase/supabase-js';
import { createHash, randomInt } from 'crypto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

export async function getFarmPasswordFromDb(farmId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (error || !data?.data) return null;
    const rd = data.data as Record<string, unknown>;
    return (rd._joinPassword as string) || null;
  } catch (err) {
    console.error('[SupabaseServer] Error fetching farm password:', err);
    return null;
  }
}

export async function verifyFarmAccess(farmId: string, providedPassword: string | null): Promise<boolean> {
  const storedPassword = await getFarmPasswordFromDb(farmId);

  if (!storedPassword) {
    return true;
  }

  if (!providedPassword) {
    console.log(`[Auth] Farm ${farmId} requires password but none provided`);
    return false;
  }

  return storedPassword === providedPassword;
}

export interface PasswordProtectedFarm {
  farmId: string;
  updatedAt: string | null;
}

export async function listPasswordProtectedFarmsFromDb(): Promise<PasswordProtectedFarm[]> {
  try {
    const { data, error } = await supabaseServer
      .from('farm_data')
      .select('farm_id, updated_at, data')
      .order('updated_at', { ascending: false });

    if (error || !data) {
      console.error('[SupabaseServer] Error listing password-protected farms:', error);
      return [];
    }

    return data
      .filter((row) => {
        const rowData = (row.data ?? {}) as Record<string, unknown>;
        const joinPassword = rowData._joinPassword;
        return typeof joinPassword === 'string' && joinPassword.trim().length > 0;
      })
      .map((row) => ({
        farmId: row.farm_id as string,
        updatedAt: (row.updated_at as string | null) ?? null,
      }));
  } catch (err) {
    console.error('[SupabaseServer] Error listing password-protected farms:', err);
    return [];
  }
}

/** Farm-level legacy Pro flag (manual grant for early adopters). Stored in farm_data JSON. */
export async function getFarmLegacyProFromDb(farmId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (error || !data?.data) return false;
    const rowData = data.data as Record<string, unknown>;
    return rowData._legacyPro === true;
  } catch (err) {
    console.error('[SupabaseServer] Error reading legacy Pro flag:', err);
    return false;
  }
}

export async function setFarmLegacyProInDb(farmId: string, legacyPro: boolean): Promise<boolean> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError) {
      console.error('[SupabaseServer] Error fetching farm before legacy Pro update:', fetchError);
      return false;
    }

    const existingData = ((existing?.data as Record<string, unknown> | null) ?? {});

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _legacyPro: legacyPro,
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error updating legacy Pro flag:', upsertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[SupabaseServer] Error updating legacy Pro flag:', err);
    return false;
  }
}

export async function getFarmExtractionQuotaExemptFromDb(farmId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (error || !data?.data) return false;
    const rowData = data.data as Record<string, unknown>;
    return rowData._extractionQuotaExempt === true;
  } catch (err) {
    console.error('[SupabaseServer] Error reading extraction quota exempt flag:', err);
    return false;
  }
}

export async function setFarmExtractionQuotaExemptInDb(
  farmId: string,
  extractionQuotaExempt: boolean,
): Promise<boolean> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError) {
      console.error('[SupabaseServer] Error fetching farm before extraction quota update:', fetchError);
      return false;
    }

    const existingData = ((existing?.data as Record<string, unknown> | null) ?? {});

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _extractionQuotaExempt: extractionQuotaExempt,
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error updating extraction quota exempt flag:', upsertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[SupabaseServer] Error updating extraction quota exempt flag:', err);
    return false;
  }
}

export async function setFarmPasswordInDb(farmId: string, password: string): Promise<boolean> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError) {
      console.error('[SupabaseServer] Error fetching farm before password update:', fetchError);
      return false;
    }

    const existingData = ((existing?.data as Record<string, unknown> | null) ?? {});
    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      return false;
    }

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _joinPassword: trimmedPassword,
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error updating farm password:', upsertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[SupabaseServer] Error updating farm password:', err);
    return false;
  }
}

function hashResetCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export interface FarmPasswordResetRequestResult {
  recoveryEmail: string;
  code: string;
  expiresAt: string;
}

export type CompleteFarmPasswordResetResult =
  | { success: true }
  | { success: false; reason: "missing_reset_request" | "expired" | "locked" | "invalid_code" | "invalid_input" | "server_error"; lockedUntil?: string | null };

export async function requestFarmPasswordResetInDb(farmId: string): Promise<FarmPasswordResetRequestResult | null> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError) {
      console.error('[SupabaseServer] Error fetching farm for password reset request:', fetchError);
      return null;
    }

    const existingData = ((existing?.data as Record<string, unknown> | null) ?? {});
    const recoveryEmail = (existingData._recoveryEmail as string | undefined)?.trim().toLowerCase() ?? '';
    if (!recoveryEmail) {
      return null;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + (15 * 60 * 1000)).toISOString();

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _passwordResetCodeHash: hashResetCode(code),
          _passwordResetExpiresAt: expiresAt,
          _passwordResetRequestedAt: new Date().toISOString(),
          _passwordResetAttempts: 0,
          _passwordResetLockedUntil: null,
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error storing password reset request:', upsertError);
      return null;
    }

    return { recoveryEmail, code, expiresAt };
  } catch (err) {
    console.error('[SupabaseServer] Error requesting password reset:', err);
    return null;
  }
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

function maxIsoDate(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const value of values) {
    if (!value || typeof value !== 'string') continue;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = value;
    }
  }
  return best;
}

function latestFromItems(items: Record<string, unknown>[], keys: string[]): string | null {
  return maxIsoDate(items.map((item) => {
    for (const key of keys) {
      const v = item[key];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  }));
}

function isRemoteUrl(value: unknown): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function hasImageUrl(item: Record<string, unknown>): boolean {
  return typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0;
}

export interface FarmUsageRow {
  farmId: string;
  updatedAt: string | null;
  equipmentCount: number;
  maintenanceLogCount: number;
  workOrderCount: number;
  fuelLogCount: number;
  consumableCount: number;
  serviceRoutineCount: number;
  inspectionRoutineCount: number;
  employeeCount: number;
  intervalCount: number;
  customFuelTypeCount: number;
  equipmentWithPhotos: number;
  equipmentWithRemotePhotos: number;
  partsWithPhotos: number;
  workOrdersWithImages: number;
  equipmentAttachmentCount: number;
  maintenanceAttachmentCount: number;
  fuelLogsWithCustomType: number;
  workOrdersWithAssignees: number;
  employeesLinkedToDevice: number;
  milesEquipmentCount: number;
  buildingEquipmentCount: number;
  passwordProtected: boolean;
  recoveryEmailSet: boolean;
  legacyPro: boolean;
  lastEquipmentAt: string | null;
  lastMaintenanceAt: string | null;
  lastWorkOrderAt: string | null;
  lastFuelAt: string | null;
  lastConsumableAt: string | null;
  lastServiceRoutineAt: string | null;
  lastInspectionRoutineAt: string | null;
  memberCount: number;
  activeDevices7d: number;
  activeDevices30d: number;
  lastMemberSeenAt: string | null;
}

export interface FarmUsageSummary {
  totalFarms: number;
  activeFarms7d: number;
  activeFarms30d: number;
  farmsWithEquipment: number;
  farmsWithMaintenance: number;
  farmsWithWorkOrders: number;
  farmsWithFuel: number;
  farmsWithInventory: number;
  farmsWithServiceRoutines: number;
  farmsWithInspectionRoutines: number;
  farmsWithPhotos: number;
  farmsWithAttachments: number;
  farmsWithCustomFuelTypes: number;
  farmsWithEmployees: number;
  farmsPasswordProtected: number;
  farmsWithRecoveryEmail: number;
}

export interface FarmUsageStatsResult {
  summary: FarmUsageSummary;
  farms: FarmUsageRow[];
}

function emptyUsageSummary(): FarmUsageSummary {
  return {
    totalFarms: 0,
    activeFarms7d: 0,
    activeFarms30d: 0,
    farmsWithEquipment: 0,
    farmsWithMaintenance: 0,
    farmsWithWorkOrders: 0,
    farmsWithFuel: 0,
    farmsWithInventory: 0,
    farmsWithServiceRoutines: 0,
    farmsWithInspectionRoutines: 0,
    farmsWithPhotos: 0,
    farmsWithAttachments: 0,
    farmsWithCustomFuelTypes: 0,
    farmsWithEmployees: 0,
    farmsPasswordProtected: 0,
    farmsWithRecoveryEmail: 0,
  };
}

export async function getFarmUsageStatsFromDb(): Promise<FarmUsageStatsResult> {
  try {
    const [{ data: farmRows, error: farmError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabaseServer
        .from('farm_data')
        .select('farm_id, updated_at, data')
        .order('updated_at', { ascending: false }),
      supabaseServer
        .from('farm_members')
        .select('farm_id, last_active_at, app_last_seen'),
    ]);

    if (farmError || !farmRows) {
      console.error('[SupabaseServer] Error listing farms for usage stats:', farmError);
      return { summary: emptyUsageSummary(), farms: [] };
    }
    if (memberError) {
      console.error('[SupabaseServer] Error listing members for usage stats:', memberError);
    }

    const now = Date.now();
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const ms30d = 30 * 24 * 60 * 60 * 1000;

    type MemberAgg = {
      memberCount: number;
      activeDevices7d: number;
      activeDevices30d: number;
      lastMemberSeenAt: string | null;
    };
    const membersByFarm = new Map<string, MemberAgg>();

    for (const member of memberRows ?? []) {
      const farmId = member.farm_id as string;
      if (!farmId) continue;
      const seenRaw =
        (typeof member.app_last_seen === 'string' && member.app_last_seen) ||
        (typeof member.last_active_at === 'string' && member.last_active_at) ||
        null;
      const seenMs = seenRaw ? Date.parse(seenRaw) : NaN;
      const existing = membersByFarm.get(farmId) ?? {
        memberCount: 0,
        activeDevices7d: 0,
        activeDevices30d: 0,
        lastMemberSeenAt: null,
      };
      existing.memberCount += 1;
      if (!Number.isNaN(seenMs)) {
        if (now - seenMs <= ms7d) existing.activeDevices7d += 1;
        if (now - seenMs <= ms30d) existing.activeDevices30d += 1;
        existing.lastMemberSeenAt = maxIsoDate([existing.lastMemberSeenAt, seenRaw]);
      }
      membersByFarm.set(farmId, existing);
    }

    const farms: FarmUsageRow[] = farmRows.map((row) => {
      const farmId = row.farm_id as string;
      const data = (row.data ?? {}) as Record<string, unknown>;
      const equipment = asArray(data.equipment);
      const maintenanceLogs = asArray(data.maintenanceLogs);
      const workOrders = asArray(data.workOrders);
      const fuelLogs = asArray(data.fuelLogs);
      const consumables = asArray(data.consumables);
      const serviceRoutines = asArray(data.serviceRoutines);
      const inspectionRoutines = asArray(data.inspectionRoutines);
      const employees = asArray(data.employees);
      const intervals = asArray(data.intervals);
      const customFuelTypes = asArray(data.customFuelTypes);

      const equipmentWithPhotos = equipment.filter(hasImageUrl).length;
      const equipmentWithRemotePhotos = equipment.filter((e) => isRemoteUrl(e.imageUrl)).length;
      const partsWithPhotos = consumables.filter(hasImageUrl).length;
      const workOrdersWithImages = workOrders.filter((wo) => {
        const images = wo.images;
        return Array.isArray(images) && images.length > 0;
      }).length;

      let equipmentAttachmentCount = 0;
      for (const item of equipment) {
        const attachments = item.attachments;
        if (Array.isArray(attachments)) equipmentAttachmentCount += attachments.length;
      }
      let maintenanceAttachmentCount = 0;
      for (const item of maintenanceLogs) {
        const attachments = item.attachments;
        if (Array.isArray(attachments)) maintenanceAttachmentCount += attachments.length;
      }

      const fuelLogsWithCustomType = fuelLogs.filter((log) => {
        const customName = log.customFuelTypeName;
        const fuelType = log.fuelType;
        return (typeof customName === 'string' && customName.trim().length > 0) ||
          (typeof fuelType === 'string' && fuelType === 'custom');
      }).length;

      const workOrdersWithAssignees = workOrders.filter((wo) => {
        const assigned = wo.assignedTo;
        return Array.isArray(assigned) && assigned.length > 0;
      }).length;

      const employeesLinkedToDevice = employees.filter((emp) => {
        const linked = emp.linkedDeviceId;
        return typeof linked === 'string' && linked.trim().length > 0;
      }).length;

      const milesEquipmentCount = equipment.filter((e) => e.metric === 'miles').length;
      const buildingEquipmentCount = equipment.filter((e) => e.type === 'building').length;

      const joinPassword = data._joinPassword;
      const passwordProtected = typeof joinPassword === 'string' && joinPassword.trim().length > 0;
      const recoveryEmail = data._recoveryEmail;
      const recoveryEmailSet = typeof recoveryEmail === 'string' && recoveryEmail.trim().length > 0;
      const legacyPro = data._legacyPro === true;

      const memberAgg = membersByFarm.get(farmId) ?? {
        memberCount: 0,
        activeDevices7d: 0,
        activeDevices30d: 0,
        lastMemberSeenAt: null,
      };

      return {
        farmId,
        updatedAt: (row.updated_at as string | null) ?? null,
        equipmentCount: equipment.length,
        maintenanceLogCount: maintenanceLogs.length,
        workOrderCount: workOrders.length,
        fuelLogCount: fuelLogs.length,
        consumableCount: consumables.length,
        serviceRoutineCount: serviceRoutines.length,
        inspectionRoutineCount: inspectionRoutines.length,
        employeeCount: employees.length,
        intervalCount: intervals.length,
        customFuelTypeCount: customFuelTypes.length,
        equipmentWithPhotos,
        equipmentWithRemotePhotos,
        partsWithPhotos,
        workOrdersWithImages,
        equipmentAttachmentCount,
        maintenanceAttachmentCount,
        fuelLogsWithCustomType,
        workOrdersWithAssignees,
        employeesLinkedToDevice,
        milesEquipmentCount,
        buildingEquipmentCount,
        passwordProtected,
        recoveryEmailSet,
        legacyPro,
        lastEquipmentAt: latestFromItems(equipment, ['updatedAt', 'createdAt']),
        lastMaintenanceAt: latestFromItems(maintenanceLogs, ['createdAt', 'date']),
        lastWorkOrderAt: latestFromItems(workOrders, ['updatedAt', 'completedAt', 'createdAt']),
        lastFuelAt: latestFromItems(fuelLogs, ['createdAt', 'date']),
        lastConsumableAt: latestFromItems(consumables, ['updatedAt', 'createdAt']),
        lastServiceRoutineAt: latestFromItems(serviceRoutines, ['updatedAt', 'createdAt']),
        lastInspectionRoutineAt: latestFromItems(inspectionRoutines, ['updatedAt', 'createdAt']),
        memberCount: memberAgg.memberCount,
        activeDevices7d: memberAgg.activeDevices7d,
        activeDevices30d: memberAgg.activeDevices30d,
        lastMemberSeenAt: memberAgg.lastMemberSeenAt,
      };
    });

    const summary = emptyUsageSummary();
    summary.totalFarms = farms.length;

    for (const farm of farms) {
      const activityAt = maxIsoDate([farm.updatedAt, farm.lastMemberSeenAt]);
      const activityMs = activityAt ? Date.parse(activityAt) : NaN;
      if (!Number.isNaN(activityMs)) {
        if (now - activityMs <= ms7d) summary.activeFarms7d += 1;
        if (now - activityMs <= ms30d) summary.activeFarms30d += 1;
      }
      if (farm.equipmentCount > 0) summary.farmsWithEquipment += 1;
      if (farm.maintenanceLogCount > 0) summary.farmsWithMaintenance += 1;
      if (farm.workOrderCount > 0) summary.farmsWithWorkOrders += 1;
      if (farm.fuelLogCount > 0) summary.farmsWithFuel += 1;
      if (farm.consumableCount > 0) summary.farmsWithInventory += 1;
      if (farm.serviceRoutineCount > 0) summary.farmsWithServiceRoutines += 1;
      if (farm.inspectionRoutineCount > 0) summary.farmsWithInspectionRoutines += 1;
      if (farm.equipmentWithPhotos > 0 || farm.partsWithPhotos > 0 || farm.workOrdersWithImages > 0) {
        summary.farmsWithPhotos += 1;
      }
      if (farm.equipmentAttachmentCount > 0 || farm.maintenanceAttachmentCount > 0) {
        summary.farmsWithAttachments += 1;
      }
      if (farm.customFuelTypeCount > 0) summary.farmsWithCustomFuelTypes += 1;
      if (farm.employeeCount > 0) summary.farmsWithEmployees += 1;
      if (farm.passwordProtected) summary.farmsPasswordProtected += 1;
      if (farm.recoveryEmailSet) summary.farmsWithRecoveryEmail += 1;
    }

    farms.sort((a, b) => {
      const aMs = Date.parse(maxIsoDate([a.updatedAt, a.lastMemberSeenAt]) ?? '') || 0;
      const bMs = Date.parse(maxIsoDate([b.updatedAt, b.lastMemberSeenAt]) ?? '') || 0;
      return bMs - aMs;
    });

    return { summary, farms };
  } catch (err) {
    console.error('[SupabaseServer] Error computing farm usage stats:', err);
    return { summary: emptyUsageSummary(), farms: [] };
  }
}

export async function completeFarmPasswordResetInDb(farmId: string, code: string, newPassword: string): Promise<CompleteFarmPasswordResetResult> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError || !existing?.data) {
      console.error('[SupabaseServer] Error fetching farm for password reset completion:', fetchError);
      return { success: false, reason: "server_error" };
    }

    const existingData = (existing.data as Record<string, unknown>);
    const storedHash = (existingData._passwordResetCodeHash as string | undefined) ?? '';
    const expiresAt = (existingData._passwordResetExpiresAt as string | undefined) ?? '';
    const currentAttempts = Number(existingData._passwordResetAttempts ?? 0) || 0;
    const lockedUntil = (existingData._passwordResetLockedUntil as string | undefined) ?? null;
    const trimmedCode = code.trim();
    const trimmedPassword = newPassword.trim();
    const now = Date.now();
    const lockoutDurationMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    if (!storedHash || !expiresAt || !trimmedCode || !trimmedPassword) {
      return { success: false, reason: "missing_reset_request" };
    }
    if (trimmedPassword.length < 4) {
      return { success: false, reason: "invalid_input" };
    }
    if (lockedUntil && new Date(lockedUntil).getTime() > now) {
      return { success: false, reason: "locked", lockedUntil };
    }
    if (new Date(expiresAt).getTime() < now) {
      return { success: false, reason: "expired" };
    }
    if (hashResetCode(trimmedCode) !== storedHash) {
      const nextAttempts = currentAttempts + 1;
      const newLockedUntil = nextAttempts >= maxAttempts ? new Date(now + lockoutDurationMs).toISOString() : null;
      const { error: attemptError } = await supabaseServer
        .from('farm_data')
        .upsert({
          farm_id: farmId,
          data: {
            ...existingData,
            _passwordResetAttempts: nextAttempts,
            _passwordResetLockedUntil: newLockedUntil,
          },
          updated_at: new Date().toISOString(),
        });
      if (attemptError) {
        console.error('[SupabaseServer] Error updating reset attempts:', attemptError);
        return { success: false, reason: "server_error" };
      }
      if (newLockedUntil) {
        return { success: false, reason: "locked", lockedUntil: newLockedUntil };
      }
      return { success: false, reason: "invalid_code" };
    }

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _joinPassword: trimmedPassword,
          _passwordResetCodeHash: null,
          _passwordResetExpiresAt: null,
          _passwordResetRequestedAt: null,
          _passwordResetAttempts: 0,
          _passwordResetLockedUntil: null,
          _passwordResetCompletedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error completing password reset:', upsertError);
      return { success: false, reason: "server_error" };
    }

    return { success: true };
  } catch (err) {
    console.error('[SupabaseServer] Error completing password reset:', err);
    return { success: false, reason: "server_error" };
  }
}
