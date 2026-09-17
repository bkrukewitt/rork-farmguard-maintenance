/**
 * Pure helpers to derive farm usage / adoption metrics from farm_data JSON.
 * Shared by server aggregation and Super Admin client fallback.
 */

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

export function maxIsoDate(values: Array<string | null | undefined>): string | null {
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

export type UsageEventName =
  | 'template_download_equipment'
  | 'template_download_parts'
  | 'import_equipment'
  | 'import_parts'
  | 'export_maintenance_pdf'
  | 'export_fuel_pdf'
  | 'export_fuel_excel'
  | 'export_low_stock'
  | 'export_backup_json'
  | 'restore_backup';

export type UsageEventRollups = Record<UsageEventName, number>;

export function emptyUsageEventRollups(): UsageEventRollups {
  return {
    template_download_equipment: 0,
    template_download_parts: 0,
    import_equipment: 0,
    import_parts: 0,
    export_maintenance_pdf: 0,
    export_fuel_pdf: 0,
    export_fuel_excel: 0,
    export_low_stock: 0,
    export_backup_json: 0,
    restore_backup: 0,
  };
}

export function emptyUsageSummary(): FarmUsageSummary {
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

export interface MemberActivityInput {
  farm_id: string;
  last_active_at?: string | null;
  app_last_seen?: string | null;
}

export function aggregateMemberActivity(memberRows: MemberActivityInput[]): Map<string, {
  memberCount: number;
  activeDevices7d: number;
  activeDevices30d: number;
  lastMemberSeenAt: string | null;
}> {
  const now = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const membersByFarm = new Map<string, {
    memberCount: number;
    activeDevices7d: number;
    activeDevices30d: number;
    lastMemberSeenAt: string | null;
  }>();

  for (const member of memberRows) {
    const farmId = member.farm_id;
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
  return membersByFarm;
}

export function buildFarmUsageRow(
  farmId: string,
  updatedAt: string | null,
  dataRaw: unknown,
  memberAgg: {
    memberCount: number;
    activeDevices7d: number;
    activeDevices30d: number;
    lastMemberSeenAt: string | null;
  },
): FarmUsageRow {
  const data = (dataRaw && typeof dataRaw === 'object' ? dataRaw : {}) as Record<string, unknown>;
  const equipment = asRecordArray(data.equipment);
  const maintenanceLogs = asRecordArray(data.maintenanceLogs);
  const workOrders = asRecordArray(data.workOrders);
  const fuelLogs = asRecordArray(data.fuelLogs);
  const consumables = asRecordArray(data.consumables);
  const serviceRoutines = asRecordArray(data.serviceRoutines);
  const inspectionRoutines = asRecordArray(data.inspectionRoutines);
  const employees = asRecordArray(data.employees);
  const intervals = asRecordArray(data.intervals);
  const customFuelTypes = asRecordArray(data.customFuelTypes);

  const equipmentWithPhotos = equipment.filter(hasImageUrl).length;
  const equipmentWithRemotePhotos = equipment.filter((e) => isRemoteUrl(e.imageUrl)).length;
  const partsWithPhotos = consumables.filter(hasImageUrl).length;
  const workOrdersWithImages = workOrders.filter((wo) => Array.isArray(wo.images) && wo.images.length > 0).length;

  let equipmentAttachmentCount = 0;
  for (const item of equipment) {
    if (Array.isArray(item.attachments)) equipmentAttachmentCount += item.attachments.length;
  }
  let maintenanceAttachmentCount = 0;
  for (const item of maintenanceLogs) {
    if (Array.isArray(item.attachments)) maintenanceAttachmentCount += item.attachments.length;
  }

  const fuelLogsWithCustomType = fuelLogs.filter((log) => {
    const customName = log.customFuelTypeName;
    const fuelType = log.fuelType;
    return (typeof customName === 'string' && customName.trim().length > 0) ||
      (typeof fuelType === 'string' && fuelType === 'custom');
  }).length;

  const workOrdersWithAssignees = workOrders.filter((wo) => Array.isArray(wo.assignedTo) && wo.assignedTo.length > 0).length;
  const employeesLinkedToDevice = employees.filter((emp) => typeof emp.linkedDeviceId === 'string' && emp.linkedDeviceId.trim().length > 0).length;
  const milesEquipmentCount = equipment.filter((e) => e.metric === 'miles').length;
  const buildingEquipmentCount = equipment.filter((e) => e.type === 'building').length;

  const joinPassword = data._joinPassword;
  const recoveryEmail = data._recoveryEmail;

  return {
    farmId,
    updatedAt,
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
    passwordProtected: typeof joinPassword === 'string' && joinPassword.trim().length > 0,
    recoveryEmailSet: typeof recoveryEmail === 'string' && recoveryEmail.trim().length > 0,
    legacyPro: data._legacyPro === true,
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
}

export function summarizeFarmUsageRows(farms: FarmUsageRow[]): FarmUsageSummary {
  const summary = emptyUsageSummary();
  summary.totalFarms = farms.length;
  const now = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

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
  return summary;
}

export function sortFarmsByActivity(farms: FarmUsageRow[]): FarmUsageRow[] {
  return [...farms].sort((a, b) => {
    const aMs = Date.parse(maxIsoDate([a.updatedAt, a.lastMemberSeenAt]) ?? '') || 0;
    const bMs = Date.parse(maxIsoDate([b.updatedAt, b.lastMemberSeenAt]) ?? '') || 0;
    return bMs - aMs;
  });
}

export interface FarmUsageStatsResult {
  summary: FarmUsageSummary;
  farms: FarmUsageRow[];
}
