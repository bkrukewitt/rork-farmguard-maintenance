import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Equipment, MaintenanceLog, MaintenanceInterval, Consumable, ServiceRoutine, InspectionRoutine } from '@/types/equipment';
import { SyncOperation } from '@/types/organization';
import { generateId } from '@/utils/helpers';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

const STORAGE_KEYS = {
  EQUIPMENT: 'farmguard_equipment',
  MAINTENANCE_LOGS: 'farmguard_maintenance_logs',
  INTERVALS: 'farmguard_intervals',
  CONSUMABLES: 'farmguard_consumables',
  SERVICE_ROUTINES: 'farmguard_service_routines',
  INSPECTION_ROUTINES: 'farmguard_inspection_routines',
  SYNC_QUEUE: 'farmguard_sync_queue',
  LAST_SYNC: 'farmguard_last_sync',
};

async function loadData<T>(key: string): Promise<T[]> {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      console.log(`Data loaded: ${key}, items: ${parsed.length}`);
      return parsed;
    }
    return [];
  } catch (error) {
    console.error(`Error loading data: ${key}`, error);
    return [];
  }
}

async function saveData<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    console.log(`Data saved: ${key}, items: ${data.length}`);
  } catch (error) {
    console.error(`Error saving data: ${key}`, error);
    throw error;
  }
}

function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}

function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

function equipmentToDb(e: Equipment, orgId: string, userId: string): Record<string, any> {
  return {
    id: e.id,
    org_id: orgId,
    name: e.name,
    type: e.type,
    make: e.make,
    model: e.model,
    year: e.year,
    serial_number: e.serialNumber,
    purchase_date: e.purchaseDate,
    current_hours: e.currentHours,
    oil_capacity: e.oilCapacity || null,
    image_url: e.imageUrl || null,
    warranty_expiry: e.warrantyExpiry || null,
    notes: e.notes || null,
    attachments: e.attachments || [],
    created_by: userId,
    updated_by: userId,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function equipmentFromDb(row: Record<string, any>): Equipment {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    make: row.make || '',
    model: row.model || '',
    year: row.year || 0,
    serialNumber: row.serial_number || '',
    purchaseDate: row.purchase_date || '',
    currentHours: Number(row.current_hours) || 0,
    oilCapacity: row.oil_capacity || undefined,
    imageUrl: row.image_url || undefined,
    warrantyExpiry: row.warranty_expiry || undefined,
    notes: row.notes || undefined,
    attachments: row.attachments || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function maintenanceLogToDb(l: MaintenanceLog, orgId: string, userId: string): Record<string, any> {
  return {
    id: l.id,
    org_id: orgId,
    equipment_id: l.equipmentId,
    date: l.date,
    hours_at_service: l.hoursAtService,
    type: l.type,
    description: l.description,
    consumables_used: l.consumablesUsed || [],
    performed_by: l.performedBy,
    performed_by_name: l.performedByName || null,
    downtime_hours: l.downtimeHours || null,
    notes: l.notes || null,
    attachments: l.attachments || [],
    created_by: userId,
    updated_by: userId,
    created_at: l.createdAt,
    updated_at: l.createdAt,
  };
}

function maintenanceLogFromDb(row: Record<string, any>): MaintenanceLog {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    date: row.date,
    hoursAtService: Number(row.hours_at_service) || 0,
    type: row.type,
    description: row.description || '',
    consumablesUsed: row.consumables_used || [],
    performedBy: row.performed_by || 'owner',
    performedByName: row.performed_by_name || undefined,
    downtimeHours: row.downtime_hours ? Number(row.downtime_hours) : undefined,
    notes: row.notes || undefined,
    attachments: row.attachments || [],
    createdAt: row.created_at,
  };
}

function intervalToDb(i: MaintenanceInterval, orgId: string, userId: string): Record<string, any> {
  return {
    id: i.id,
    org_id: orgId,
    equipment_id: i.equipmentId,
    name: i.name,
    interval_hours: i.intervalHours || null,
    interval_days: i.intervalDays || null,
    last_performed_hours: i.lastPerformedHours || null,
    last_performed_date: i.lastPerformedDate || null,
    notes: i.notes || null,
    created_by: userId,
    updated_by: userId,
  };
}

function intervalFromDb(row: Record<string, any>): MaintenanceInterval {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    name: row.name,
    intervalHours: row.interval_hours ? Number(row.interval_hours) : undefined,
    intervalDays: row.interval_days ? Number(row.interval_days) : undefined,
    lastPerformedHours: row.last_performed_hours ? Number(row.last_performed_hours) : undefined,
    lastPerformedDate: row.last_performed_date || undefined,
    notes: row.notes || undefined,
  };
}

function consumableToDb(c: Consumable, orgId: string, userId: string): Record<string, any> {
  return {
    id: c.id,
    org_id: orgId,
    name: c.name,
    part_number: c.partNumber,
    category: c.category,
    supplier: c.supplier || null,
    supplier_part_number: c.supplierPartNumber || null,
    quantity: c.quantity,
    low_stock_threshold: c.lowStockThreshold,
    compatible_equipment: c.compatibleEquipment || [],
    image_url: c.imageUrl || null,
    notes: c.notes || null,
    created_by: userId,
    updated_by: userId,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function consumableFromDb(row: Record<string, any>): Consumable {
  return {
    id: row.id,
    name: row.name,
    partNumber: row.part_number || '',
    category: row.category,
    supplier: row.supplier || undefined,
    supplierPartNumber: row.supplier_part_number || undefined,
    quantity: Number(row.quantity) || 0,
    lowStockThreshold: Number(row.low_stock_threshold) || 0,
    compatibleEquipment: row.compatible_equipment || [],
    imageUrl: row.image_url || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function routineToDb(r: ServiceRoutine | InspectionRoutine, orgId: string, userId: string): Record<string, any> {
  return {
    id: r.id,
    org_id: orgId,
    name: r.name,
    description: r.description || null,
    equipment_types: r.equipmentTypes || [],
    checklist_items: r.checklistItems || [],
    created_by: userId,
    updated_by: userId,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function routineFromDb(row: Record<string, any>): ServiceRoutine & InspectionRoutine {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    equipmentTypes: row.equipment_types || [],
    checklistItems: row.checklist_items || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const [FarmDataProvider, useFarmData] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user, profile, isAuthenticated } = useAuth();
  const { organization } = useOrganization();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncEnabled = !!(isAuthenticated && organization && user);
  const orgId = organization?.id ?? '';
  const userId = user?.id ?? '';

  const equipmentQuery = useQuery({
    queryKey: ['equipment'],
    queryFn: () => loadData<Equipment>(STORAGE_KEYS.EQUIPMENT),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const maintenanceLogsQuery = useQuery({
    queryKey: ['maintenanceLogs'],
    queryFn: () => loadData<MaintenanceLog>(STORAGE_KEYS.MAINTENANCE_LOGS),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const intervalsQuery = useQuery({
    queryKey: ['intervals'],
    queryFn: () => loadData<MaintenanceInterval>(STORAGE_KEYS.INTERVALS),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const consumablesQuery = useQuery({
    queryKey: ['consumables'],
    queryFn: () => loadData<Consumable>(STORAGE_KEYS.CONSUMABLES),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const serviceRoutinesQuery = useQuery({
    queryKey: ['serviceRoutines'],
    queryFn: () => loadData<ServiceRoutine>(STORAGE_KEYS.SERVICE_ROUTINES),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const inspectionRoutinesQuery = useQuery({
    queryKey: ['inspectionRoutines'],
    queryFn: () => loadData<InspectionRoutine>(STORAGE_KEYS.INSPECTION_ROUTINES),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const equipment = useMemo(() => equipmentQuery.data ?? [], [equipmentQuery.data]);
  const maintenanceLogs = useMemo(() => maintenanceLogsQuery.data ?? [], [maintenanceLogsQuery.data]);
  const intervals = useMemo(() => intervalsQuery.data ?? [], [intervalsQuery.data]);
  const consumables = useMemo(() => consumablesQuery.data ?? [], [consumablesQuery.data]);
  const serviceRoutines = useMemo(() => serviceRoutinesQuery.data ?? [], [serviceRoutinesQuery.data]);
  const inspectionRoutines = useMemo(() => inspectionRoutinesQuery.data ?? [], [inspectionRoutinesQuery.data]);

  const logAudit = useCallback(async (
    action: 'create' | 'update' | 'delete',
    entityType: string,
    entityId: string,
    entityName: string,
    details?: Record<string, any>
  ) => {
    if (!syncEnabled) return;
    try {
      await supabase.from('audit_logs').insert({
        org_id: orgId,
        user_id: userId,
        user_email: profile?.email || user?.email || '',
        user_name: profile?.full_name || '',
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        details,
      });
    } catch (err) {
      console.log('Audit log error (non-critical):', err);
    }
  }, [syncEnabled, orgId, userId, profile, user]);

  const pushToSupabase = useCallback(async (
    table: string,
    data: Record<string, any>,
    type: 'upsert' | 'delete'
  ) => {
    if (!syncEnabled) {
      const queue = await loadData<SyncOperation>(STORAGE_KEYS.SYNC_QUEUE);
      queue.push({ id: generateId(), type, table, data, timestamp: new Date().toISOString(), retries: 0 });
      await saveData(STORAGE_KEYS.SYNC_QUEUE, queue);
      console.log('Queued sync operation:', type, table);
      return;
    }

    try {
      if (type === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from(table)
          .select('id, version, updated_at')
          .eq('id', data.id)
          .single();

        if (existing && data.version && existing.version > data.version) {
          console.log(`Conflict detected on ${table}/${data.id}. Server version: ${existing.version}, local: ${data.version}`);
          const conflictCopy = {
            ...data,
            id: generateId(),
            name: data.name ? `${data.name} [Conflict Copy]` : data.id,
            notes: `[Conflict] This is a copy created due to a sync conflict. Original ID: ${data.id}. ` +
              `Another user modified this record while you were offline. Please review and merge manually.` +
              (data.notes ? `\n\nOriginal notes: ${data.notes}` : ''),
            version: 1,
          };
          const { error: conflictError } = await supabase.from(table).upsert(conflictCopy);
          if (conflictError) console.log('Error creating conflict copy:', conflictError);
          return;
        }

        const upsertData = { ...data, version: (existing?.version || 0) + 1 };
        const { error } = await supabase.from(table).upsert(upsertData);
        if (error) throw error;
      }
    } catch (err) {
      console.log(`Sync error for ${table}:`, err);
      const queue = await loadData<SyncOperation>(STORAGE_KEYS.SYNC_QUEUE);
      queue.push({ id: generateId(), type, table, data, timestamp: new Date().toISOString(), retries: 0 });
      await saveData(STORAGE_KEYS.SYNC_QUEUE, queue);
    }
  }, [syncEnabled, orgId]);

  const flushSyncQueue = useCallback(async () => {
    if (!syncEnabled) return;
    const queue = await loadData<SyncOperation>(STORAGE_KEYS.SYNC_QUEUE);
    if (queue.length === 0) return;

    console.log(`Flushing sync queue: ${queue.length} operations`);
    const remaining: SyncOperation[] = [];

    for (const op of queue) {
      try {
        if (op.type === 'delete') {
          const { error } = await supabase.from(op.table).delete().eq('id', op.data.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from(op.table).upsert(op.data);
          if (error) throw error;
        }
      } catch (err) {
        console.log(`Failed to flush operation:`, err);
        if (op.retries < 3) {
          remaining.push({ ...op, retries: op.retries + 1 });
        } else {
          console.log('Dropping operation after 3 retries:', op);
        }
      }
    }

    await saveData(STORAGE_KEYS.SYNC_QUEUE, remaining);
  }, [syncEnabled]);

  const pullFromSupabase = useCallback(async () => {
    if (!syncEnabled) return;
    setIsSyncing(true);
    console.log('Pulling data from Supabase for org:', orgId);

    try {
      const [eqRes, mlRes, intRes, conRes, srRes, irRes] = await Promise.all([
        supabase.from('equipment').select('*').eq('org_id', orgId),
        supabase.from('maintenance_logs').select('*').eq('org_id', orgId),
        supabase.from('maintenance_intervals').select('*').eq('org_id', orgId),
        supabase.from('consumables').select('*').eq('org_id', orgId),
        supabase.from('service_routines').select('*').eq('org_id', orgId),
        supabase.from('inspection_routines').select('*').eq('org_id', orgId),
      ]);

      if (eqRes.data) {
        const items = eqRes.data.map(equipmentFromDb);
        await saveData(STORAGE_KEYS.EQUIPMENT, items);
        queryClient.setQueryData(['equipment'], items);
      }
      if (mlRes.data) {
        const items = mlRes.data.map(maintenanceLogFromDb);
        await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, items);
        queryClient.setQueryData(['maintenanceLogs'], items);
      }
      if (intRes.data) {
        const items = intRes.data.map(intervalFromDb);
        await saveData(STORAGE_KEYS.INTERVALS, items);
        queryClient.setQueryData(['intervals'], items);
      }
      if (conRes.data) {
        const items = conRes.data.map(consumableFromDb);
        await saveData(STORAGE_KEYS.CONSUMABLES, items);
        queryClient.setQueryData(['consumables'], items);
      }
      if (srRes.data) {
        const items = srRes.data.map(routineFromDb);
        await saveData(STORAGE_KEYS.SERVICE_ROUTINES, items);
        queryClient.setQueryData(['serviceRoutines'], items);
      }
      if (irRes.data) {
        const items = irRes.data.map(routineFromDb);
        await saveData(STORAGE_KEYS.INSPECTION_ROUTINES, items);
        queryClient.setQueryData(['inspectionRoutines'], items);
      }

      const now = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);
      setLastSyncTime(now);
      console.log('Pull complete at:', now);
    } catch (err) {
      console.log('Pull from Supabase error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [syncEnabled, orgId, queryClient]);

  const migrateLocalData = useCallback(async () => {
    if (!syncEnabled) return;
    console.log('Migrating local data to Supabase org:', orgId);

    const localEquipment = await loadData<Equipment>(STORAGE_KEYS.EQUIPMENT);
    const localLogs = await loadData<MaintenanceLog>(STORAGE_KEYS.MAINTENANCE_LOGS);
    const localIntervals = await loadData<MaintenanceInterval>(STORAGE_KEYS.INTERVALS);
    const localConsumables = await loadData<Consumable>(STORAGE_KEYS.CONSUMABLES);
    const localServiceRoutines = await loadData<ServiceRoutine>(STORAGE_KEYS.SERVICE_ROUTINES);
    const localInspectionRoutines = await loadData<InspectionRoutine>(STORAGE_KEYS.INSPECTION_ROUTINES);

    const pushBatch = async (table: string, items: Record<string, any>[]) => {
      if (items.length === 0) return;
      const { error } = await supabase.from(table).upsert(items);
      if (error) console.log(`Migration error for ${table}:`, error);
      else console.log(`Migrated ${items.length} items to ${table}`);
    };

    await Promise.all([
      pushBatch('equipment', localEquipment.map(e => equipmentToDb(e, orgId, userId))),
      pushBatch('maintenance_logs', localLogs.map(l => maintenanceLogToDb(l, orgId, userId))),
      pushBatch('maintenance_intervals', localIntervals.map(i => intervalToDb(i, orgId, userId))),
      pushBatch('consumables', localConsumables.map(c => consumableToDb(c, orgId, userId))),
      pushBatch('service_routines', localServiceRoutines.map(r => routineToDb(r, orgId, userId))),
      pushBatch('inspection_routines', localInspectionRoutines.map(r => routineToDb(r, orgId, userId))),
    ]);

    await pullFromSupabase();
  }, [syncEnabled, orgId, userId, pullFromSupabase]);

  useEffect(() => {
    if (syncEnabled) {
      flushSyncQueue().then(() => pullFromSupabase());

      syncIntervalRef.current = setInterval(() => {
        flushSyncQueue().then(() => pullFromSupabase());
      }, 5 * 60 * 1000);

      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && syncEnabled) {
          flushSyncQueue().then(() => pullFromSupabase());
        }
      });

      return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        sub.remove();
      };
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [syncEnabled, flushSyncQueue, pullFromSupabase]);

  const addEquipmentMutation = useMutation({
    mutationFn: async (newEquipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const equipmentItem: Equipment = {
        ...newEquipment,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...equipment, equipmentItem];
      await saveData(STORAGE_KEYS.EQUIPMENT, updated);

      if (syncEnabled) {
        pushToSupabase('equipment', equipmentToDb(equipmentItem, orgId, userId), 'upsert');
        logAudit('create', 'equipment', equipmentItem.id, equipmentItem.name);
      }
      return equipmentItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (updates: Partial<Equipment> & { id: string }) => {
      const updated = equipment.map(e =>
        e.id === updates.id
          ? { ...e, ...updates, updatedAt: new Date().toISOString() }
          : e
      );
      await saveData(STORAGE_KEYS.EQUIPMENT, updated);
      const item = updated.find(e => e.id === updates.id);

      if (syncEnabled && item) {
        pushToSupabase('equipment', equipmentToDb(item, orgId, userId), 'upsert');
        logAudit('update', 'equipment', item.id, item.name);
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = equipment.find(e => e.id === id);
      const updated = equipment.filter(e => e.id !== id);
      await saveData(STORAGE_KEYS.EQUIPMENT, updated);
      const updatedLogs = maintenanceLogs.filter(l => l.equipmentId !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updatedLogs);
      const updatedIntervals = intervals.filter(i => i.equipmentId !== id);
      await saveData(STORAGE_KEYS.INTERVALS, updatedIntervals);

      if (syncEnabled) {
        pushToSupabase('equipment', { id }, 'delete');
        for (const log of maintenanceLogs.filter(l => l.equipmentId === id)) {
          pushToSupabase('maintenance_logs', { id: log.id }, 'delete');
        }
        for (const interval of intervals.filter(i => i.equipmentId === id)) {
          pushToSupabase('maintenance_intervals', { id: interval.id }, 'delete');
        }
        if (item) logAudit('delete', 'equipment', id, item.name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
    },
  });

  const addMaintenanceLogMutation = useMutation({
    mutationFn: async (log: Omit<MaintenanceLog, 'id' | 'createdAt'>) => {
      const newLog: MaintenanceLog = {
        ...log,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...maintenanceLogs, newLog];
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updated);

      if (log.hoursAtService > 0) {
        const equip = equipment.find(e => e.id === log.equipmentId);
        if (equip && log.hoursAtService > equip.currentHours) {
          const updatedEquipment = equipment.map(e =>
            e.id === log.equipmentId
              ? { ...e, currentHours: log.hoursAtService, updatedAt: new Date().toISOString() }
              : e
          );
          await saveData(STORAGE_KEYS.EQUIPMENT, updatedEquipment);
          if (syncEnabled) {
            const updatedItem = updatedEquipment.find(e => e.id === log.equipmentId);
            if (updatedItem) pushToSupabase('equipment', equipmentToDb(updatedItem, orgId, userId), 'upsert');
          }
        }
      }

      if (syncEnabled) {
        pushToSupabase('maintenance_logs', maintenanceLogToDb(newLog, orgId, userId), 'upsert');
        logAudit('create', 'maintenance_log', newLog.id, newLog.description || 'Maintenance log');
      }
      return newLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const updateMaintenanceLogMutation = useMutation({
    mutationFn: async (updates: Partial<MaintenanceLog> & { id: string }) => {
      const updated = maintenanceLogs.map(l =>
        l.id === updates.id ? { ...l, ...updates } : l
      );
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updated);

      if (updates.hoursAtService && updates.hoursAtService > 0) {
        const log = updated.find(l => l.id === updates.id);
        if (log) {
          const equip = equipment.find(e => e.id === log.equipmentId);
          if (equip && updates.hoursAtService > equip.currentHours) {
            const updatedEquipment = equipment.map(e =>
              e.id === log.equipmentId
                ? { ...e, currentHours: updates.hoursAtService!, updatedAt: new Date().toISOString() }
                : e
            );
            await saveData(STORAGE_KEYS.EQUIPMENT, updatedEquipment);
            if (syncEnabled) {
              const updatedItem = updatedEquipment.find(e => e.id === log.equipmentId);
              if (updatedItem) pushToSupabase('equipment', equipmentToDb(updatedItem, orgId, userId), 'upsert');
            }
          }
        }
      }

      const item = updated.find(l => l.id === updates.id);
      if (syncEnabled && item) {
        pushToSupabase('maintenance_logs', maintenanceLogToDb(item, orgId, userId), 'upsert');
        logAudit('update', 'maintenance_log', item.id, item.description || 'Maintenance log');
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const deleteMaintenanceLogMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = maintenanceLogs.find(l => l.id === id);
      const updated = maintenanceLogs.filter(l => l.id !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updated);

      if (syncEnabled) {
        pushToSupabase('maintenance_logs', { id }, 'delete');
        if (item) logAudit('delete', 'maintenance_log', id, item.description || 'Maintenance log');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
    },
  });

  const addIntervalMutation = useMutation({
    mutationFn: async (interval: Omit<MaintenanceInterval, 'id'>) => {
      const newInterval: MaintenanceInterval = {
        ...interval,
        id: generateId(),
      };
      const updated = [...intervals, newInterval];
      await saveData(STORAGE_KEYS.INTERVALS, updated);

      if (syncEnabled) {
        pushToSupabase('maintenance_intervals', intervalToDb(newInterval, orgId, userId), 'upsert');
        logAudit('create', 'maintenance_interval', newInterval.id, newInterval.name);
      }
      return newInterval;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
    },
  });

  const updateIntervalMutation = useMutation({
    mutationFn: async (updates: Partial<MaintenanceInterval> & { id: string }) => {
      const updated = intervals.map(i =>
        i.id === updates.id ? { ...i, ...updates } : i
      );
      await saveData(STORAGE_KEYS.INTERVALS, updated);

      const item = updated.find(i => i.id === updates.id);
      if (syncEnabled && item) {
        pushToSupabase('maintenance_intervals', intervalToDb(item, orgId, userId), 'upsert');
        logAudit('update', 'maintenance_interval', item.id, item.name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
    },
  });

  const addConsumableMutation = useMutation({
    mutationFn: async (newConsumable: Omit<Consumable, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const consumableItem: Consumable = {
        ...newConsumable,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...consumables, consumableItem];
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);

      if (syncEnabled) {
        pushToSupabase('consumables', consumableToDb(consumableItem, orgId, userId), 'upsert');
        logAudit('create', 'consumable', consumableItem.id, consumableItem.name);
      }
      return consumableItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
    },
  });

  const updateConsumableMutation = useMutation({
    mutationFn: async (updates: Partial<Consumable> & { id: string }) => {
      const updated = consumables.map(c =>
        c.id === updates.id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      );
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);

      const item = updated.find(c => c.id === updates.id);
      if (syncEnabled && item) {
        pushToSupabase('consumables', consumableToDb(item, orgId, userId), 'upsert');
        logAudit('update', 'consumable', item.id, item.name);
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
    },
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = consumables.find(c => c.id === id);
      const updated = consumables.filter(c => c.id !== id);
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);

      if (syncEnabled) {
        pushToSupabase('consumables', { id }, 'delete');
        if (item) logAudit('delete', 'consumable', id, item.name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
    },
  });

  const deductConsumablesMutation = useMutation({
    mutationFn: async (items: { consumableId: string; quantity: number }[]) => {
      const updated = consumables.map(c => {
        const deduction = items.find(i => i.consumableId === c.id);
        if (deduction) {
          return {
            ...c,
            quantity: Math.max(0, c.quantity - deduction.quantity),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);

      if (syncEnabled) {
        for (const deduction of items) {
          const item = updated.find(c => c.id === deduction.consumableId);
          if (item) {
            pushToSupabase('consumables', consumableToDb(item, orgId, userId), 'upsert');
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
    },
  });

  const getMaintenanceLogById = useCallback(
    (id: string) => maintenanceLogs.find(l => l.id === id),
    [maintenanceLogs]
  );

  const getEquipmentById = useCallback(
    (id: string) => equipment.find(e => e.id === id),
    [equipment]
  );

  const getLogsForEquipment = useCallback(
    (equipmentId: string) =>
      maintenanceLogs
        .filter(l => l.equipmentId === equipmentId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [maintenanceLogs]
  );

  const getIntervalsForEquipment = useCallback(
    (equipmentId: string) => intervals.filter(i => i.equipmentId === equipmentId),
    [intervals]
  );

  const getConsumableById = useCallback(
    (id: string) => consumables.find(c => c.id === id),
    [consumables]
  );

  const getLowStockConsumables = useCallback(
    () => consumables.filter(c => c.quantity <= c.lowStockThreshold),
    [consumables]
  );

  const bulkAddConsumablesMutation = useMutation({
    mutationFn: async (newConsumables: Omit<Consumable, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      const now = new Date().toISOString();
      const consumableItems: Consumable[] = newConsumables.map(c => ({
        ...c,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }));
      const updated = [...consumables, ...consumableItems];
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);

      if (syncEnabled) {
        for (const item of consumableItems) {
          pushToSupabase('consumables', consumableToDb(item, orgId, userId), 'upsert');
        }
        logAudit('create', 'consumable', 'bulk', `Bulk add: ${consumableItems.length} parts`);
      }
      return consumableItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
    },
  });

  const bulkAddEquipmentMutation = useMutation({
    mutationFn: async (newEquipmentList: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      const now = new Date().toISOString();
      const equipmentItems: Equipment[] = newEquipmentList.map(e => ({
        ...e,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }));
      const updated = [...equipment, ...equipmentItems];
      await saveData(STORAGE_KEYS.EQUIPMENT, updated);

      if (syncEnabled) {
        for (const item of equipmentItems) {
          pushToSupabase('equipment', equipmentToDb(item, orgId, userId), 'upsert');
        }
        logAudit('create', 'equipment', 'bulk', `Bulk add: ${equipmentItems.length} equipment`);
      }
      return equipmentItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const addServiceRoutineMutation = useMutation({
    mutationFn: async (newRoutine: Omit<ServiceRoutine, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const routineItem: ServiceRoutine = {
        ...newRoutine,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...serviceRoutines, routineItem];
      await saveData(STORAGE_KEYS.SERVICE_ROUTINES, updated);

      if (syncEnabled) {
        pushToSupabase('service_routines', routineToDb(routineItem, orgId, userId), 'upsert');
        logAudit('create', 'service_routine', routineItem.id, routineItem.name);
      }
      return routineItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
    },
  });

  const updateServiceRoutineMutation = useMutation({
    mutationFn: async (updates: Partial<ServiceRoutine> & { id: string }) => {
      const updated = serviceRoutines.map(r =>
        r.id === updates.id
          ? { ...r, ...updates, updatedAt: new Date().toISOString() }
          : r
      );
      await saveData(STORAGE_KEYS.SERVICE_ROUTINES, updated);

      const item = updated.find(r => r.id === updates.id);
      if (syncEnabled && item) {
        pushToSupabase('service_routines', routineToDb(item, orgId, userId), 'upsert');
        logAudit('update', 'service_routine', item.id, item.name);
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
    },
  });

  const deleteServiceRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = serviceRoutines.find(r => r.id === id);
      const updated = serviceRoutines.filter(r => r.id !== id);
      await saveData(STORAGE_KEYS.SERVICE_ROUTINES, updated);

      if (syncEnabled) {
        pushToSupabase('service_routines', { id }, 'delete');
        if (item) logAudit('delete', 'service_routine', id, item.name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
    },
  });

  const getServiceRoutineById = useCallback(
    (id: string) => serviceRoutines.find(r => r.id === id),
    [serviceRoutines]
  );

  const addInspectionRoutineMutation = useMutation({
    mutationFn: async (newRoutine: Omit<InspectionRoutine, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const routineItem: InspectionRoutine = {
        ...newRoutine,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...inspectionRoutines, routineItem];
      await saveData(STORAGE_KEYS.INSPECTION_ROUTINES, updated);

      if (syncEnabled) {
        pushToSupabase('inspection_routines', routineToDb(routineItem, orgId, userId), 'upsert');
        logAudit('create', 'inspection_routine', routineItem.id, routineItem.name);
      }
      return routineItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
    },
  });

  const updateInspectionRoutineMutation = useMutation({
    mutationFn: async (updates: Partial<InspectionRoutine> & { id: string }) => {
      const updated = inspectionRoutines.map(r =>
        r.id === updates.id
          ? { ...r, ...updates, updatedAt: new Date().toISOString() }
          : r
      );
      await saveData(STORAGE_KEYS.INSPECTION_ROUTINES, updated);

      const item = updated.find(r => r.id === updates.id);
      if (syncEnabled && item) {
        pushToSupabase('inspection_routines', routineToDb(item, orgId, userId), 'upsert');
        logAudit('update', 'inspection_routine', item.id, item.name);
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
    },
  });

  const deleteInspectionRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = inspectionRoutines.find(r => r.id === id);
      const updated = inspectionRoutines.filter(r => r.id !== id);
      await saveData(STORAGE_KEYS.INSPECTION_ROUTINES, updated);

      if (syncEnabled) {
        pushToSupabase('inspection_routines', { id }, 'delete');
        if (item) logAudit('delete', 'inspection_routine', id, item.name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
    },
  });

  const getInspectionRoutineById = useCallback(
    (id: string) => inspectionRoutines.find(r => r.id === id),
    [inspectionRoutines]
  );

  const isLoading =
    equipmentQuery.isLoading ||
    maintenanceLogsQuery.isLoading ||
    intervalsQuery.isLoading ||
    consumablesQuery.isLoading ||
    serviceRoutinesQuery.isLoading ||
    inspectionRoutinesQuery.isLoading;

  useEffect(() => {
    if (!isLoading) {
      console.log('Data loaded - Equipment:', equipment.length, 'Logs:', maintenanceLogs.length, 'Consumables:', consumables.length);
    }
  }, [isLoading, equipment.length, maintenanceLogs.length, consumables.length]);

  return {
    equipment,
    maintenanceLogs,
    intervals,
    consumables,
    serviceRoutines,
    inspectionRoutines,
    isLoading,
    isSyncing,
    lastSyncTime,
    syncEnabled,
    addEquipment: addEquipmentMutation.mutateAsync,
    updateEquipment: updateEquipmentMutation.mutateAsync,
    deleteEquipment: deleteEquipmentMutation.mutateAsync,
    addMaintenanceLog: addMaintenanceLogMutation.mutateAsync,
    updateMaintenanceLog: updateMaintenanceLogMutation.mutateAsync,
    deleteMaintenanceLog: deleteMaintenanceLogMutation.mutateAsync,
    getMaintenanceLogById,
    addInterval: addIntervalMutation.mutateAsync,
    updateInterval: updateIntervalMutation.mutateAsync,
    getEquipmentById,
    getLogsForEquipment,
    getIntervalsForEquipment,
    addConsumable: addConsumableMutation.mutateAsync,
    updateConsumable: updateConsumableMutation.mutateAsync,
    deleteConsumable: deleteConsumableMutation.mutateAsync,
    deductConsumables: deductConsumablesMutation.mutateAsync,
    getConsumableById,
    getLowStockConsumables,
    bulkAddConsumables: bulkAddConsumablesMutation.mutateAsync,
    bulkAddEquipment: bulkAddEquipmentMutation.mutateAsync,
    addServiceRoutine: addServiceRoutineMutation.mutateAsync,
    updateServiceRoutine: updateServiceRoutineMutation.mutateAsync,
    deleteServiceRoutine: deleteServiceRoutineMutation.mutateAsync,
    getServiceRoutineById,
    addInspectionRoutine: addInspectionRoutineMutation.mutateAsync,
    updateInspectionRoutine: updateInspectionRoutineMutation.mutateAsync,
    deleteInspectionRoutine: deleteInspectionRoutineMutation.mutateAsync,
    getInspectionRoutineById,
    pullFromSupabase,
    migrateLocalData,
  };
});
