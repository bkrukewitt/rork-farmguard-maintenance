import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Equipment, MaintenanceLog, MaintenanceInterval, Consumable, ServiceRoutine, InspectionRoutine, WorkOrder, Employee } from '@/types/equipment';
import { generateId } from '@/utils/helpers';
import { supabase } from '@/lib/supabase';
import { trpcClient } from '@/lib/trpc';

const STORAGE_KEYS = {
  EQUIPMENT: 'farmguard_equipment',
  MAINTENANCE_LOGS: 'farmguard_maintenance_logs',
  INTERVALS: 'farmguard_intervals',
  CONSUMABLES: 'farmguard_consumables',
  SERVICE_ROUTINES: 'farmguard_service_routines',
  INSPECTION_ROUTINES: 'farmguard_inspection_routines',
  WORK_ORDERS: 'farmguard_work_orders',
  EMPLOYEES: 'farmguard_employees',
  DELETED_IDS: 'farmguard_deleted_ids',
  FARM_ID: 'farmguard_farm_id',
  DEVICE_ID: 'farmguard_device_id',
  IS_FARM_CREATOR: 'farmguard_is_farm_creator',
  DISPLAY_NAME: 'farmguard_display_name',
  FARM_PASSWORD: 'farmguard_farm_password',
};

export interface FarmMember {
  id: number;
  farm_id: string;
  device_id: string;
  role: 'admin' | 'member';
  display_name: string | null;
  joined_at: string;
  last_active_at: string;
}

interface FarmDataPayload {
  equipment: Equipment[];
  maintenanceLogs: MaintenanceLog[];
  intervals: MaintenanceInterval[];
  consumables: Consumable[];
  serviceRoutines: ServiceRoutine[];
  inspectionRoutines: InspectionRoutine[];
  workOrders: WorkOrder[];
  employees: Employee[];
  deletedIds?: string[];
  joinPassword?: string | null;
}

export interface DuplicateItem {
  type: 'equipment' | 'consumable' | 'serviceRoutine' | 'inspectionRoutine';
  local: Equipment | Consumable | ServiceRoutine | InspectionRoutine;
  remote: Equipment | Consumable | ServiceRoutine | InspectionRoutine;
  resolution?: 'keep_local' | 'keep_remote' | 'keep_both';
}

export interface DuplicateResolutionResult {
  duplicates: DuplicateItem[];
  hasLocalData: boolean;
  hasRemoteData: boolean;
}

const DEFAULT_PAYLOAD: FarmDataPayload = {
  equipment: [],
  maintenanceLogs: [],
  intervals: [],
  consumables: [],
  serviceRoutines: [],
  inspectionRoutines: [],
  workOrders: [],
  employees: [],
  deletedIds: [],
};

async function loadData<T>(key: string): Promise<T[]> {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      console.log(`Data loaded successfully: ${key}, items: ${parsed.length}`);
      return parsed;
    } else {
      console.log(`No data found for key: ${key}`);
      return [];
    }
  } catch (error) {
    console.error(`Error loading data: ${key}`, error);
    return [];
  }
}

async function saveData<T>(key: string, data: T[]): Promise<void> {
  try {
    const jsonData = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonData);
    console.log(`Data saved successfully: ${key}, items: ${data.length}`);
  } catch (error) {
    console.error(`Error saving data: ${key}`, error);
    throw error;
  }
}

async function getFarmId(): Promise<string> {
  try {
    const farmId = await AsyncStorage.getItem(STORAGE_KEYS.FARM_ID);
    return farmId || '';
  } catch (error) {
    console.error('Error getting farm ID:', error);
    return '';
  }
}

async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = generateId();
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      console.log(`Generated new device ID: ${deviceId}`);
    }
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    return generateId();
  }
}

export async function verifyFarmPasswordForId(targetFarmId: string, password: string): Promise<{ valid: boolean; hasPassword: boolean }> {
  try {
    const result = await trpcClient.farm.verifyFarmPassword.mutate({
      farmId: targetFarmId,
      password,
    });
    return result;
  } catch (err) {
    console.error('[Auth] Error verifying farm password:', err);
    return { valid: false, hasPassword: true };
  }
}

export async function checkFarmHasPassword(targetFarmId: string): Promise<boolean> {
  try {
    const result = await trpcClient.farm.verifyFarmPassword.mutate({
      farmId: targetFarmId,
      password: '',
    });
    return result.hasPassword;
  } catch {
    return false;
  }
}

async function fetchRemoteData(farmId: string): Promise<FarmDataPayload | null> {
  try {
    const { data, error } = await supabase
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching remote farm data:', JSON.stringify(error));
      return null;
    }
    if (!data?.data) return null;

    const rd = data.data as Record<string, unknown>;
    return {
      equipment: (rd.equipment as Equipment[]) || [],
      maintenanceLogs: (rd.maintenanceLogs as MaintenanceLog[]) || [],
      intervals: (rd.intervals as MaintenanceInterval[]) || [],
      consumables: (rd.consumables as Consumable[]) || [],
      serviceRoutines: (rd.serviceRoutines as ServiceRoutine[]) || [],
      inspectionRoutines: (rd.inspectionRoutines as InspectionRoutine[]) || [],
      workOrders: (rd.workOrders as WorkOrder[]) || [],
      employees: (rd.employees as Employee[]) || [],
      deletedIds: (rd.deletedIds as string[]) || [],
      joinPassword: (rd._joinPassword as string) || null,
    };
  } catch (error) {
    console.error('Error fetching remote farm data:', JSON.stringify(error));
    return null;
  }
}

export const [FarmDataProvider, useFarmData] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [farmId, setFarmId] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState<string | null>(null);
  const deletedIdsRef = useRef<string[]>([]);
  const skipAutoMergeRef = useRef(false);
  const initialMergeDoneRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>('active');

  useEffect(() => {
    void getFarmId().then(setFarmId);
    void getDeviceId().then(setDeviceId);
    void AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME).then(name => {
      if (name) setDisplayName(name);
    });
    void SecureStore.getItemAsync('farmguard_farm_password').then(pw => {
      if (pw) setJoinPassword(pw);
    }).catch(() => {
      void AsyncStorage.getItem(STORAGE_KEYS.FARM_PASSWORD).then(async (pw) => {
        if (pw) {
          setJoinPassword(pw);
          await SecureStore.setItemAsync('farmguard_farm_password', pw);
          await AsyncStorage.removeItem(STORAGE_KEYS.FARM_PASSWORD);
          console.log('[Security] Migrated farm password from AsyncStorage to SecureStore');
        }
      });
    });
    void loadData<string>(STORAGE_KEYS.DELETED_IDS).then(ids => {
      if (ids.length > 0) {
        console.log(`[Init] Loaded ${ids.length} tombstoned IDs`);
        deletedIdsRef.current = ids;
      }
    });
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[AppState] App came to foreground, refreshing data...');
        initialMergeDoneRef.current = false;
        skipAutoMergeRef.current = false;
        void queryClient.invalidateQueries({ queryKey: ['remoteData'] });
        void queryClient.invalidateQueries({ queryKey: ['farmMembers'] });
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [queryClient]);

  const addTombstones = useCallback(async (ids: string[]) => {
    const current = deletedIdsRef.current;
    const updated = [...new Set([...current, ...ids])];
    deletedIdsRef.current = updated;
    await saveData(STORAGE_KEYS.DELETED_IDS, updated);
    console.log(`[Tombstone] Added ${ids.length} IDs. Total tombstones: ${updated.length}`);
    return updated;
  }, []);

  const memberRegistrationQuery = useQuery({
    queryKey: ['memberRegistration', farmId, deviceId],
    queryFn: async () => {
      if (!farmId || !deviceId) return null;
      console.log(`[Supabase] Registering device ${deviceId} for farm ${farmId}`);

      const { error: farmError } = await supabase.from('farms').upsert({ id: farmId }, { onConflict: 'id' });
      if (farmError) {
        console.error('[Supabase] Error upserting farm:', JSON.stringify(farmError));
        throw new Error(`Failed to register farm: ${farmError.message}`);
      }

      const { data: existing, error: existingError } = await supabase
        .from('farm_members')
        .select('*')
        .eq('farm_id', farmId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (existingError) {
        console.error('[Supabase] Error checking existing member:', JSON.stringify(existingError));
      }

      if (existing) {
        const storedName = await AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);
        const updatePayload: Record<string, string> = { last_active_at: new Date().toISOString() };
        if (storedName) updatePayload.display_name = storedName;
        const { error: updateError } = await supabase
          .from('farm_members')
          .update(updatePayload)
          .eq('farm_id', farmId)
          .eq('device_id', deviceId);
        if (updateError) {
          console.error('[Supabase] Error updating member:', JSON.stringify(updateError));
        }
        console.log(`[Supabase] Existing member updated, role: ${existing.role}`);
        return existing as FarmMember;
      }

      const isCreatorStr = await AsyncStorage.getItem(STORAGE_KEYS.IS_FARM_CREATOR);
      const isCreator = isCreatorStr === 'true';

      const { count } = await supabase
        .from('farm_members')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', farmId);

      const role = (isCreator || count === 0 || count === null) ? 'admin' : 'member';

      const storedDisplayName = await AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);
      const { data: newMember, error } = await supabase
        .from('farm_members')
        .insert({
          farm_id: farmId,
          device_id: deviceId,
          role,
          display_name: storedDisplayName || null,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Supabase] Error registering member:', JSON.stringify(error));
        throw new Error(`Failed to register member: ${error.message || error.code || JSON.stringify(error)}`);
      }

      console.log(`[Supabase] New member registered, role: ${role}`);
      return newMember as FarmMember;
    },
    enabled: !!farmId && !!deviceId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const isAdmin = memberRegistrationQuery.data?.role === 'admin';

  const farmMembersQuery = useQuery({
    queryKey: ['farmMembers', farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from('farm_members')
        .select('*')
        .eq('farm_id', farmId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('[Supabase] Error fetching farm members:', JSON.stringify(error));
        return [];
      }
      return (data || []) as FarmMember[];
    },
    enabled: !!farmId,
    staleTime: 1000 * 60 * 1,
    refetchOnMount: true,
  });

  const farmMembers = useMemo(() => farmMembersQuery.data ?? [], [farmMembersQuery.data]);

  const remoteDataQuery = useQuery({
    queryKey: ['remoteData', farmId],
    queryFn: () => fetchRemoteData(farmId),
    enabled: !!farmId,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const equipmentQuery = useQuery({
    queryKey: ['equipment'],
    queryFn: () => loadData<Equipment>(STORAGE_KEYS.EQUIPMENT),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const maintenanceLogsQuery = useQuery({
    queryKey: ['maintenanceLogs'],
    queryFn: () => loadData<MaintenanceLog>(STORAGE_KEYS.MAINTENANCE_LOGS),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const intervalsQuery = useQuery({
    queryKey: ['intervals'],
    queryFn: () => loadData<MaintenanceInterval>(STORAGE_KEYS.INTERVALS),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const consumablesQuery = useQuery({
    queryKey: ['consumables'],
    queryFn: () => loadData<Consumable>(STORAGE_KEYS.CONSUMABLES),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const serviceRoutinesQuery = useQuery({
    queryKey: ['serviceRoutines'],
    queryFn: () => loadData<ServiceRoutine>(STORAGE_KEYS.SERVICE_ROUTINES),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const inspectionRoutinesQuery = useQuery({
    queryKey: ['inspectionRoutines'],
    queryFn: () => loadData<InspectionRoutine>(STORAGE_KEYS.INSPECTION_ROUTINES),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const workOrdersQuery = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => loadData<WorkOrder>(STORAGE_KEYS.WORK_ORDERS),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: () => loadData<Employee>(STORAGE_KEYS.EMPLOYEES),
    staleTime: 120000,
    gcTime: 300000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: false,
  });

  const equipment = useMemo(() => equipmentQuery.data ?? [], [equipmentQuery.data]);
  const maintenanceLogs = useMemo(() => maintenanceLogsQuery.data ?? [], [maintenanceLogsQuery.data]);
  const intervals = useMemo(() => intervalsQuery.data ?? [], [intervalsQuery.data]);
  const consumables = useMemo(() => consumablesQuery.data ?? [], [consumablesQuery.data]);
  const serviceRoutines = useMemo(() => serviceRoutinesQuery.data ?? [], [serviceRoutinesQuery.data]);
  const inspectionRoutines = useMemo(() => inspectionRoutinesQuery.data ?? [], [inspectionRoutinesQuery.data]);
  const workOrders = useMemo(() => workOrdersQuery.data ?? [], [workOrdersQuery.data]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const mergeArraysSmart = useCallback(<T extends { id: string }>(local: T[], remoteArr: T[], tombstoneSet: Set<string>): T[] => {
    const map = new Map<string, T>();
    local.forEach(item => {
      if (!tombstoneSet.has(item.id)) {
        map.set(item.id, item);
      }
    });
    remoteArr.forEach(item => {
      if (tombstoneSet.has(item.id)) return;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const localUpdated = (existing as Record<string, unknown>).updatedAt as string | undefined;
        const remoteUpdated = (item as Record<string, unknown>).updatedAt as string | undefined;
        if (localUpdated && remoteUpdated && remoteUpdated > localUpdated) {
          map.set(item.id, item);
        }
        const localCreated = (existing as Record<string, unknown>).createdAt as string | undefined;
        const remoteCreated = (item as Record<string, unknown>).createdAt as string | undefined;
        if (!localUpdated && !remoteUpdated && localCreated && remoteCreated && remoteCreated > localCreated) {
          map.set(item.id, item);
        }
      }
    });
    return Array.from(map.values());
  }, []);

  const mergeDeletedIds = useCallback((localIds: string[], remoteIds: string[]): string[] => {
    return [...new Set([...localIds, ...remoteIds])];
  }, []);

  useEffect(() => {
    if (remoteDataQuery.data && farmId) {
      if (skipAutoMergeRef.current) {
        console.log('[AutoMerge] Skipping auto-merge (recently mutated or resolved duplicates)');
        skipAutoMergeRef.current = false;
        return;
      }

      if (initialMergeDoneRef.current) {
        console.log('[AutoMerge] Initial merge already done, skipping background re-merge');
        return;
      }

      const remote = remoteDataQuery.data;
      const remoteDeletedIds = remote.deletedIds ?? [];
      const combinedDeletedIds = mergeDeletedIds(deletedIdsRef.current, remoteDeletedIds);
      const tombstoneSet = new Set(combinedDeletedIds);

      const hasRemoteData =
        remote.equipment.length > 0 ||
        remote.maintenanceLogs.length > 0 ||
        remote.consumables.length > 0 ||
        remote.intervals.length > 0 ||
        remote.serviceRoutines.length > 0 ||
        remote.inspectionRoutines.length > 0 ||
        remote.workOrders.length > 0 ||
        remote.employees.length > 0;

      if (hasRemoteData || remoteDeletedIds.length > 0) {
        console.log('[AutoMerge] Initial remote data found, merging with local... Tombstones:', combinedDeletedIds.length);

        const mergedEquipment = mergeArraysSmart(equipment, remote.equipment, tombstoneSet);
        const mergedLogs = mergeArraysSmart(maintenanceLogs, remote.maintenanceLogs, tombstoneSet);
        const mergedConsumables = mergeArraysSmart(consumables, remote.consumables, tombstoneSet);
        const mergedIntervals = mergeArraysSmart(intervals, remote.intervals, tombstoneSet);
        const mergedServiceRoutines = mergeArraysSmart(serviceRoutines, remote.serviceRoutines, tombstoneSet);
        const mergedInspectionRoutines = mergeArraysSmart(inspectionRoutines, remote.inspectionRoutines, tombstoneSet);
        const mergedWorkOrders = mergeArraysSmart(workOrders, remote.workOrders, tombstoneSet);
        const mergedEmployees = mergeArraysSmart(employees, remote.employees, tombstoneSet);

        deletedIdsRef.current = combinedDeletedIds;

        void Promise.all([
          saveData(STORAGE_KEYS.EQUIPMENT, mergedEquipment),
          saveData(STORAGE_KEYS.MAINTENANCE_LOGS, mergedLogs),
          saveData(STORAGE_KEYS.CONSUMABLES, mergedConsumables),
          saveData(STORAGE_KEYS.INTERVALS, mergedIntervals),
          saveData(STORAGE_KEYS.SERVICE_ROUTINES, mergedServiceRoutines),
          saveData(STORAGE_KEYS.INSPECTION_ROUTINES, mergedInspectionRoutines),
          saveData(STORAGE_KEYS.WORK_ORDERS, mergedWorkOrders),
          saveData(STORAGE_KEYS.EMPLOYEES, mergedEmployees),
          saveData(STORAGE_KEYS.DELETED_IDS, combinedDeletedIds),
        ]).then(() => {
          void queryClient.invalidateQueries({ queryKey: ['equipment'] });
          void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
          void queryClient.invalidateQueries({ queryKey: ['consumables'] });
          void queryClient.invalidateQueries({ queryKey: ['intervals'] });
          void queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
          void queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
          void queryClient.invalidateQueries({ queryKey: ['workOrders'] });
          void queryClient.invalidateQueries({ queryKey: ['employees'] });
          initialMergeDoneRef.current = true;
          console.log('[AutoMerge] Initial merge completed and saved locally');
        });
      } else {
        initialMergeDoneRef.current = true;
      }
    }
  }, [remoteDataQuery.data, farmId, equipment, maintenanceLogs, consumables, intervals, serviceRoutines, inspectionRoutines, workOrders, employees, mergeArraysSmart, mergeDeletedIds, queryClient]);

  const syncToServer = useCallback(async (options?: { skipMerge?: boolean }) => {
    if (!farmId) return;

    const shouldSkipMerge = options?.skipMerge ?? false;
    setIsSyncing(true);
    try {
      console.log(`[Sync] Starting sync for farm: ${farmId}, skipMerge: ${shouldSkipMerge}`);
      await supabase.from('farms').upsert({ id: farmId }, { onConflict: 'id' });

      const currentEquipment = await loadData<Equipment>(STORAGE_KEYS.EQUIPMENT);
      const currentLogs = await loadData<MaintenanceLog>(STORAGE_KEYS.MAINTENANCE_LOGS);
      const currentIntervals = await loadData<MaintenanceInterval>(STORAGE_KEYS.INTERVALS);
      const currentConsumables = await loadData<Consumable>(STORAGE_KEYS.CONSUMABLES);
      const currentServiceRoutines = await loadData<ServiceRoutine>(STORAGE_KEYS.SERVICE_ROUTINES);
      const currentInspectionRoutines = await loadData<InspectionRoutine>(STORAGE_KEYS.INSPECTION_ROUTINES);
      const currentWorkOrders = await loadData<WorkOrder>(STORAGE_KEYS.WORK_ORDERS);
      const currentEmployees = await loadData<Employee>(STORAGE_KEYS.EMPLOYEES);
      const currentDeletedIds = await loadData<string>(STORAGE_KEYS.DELETED_IDS);

      let finalEquipment = currentEquipment;
      let finalLogs = currentLogs;
      let finalIntervals = currentIntervals;
      let finalConsumables = currentConsumables;
      let finalServiceRoutines = currentServiceRoutines;
      let finalInspectionRoutines = currentInspectionRoutines;
      let finalWorkOrders = currentWorkOrders;
      let finalEmployees = currentEmployees;
      let finalDeletedIds = currentDeletedIds;

      if (!shouldSkipMerge) {
        const remoteData = await fetchRemoteData(farmId);
        console.log('[Sync] Remote data fetched:', remoteData ? 'found' : 'none');

        if (remoteData) {
          const remoteDeletedIds = remoteData.deletedIds ?? [];
          finalDeletedIds = mergeDeletedIds(currentDeletedIds, remoteDeletedIds);
          const tombstoneSet = new Set(finalDeletedIds);

          console.log(`[Sync] Combined tombstones: ${finalDeletedIds.length} (local: ${currentDeletedIds.length}, remote: ${remoteDeletedIds.length})`);

          finalEquipment = mergeArraysSmart(currentEquipment, remoteData.equipment, tombstoneSet);
          finalLogs = mergeArraysSmart(currentLogs, remoteData.maintenanceLogs, tombstoneSet);
          finalIntervals = mergeArraysSmart(currentIntervals, remoteData.intervals, tombstoneSet);
          finalConsumables = mergeArraysSmart(currentConsumables, remoteData.consumables, tombstoneSet);
          finalServiceRoutines = mergeArraysSmart(currentServiceRoutines, remoteData.serviceRoutines, tombstoneSet);
          finalInspectionRoutines = mergeArraysSmart(currentInspectionRoutines, remoteData.inspectionRoutines, tombstoneSet);
          finalWorkOrders = mergeArraysSmart(currentWorkOrders, remoteData.workOrders, tombstoneSet);
          finalEmployees = mergeArraysSmart(currentEmployees, remoteData.employees, tombstoneSet);

          console.log('[Sync] Merged counts - Equipment:', finalEquipment.length, 'Logs:', finalLogs.length, 'Consumables:', finalConsumables.length);

          deletedIdsRef.current = finalDeletedIds;

          await Promise.all([
            saveData(STORAGE_KEYS.EQUIPMENT, finalEquipment),
            saveData(STORAGE_KEYS.MAINTENANCE_LOGS, finalLogs),
            saveData(STORAGE_KEYS.INTERVALS, finalIntervals),
            saveData(STORAGE_KEYS.CONSUMABLES, finalConsumables),
            saveData(STORAGE_KEYS.SERVICE_ROUTINES, finalServiceRoutines),
            saveData(STORAGE_KEYS.INSPECTION_ROUTINES, finalInspectionRoutines),
            saveData(STORAGE_KEYS.WORK_ORDERS, finalWorkOrders),
            saveData(STORAGE_KEYS.EMPLOYEES, finalEmployees),
            saveData(STORAGE_KEYS.DELETED_IDS, finalDeletedIds),
          ]);
        }
      } else {
        console.log('[Sync] Skipping merge, pushing local data as source of truth');
      }

      const { error } = await supabase
        .from('farm_data')
        .upsert({
          farm_id: farmId,
          data: {
            equipment: finalEquipment,
            maintenanceLogs: finalLogs,
            intervals: finalIntervals,
            consumables: finalConsumables,
            serviceRoutines: finalServiceRoutines,
            inspectionRoutines: finalInspectionRoutines,
            workOrders: finalWorkOrders,
            employees: finalEmployees,
            deletedIds: finalDeletedIds,
            _joinPassword: joinPassword || null,
          },
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      skipAutoMergeRef.current = true;

      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void queryClient.invalidateQueries({ queryKey: ['intervals'] });
      void queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      void queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      void queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: ['remoteData'] });

      setLastSyncTime(new Date().toISOString());
      console.log('[Sync] Sync completed successfully');
    } catch (error) {
      console.error('[Sync] Failed to sync data to Supabase:', JSON.stringify(error));
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [farmId, mergeArraysSmart, mergeDeletedIds, queryClient, joinPassword]);

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
      return equipmentItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void syncToServer({ skipMerge: true });
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
      return updated.find(e => e.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log(`[Delete] Deleting equipment: ${id}`);
      const relatedLogIds = maintenanceLogs.filter(l => l.equipmentId === id).map(l => l.id);
      const relatedIntervalIds = intervals.filter(i => i.equipmentId === id).map(i => i.id);
      const allTombstoneIds = [id, ...relatedLogIds, ...relatedIntervalIds];

      await addTombstones(allTombstoneIds);

      const updated = equipment.filter(e => e.id !== id);
      await saveData(STORAGE_KEYS.EQUIPMENT, updated);
      const updatedLogs = maintenanceLogs.filter(l => l.equipmentId !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updatedLogs);
      const updatedIntervals = intervals.filter(i => i.equipmentId !== id);
      await saveData(STORAGE_KEYS.INTERVALS, updatedIntervals);
      console.log(`[Delete] Equipment deleted with ${allTombstoneIds.length} tombstones. Remaining: ${updated.length}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      void queryClient.invalidateQueries({ queryKey: ['intervals'] });
      void syncToServer({ skipMerge: true });
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
        }
      }

      return newLog;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void syncToServer({ skipMerge: true });
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
          }
        }
      }

      return updated.find(l => l.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteMaintenanceLogMutation = useMutation({
    mutationFn: async (id: string) => {
      await addTombstones([id]);
      const updated = maintenanceLogs.filter(l => l.id !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      void syncToServer({ skipMerge: true });
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
      return newInterval;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['intervals'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const updateIntervalMutation = useMutation({
    mutationFn: async (updates: Partial<MaintenanceInterval> & { id: string }) => {
      const updated = intervals.map(i =>
        i.id === updates.id ? { ...i, ...updates } : i
      );
      await saveData(STORAGE_KEYS.INTERVALS, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['intervals'] });
      void syncToServer({ skipMerge: true });
    },
  });

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
      return consumableItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void syncToServer({ skipMerge: true });
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
      return updated.find(c => c.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (id: string) => {
      await addTombstones([id]);
      const updated = consumables.filter(c => c.id !== id);
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void syncToServer({ skipMerge: true });
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
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const getMaintenanceLogById = useCallback(
    (id: string) => maintenanceLogs.find(l => l.id === id),
    [maintenanceLogs]
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
      return consumableItems;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void syncToServer({ skipMerge: true });
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
      return equipmentItems;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void syncToServer({ skipMerge: true });
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
      return routineItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      void syncToServer({ skipMerge: true });
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
      return updated.find(r => r.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteServiceRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      await addTombstones([id]);
      const updated = serviceRoutines.filter(r => r.id !== id);
      await saveData(STORAGE_KEYS.SERVICE_ROUTINES, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      void syncToServer({ skipMerge: true });
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
      return routineItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      void syncToServer({ skipMerge: true });
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
      return updated.find(r => r.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteInspectionRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      await addTombstones([id]);
      const updated = inspectionRoutines.filter(r => r.id !== id);
      await saveData(STORAGE_KEYS.INSPECTION_ROUTINES, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const getInspectionRoutineById = useCallback(
    (id: string) => inspectionRoutines.find(r => r.id === id),
    [inspectionRoutines]
  );

  const addWorkOrderMutation = useMutation({
    mutationFn: async (newWorkOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const workOrderItem: WorkOrder = {
        ...newWorkOrder,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...workOrders, workOrderItem];
      await saveData(STORAGE_KEYS.WORK_ORDERS, updated);
      return workOrderItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: async (updates: Partial<WorkOrder> & { id: string }) => {
      const updated = workOrders.map(w =>
        w.id === updates.id
          ? { ...w, ...updates, updatedAt: new Date().toISOString() }
          : w
      );
      await saveData(STORAGE_KEYS.WORK_ORDERS, updated);
      return updated.find(w => w.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteWorkOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      await addTombstones([id]);
      const updated = workOrders.filter(w => w.id !== id);
      await saveData(STORAGE_KEYS.WORK_ORDERS, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const getWorkOrderById = useCallback(
    (id: string) => workOrders.find(w => w.id === id),
    [workOrders]
  );

  const addEmployeeMutation = useMutation({
    mutationFn: async (newEmployee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const employeeItem: Employee = {
        ...newEmployee,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...employees, employeeItem];
      await saveData(STORAGE_KEYS.EMPLOYEES, updated);
      return employeeItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (updates: Partial<Employee> & { id: string }) => {
      const updated = employees.map(e =>
        e.id === updates.id
          ? { ...e, ...updates, updatedAt: new Date().toISOString() }
          : e
      );
      await saveData(STORAGE_KEYS.EMPLOYEES, updated);
      return updated.find(e => e.id === updates.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      await addTombstones([id]);
      const updated = employees.filter(e => e.id !== id);
      await saveData(STORAGE_KEYS.EMPLOYEES, updated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const getEmployeeById = useCallback(
    (id: string) => employees.find(e => e.id === id),
    [employees]
  );

  const setFarmIdAndSync = useCallback(async (newFarmId: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, newFarmId);
    setFarmId(newFarmId);
    initialMergeDoneRef.current = false;
    skipAutoMergeRef.current = false;
    void queryClient.invalidateQueries({ queryKey: ['remoteData'] });
    void queryClient.invalidateQueries({ queryKey: ['farmMembers'] });
    void queryClient.invalidateQueries({ queryKey: ['memberRegistration'] });
  }, [queryClient]);

  const checkForDuplicatesOnJoin = useCallback(async (newFarmId: string): Promise<DuplicateResolutionResult> => {
    const hasLocalData = equipment.length > 0 || consumables.length > 0 ||
                         serviceRoutines.length > 0 || inspectionRoutines.length > 0;

    let remoteData: FarmDataPayload = { ...DEFAULT_PAYLOAD };

    try {
      const result = await fetchRemoteData(newFarmId);
      if (result) {
        remoteData = result;
      }
    } catch (fetchError) {
      console.error('Error fetching remote farm data:', JSON.stringify(fetchError));
      throw fetchError;
    }

    const hasRemoteData = remoteData.equipment.length > 0 || remoteData.consumables.length > 0 ||
                          remoteData.serviceRoutines.length > 0 || remoteData.inspectionRoutines.length > 0;

    const duplicates: DuplicateItem[] = [];

    equipment.forEach(localItem => {
      const remoteMatch = remoteData.equipment.find((r: Equipment) =>
        (r.serialNumber && localItem.serialNumber && r.serialNumber.toLowerCase() === localItem.serialNumber.toLowerCase()) ||
        (r.name.toLowerCase() === localItem.name.toLowerCase() && r.make.toLowerCase() === localItem.make.toLowerCase() && r.model.toLowerCase() === localItem.model.toLowerCase())
      );
      if (remoteMatch) {
        duplicates.push({ type: 'equipment', local: localItem, remote: remoteMatch });
      }
    });

    consumables.forEach(localItem => {
      const remoteMatch = remoteData.consumables.find((r: Consumable) =>
        (r.partNumber && localItem.partNumber && r.partNumber.toLowerCase() === localItem.partNumber.toLowerCase()) ||
        r.name.toLowerCase() === localItem.name.toLowerCase()
      );
      if (remoteMatch) {
        duplicates.push({ type: 'consumable', local: localItem, remote: remoteMatch });
      }
    });

    serviceRoutines.forEach(localItem => {
      const remoteMatch = remoteData.serviceRoutines.find((r: ServiceRoutine) =>
        r.name.toLowerCase() === localItem.name.toLowerCase()
      );
      if (remoteMatch) {
        duplicates.push({ type: 'serviceRoutine', local: localItem, remote: remoteMatch });
      }
    });

    inspectionRoutines.forEach(localItem => {
      const remoteMatch = remoteData.inspectionRoutines.find((r: InspectionRoutine) =>
        r.name.toLowerCase() === localItem.name.toLowerCase()
      );
      if (remoteMatch) {
        duplicates.push({ type: 'inspectionRoutine', local: localItem, remote: remoteMatch });
      }
    });

    return { duplicates, hasLocalData, hasRemoteData };
  }, [equipment, consumables, serviceRoutines, inspectionRoutines]);

  const applyDuplicateResolutions = useCallback(async (
    newFarmId: string,
    resolutions: DuplicateItem[]
  ) => {
    let remoteData: FarmDataPayload = { ...DEFAULT_PAYLOAD };
    try {
      const result = await fetchRemoteData(newFarmId);
      if (result) {
        remoteData = result;
      }
    } catch (fetchError) {
      console.error('Error fetching remote farm data for apply:', JSON.stringify(fetchError));
    }

    let mergedEquipment = [...equipment];
    let mergedConsumables = [...consumables];
    let mergedServiceRoutines = [...serviceRoutines];
    let mergedInspectionRoutines = [...inspectionRoutines];
    let mergedLogs = [...maintenanceLogs];
    let mergedIntervals = [...intervals];
    let mergedWorkOrders = [...workOrders];
    let mergedEmployees = [...employees];

    const remoteDeletedIds = remoteData.deletedIds ?? [];
    const combinedDeletedIds = mergeDeletedIds(deletedIdsRef.current, remoteDeletedIds);
    deletedIdsRef.current = combinedDeletedIds;

    const equipmentResolutions = resolutions.filter(r => r.type === 'equipment');
    const consumableResolutions = resolutions.filter(r => r.type === 'consumable');
    const serviceResolutions = resolutions.filter(r => r.type === 'serviceRoutine');
    const inspectionResolutions = resolutions.filter(r => r.type === 'inspectionRoutine');

    remoteData.equipment.forEach((remoteItem: Equipment) => {
      const resolution = equipmentResolutions.find(r => (r.remote as Equipment).id === remoteItem.id);
      if (resolution) {
        if (resolution.resolution === 'keep_remote') {
          mergedEquipment = mergedEquipment.filter(e => e.id !== (resolution.local as Equipment).id);
          mergedEquipment.push(remoteItem);
        } else if (resolution.resolution === 'keep_both') {
          if (!mergedEquipment.find(e => e.id === remoteItem.id)) {
            mergedEquipment.push(remoteItem);
          }
        }
      } else if (!mergedEquipment.find(e => e.id === remoteItem.id)) {
        mergedEquipment.push(remoteItem);
      }
    });

    remoteData.consumables.forEach((remoteItem: Consumable) => {
      const resolution = consumableResolutions.find(r => (r.remote as Consumable).id === remoteItem.id);
      if (resolution) {
        if (resolution.resolution === 'keep_remote') {
          mergedConsumables = mergedConsumables.filter(c => c.id !== (resolution.local as Consumable).id);
          mergedConsumables.push(remoteItem);
        } else if (resolution.resolution === 'keep_both') {
          if (!mergedConsumables.find(c => c.id === remoteItem.id)) {
            mergedConsumables.push(remoteItem);
          }
        }
      } else if (!mergedConsumables.find(c => c.id === remoteItem.id)) {
        mergedConsumables.push(remoteItem);
      }
    });

    remoteData.serviceRoutines.forEach((remoteItem: ServiceRoutine) => {
      const resolution = serviceResolutions.find(r => (r.remote as ServiceRoutine).id === remoteItem.id);
      if (resolution) {
        if (resolution.resolution === 'keep_remote') {
          mergedServiceRoutines = mergedServiceRoutines.filter(s => s.id !== (resolution.local as ServiceRoutine).id);
          mergedServiceRoutines.push(remoteItem);
        } else if (resolution.resolution === 'keep_both') {
          if (!mergedServiceRoutines.find(s => s.id === remoteItem.id)) {
            mergedServiceRoutines.push(remoteItem);
          }
        }
      } else if (!mergedServiceRoutines.find(s => s.id === remoteItem.id)) {
        mergedServiceRoutines.push(remoteItem);
      }
    });

    remoteData.inspectionRoutines.forEach((remoteItem: InspectionRoutine) => {
      const resolution = inspectionResolutions.find(r => (r.remote as InspectionRoutine).id === remoteItem.id);
      if (resolution) {
        if (resolution.resolution === 'keep_remote') {
          mergedInspectionRoutines = mergedInspectionRoutines.filter(i => i.id !== (resolution.local as InspectionRoutine).id);
          mergedInspectionRoutines.push(remoteItem);
        } else if (resolution.resolution === 'keep_both') {
          if (!mergedInspectionRoutines.find(i => i.id === remoteItem.id)) {
            mergedInspectionRoutines.push(remoteItem);
          }
        }
      } else if (!mergedInspectionRoutines.find(i => i.id === remoteItem.id)) {
        mergedInspectionRoutines.push(remoteItem);
      }
    });

    remoteData.maintenanceLogs.forEach((remoteLog: MaintenanceLog) => {
      if (!mergedLogs.find(l => l.id === remoteLog.id)) {
        mergedLogs.push(remoteLog);
      }
    });

    remoteData.intervals.forEach((remoteInterval: MaintenanceInterval) => {
      if (!mergedIntervals.find(i => i.id === remoteInterval.id)) {
        mergedIntervals.push(remoteInterval);
      }
    });

    remoteData.workOrders.forEach((remoteItem: WorkOrder) => {
      if (!mergedWorkOrders.find(w => w.id === remoteItem.id)) {
        mergedWorkOrders.push(remoteItem);
      }
    });

    remoteData.employees.forEach((remoteItem: Employee) => {
      if (!mergedEmployees.find(e => e.id === remoteItem.id)) {
        mergedEmployees.push(remoteItem);
      }
    });

    const tombstoneSet = new Set(combinedDeletedIds);
    mergedEquipment = mergedEquipment.filter(e => !tombstoneSet.has(e.id));
    mergedConsumables = mergedConsumables.filter(c => !tombstoneSet.has(c.id));
    mergedServiceRoutines = mergedServiceRoutines.filter(s => !tombstoneSet.has(s.id));
    mergedInspectionRoutines = mergedInspectionRoutines.filter(i => !tombstoneSet.has(i.id));
    mergedLogs = mergedLogs.filter(l => !tombstoneSet.has(l.id));
    mergedIntervals = mergedIntervals.filter(i => !tombstoneSet.has(i.id));
    mergedWorkOrders = mergedWorkOrders.filter(w => !tombstoneSet.has(w.id));
    mergedEmployees = mergedEmployees.filter(e => !tombstoneSet.has(e.id));

    await Promise.all([
      saveData(STORAGE_KEYS.EQUIPMENT, mergedEquipment),
      saveData(STORAGE_KEYS.CONSUMABLES, mergedConsumables),
      saveData(STORAGE_KEYS.SERVICE_ROUTINES, mergedServiceRoutines),
      saveData(STORAGE_KEYS.INSPECTION_ROUTINES, mergedInspectionRoutines),
      saveData(STORAGE_KEYS.MAINTENANCE_LOGS, mergedLogs),
      saveData(STORAGE_KEYS.INTERVALS, mergedIntervals),
      saveData(STORAGE_KEYS.WORK_ORDERS, mergedWorkOrders),
      saveData(STORAGE_KEYS.EMPLOYEES, mergedEmployees),
      saveData(STORAGE_KEYS.DELETED_IDS, combinedDeletedIds),
    ]);

    await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, newFarmId);
    await AsyncStorage.setItem(STORAGE_KEYS.IS_FARM_CREATOR, 'false');

    skipAutoMergeRef.current = true;
    initialMergeDoneRef.current = true;

    setFarmId(newFarmId);

    await supabase.from('farms').upsert({ id: newFarmId });
    const storedName = await AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);
    await supabase.from('farm_members').upsert(
      {
        farm_id: newFarmId,
        device_id: deviceId,
        role: 'member' as const,
        display_name: storedName || null,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'farm_id,device_id' }
    );

    await supabase
      .from('farm_data')
      .upsert({
        farm_id: newFarmId,
        data: {
          equipment: mergedEquipment,
          maintenanceLogs: mergedLogs,
          intervals: mergedIntervals,
          consumables: mergedConsumables,
          serviceRoutines: mergedServiceRoutines,
          inspectionRoutines: mergedInspectionRoutines,
          workOrders: mergedWorkOrders,
          employees: mergedEmployees,
          deletedIds: combinedDeletedIds,
        },
        updated_at: new Date().toISOString(),
      });

    void queryClient.invalidateQueries({ queryKey: ['equipment'] });
    void queryClient.invalidateQueries({ queryKey: ['consumables'] });
    void queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
    void queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
    void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
    void queryClient.invalidateQueries({ queryKey: ['intervals'] });
    void queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
    void queryClient.invalidateQueries({ queryKey: ['remoteData'] });
    void queryClient.invalidateQueries({ queryKey: ['farmMembers'] });
    void queryClient.invalidateQueries({ queryKey: ['memberRegistration'] });

    console.log('[DuplicateResolution] Data merged, saved locally, and pushed to server');
  }, [equipment, consumables, serviceRoutines, inspectionRoutines, maintenanceLogs, intervals, workOrders, employees, deviceId, queryClient, mergeDeletedIds]);

  const createFarmMutation = useMutation({
    mutationFn: async (customId?: string) => {
      const newFarmId = customId?.trim() || generateId();
      if (/\s/.test(newFarmId)) throw new Error('Farm ID cannot contain spaces.');

      const { data: existing } = await supabase
        .from('farms')
        .select('id')
        .eq('id', newFarmId)
        .maybeSingle();
      if (existing) throw new Error('This Farm ID is already taken. Please choose a different one.');

      const { error: farmError } = await supabase
        .from('farms')
        .insert({ id: newFarmId });
      if (farmError) throw new Error(`Failed to create farm: ${farmError.message}`);

      await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, newFarmId);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_FARM_CREATOR, 'true');
      setFarmId(newFarmId);

      initialMergeDoneRef.current = false;
      skipAutoMergeRef.current = false;

      void queryClient.invalidateQueries({ queryKey: ['remoteData'] });
      void queryClient.invalidateQueries({ queryKey: ['farmMembers'] });
      void queryClient.invalidateQueries({ queryKey: ['memberRegistration'] });

      console.log(`[Farm] Created new farm: ${newFarmId}`);
      return newFarmId;
    },
  });

  const updateFarmIdMutation = useMutation({
    mutationFn: async (newFarmId: string) => {
      if (!isAdmin) {
        throw new Error('Only the farm admin can change the Farm ID.');
      }
      if (!newFarmId || newFarmId.trim().length === 0) {
        throw new Error('Farm ID cannot be empty.');
      }
      if (/\s/.test(newFarmId)) {
        throw new Error('Farm ID cannot contain spaces.');
      }
      const trimmed = newFarmId.trim();
      if (trimmed === farmId) {
        throw new Error('New Farm ID is the same as the current one.');
      }

      const { data: existing, error: checkError } = await supabase
        .from('farms')
        .select('id')
        .eq('id', trimmed)
        .maybeSingle();

      if (checkError) {
        console.error('[Supabase] Error checking farm ID availability:', JSON.stringify(checkError));
        throw new Error('Failed to check Farm ID availability. Please try again.');
      }
      if (existing) {
        throw new Error('This Farm ID is already taken. Please choose a different one.');
      }

      console.log(`[Supabase] Updating farm ID from ${farmId} to ${trimmed}`);

      const { error: insertError } = await supabase
        .from('farms')
        .insert({ id: trimmed });
      if (insertError) {
        console.error('[Supabase] Error creating new farm:', JSON.stringify(insertError));
        throw new Error('Failed to create new Farm ID. Please try again.');
      }

      const { data: farmData } = await supabase
        .from('farm_data')
        .select('*')
        .eq('farm_id', farmId)
        .maybeSingle();

      if (farmData) {
        const { error: dataError } = await supabase
          .from('farm_data')
          .upsert({
            farm_id: trimmed,
            data: farmData.data,
            updated_at: new Date().toISOString(),
          });
        if (dataError) {
          console.error('[Supabase] Error migrating farm data:', JSON.stringify(dataError));
          throw new Error('Failed to migrate farm data. Please try again.');
        }
      }

      const { data: members } = await supabase
        .from('farm_members')
        .select('*')
        .eq('farm_id', farmId);

      if (members && members.length > 0) {
        for (const member of members) {
          await supabase.from('farm_members').insert({
            farm_id: trimmed,
            device_id: member.device_id,
            role: member.role,
            display_name: member.display_name || null,
            joined_at: member.joined_at,
            last_active_at: member.last_active_at,
          });
        }
      }

      await supabase.from('farm_members').delete().eq('farm_id', farmId);
      await supabase.from('farm_data').delete().eq('farm_id', farmId);
      await supabase.from('farms').delete().eq('id', farmId);

      await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, trimmed);
      setFarmId(trimmed);

      initialMergeDoneRef.current = false;
      skipAutoMergeRef.current = false;

      void queryClient.invalidateQueries({ queryKey: ['remoteData'] });
      void queryClient.invalidateQueries({ queryKey: ['farmMembers'] });
      void queryClient.invalidateQueries({ queryKey: ['memberRegistration'] });

      console.log(`[Supabase] Farm ID updated successfully to ${trimmed}`);
      return trimmed;
    },
  });

  const setJoinPasswordMutation = useMutation({
    mutationFn: async (password: string | null) => {
      if (!isAdmin) throw new Error('Only the farm admin can set a join password.');
      const trimmed = password ? password.trim() : null;
      if (trimmed) {
        await SecureStore.setItemAsync('farmguard_farm_password', trimmed);
      } else {
        await SecureStore.deleteItemAsync('farmguard_farm_password');
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.FARM_PASSWORD);
      setJoinPassword(trimmed);

      const { data: existing } = await supabase
        .from('farm_data')
        .select('data')
        .eq('farm_id', farmId)
        .maybeSingle();

      const existingData = (existing?.data as Record<string, unknown>) || {};

      const { error } = await supabase.from('farm_data').upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _joinPassword: trimmed || null,
        },
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[Farm] Error setting join password:', JSON.stringify(error));
        throw new Error('Failed to update join password on server.');
      }

      console.log(`[Farm] Join password ${trimmed ? 'set' : 'removed'}`);
      return trimmed;
    },
  });

  const updateDisplayNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      await AsyncStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, trimmed);
      setDisplayName(trimmed);

      if (farmId && deviceId) {
        const { error } = await supabase
          .from('farm_members')
          .update({ display_name: trimmed })
          .eq('farm_id', farmId)
          .eq('device_id', deviceId);

        if (error) {
          console.error('[Supabase] Error updating display name:', JSON.stringify(error));
          throw new Error('Failed to update display name on server.');
        }
        console.log(`[Supabase] Display name updated to: ${trimmed}`);
      }
      return trimmed;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farmMembers', farmId] });
      void queryClient.invalidateQueries({ queryKey: ['memberRegistration', farmId, deviceId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (targetDeviceId: string) => {
      const { error } = await supabase
        .from('farm_members')
        .delete()
        .eq('farm_id', farmId)
        .eq('device_id', targetDeviceId);

      if (error) throw error;
      console.log(`[Supabase] Removed member ${targetDeviceId} from farm ${farmId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farmMembers', farmId] });
    },
  });

  const deleteFarmFromServerMutation = useMutation({
    mutationFn: async (targetFarmId: string) => {
      console.log(`[SuperAdmin] Deleting farm from server: ${targetFarmId}`);

      const { error: membersError } = await supabase
        .from('farm_members')
        .delete()
        .eq('farm_id', targetFarmId);
      if (membersError) {
        console.error('[SuperAdmin] Error deleting farm members:', JSON.stringify(membersError));
        throw new Error(`Failed to delete farm members: ${membersError.message}`);
      }

      const { error: dataError } = await supabase
        .from('farm_data')
        .delete()
        .eq('farm_id', targetFarmId);
      if (dataError) {
        console.error('[SuperAdmin] Error deleting farm data:', JSON.stringify(dataError));
        throw new Error(`Failed to delete farm data: ${dataError.message}`);
      }

      const { error: farmError } = await supabase
        .from('farms')
        .delete()
        .eq('id', targetFarmId);
      if (farmError) {
        console.error('[SuperAdmin] Error deleting farm:', JSON.stringify(farmError));
        throw new Error(`Failed to delete farm: ${farmError.message}`);
      }

      console.log(`[SuperAdmin] Farm ${targetFarmId} fully deleted from server`);
      return targetFarmId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['remoteData'] });
      void queryClient.invalidateQueries({ queryKey: ['farmMembers'] });
      void queryClient.invalidateQueries({ queryKey: ['memberRegistration'] });
    },
  });

  const forceDeleteEquipmentMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      console.log(`[SuperAdmin] Force deleting ${ids.length} equipment items`);
      const relatedLogIds = maintenanceLogs.filter(l => ids.includes(l.equipmentId)).map(l => l.id);
      const relatedIntervalIds = intervals.filter(i => ids.includes(i.equipmentId)).map(i => i.id);
      const allTombstoneIds = [...ids, ...relatedLogIds, ...relatedIntervalIds];
      await addTombstones(allTombstoneIds);

      const updatedEquip = equipment.filter(e => !ids.includes(e.id));
      const updatedLogs = maintenanceLogs.filter(l => !ids.includes(l.equipmentId));
      const updatedIntervals = intervals.filter(i => !ids.includes(i.equipmentId));
      await Promise.all([
        saveData(STORAGE_KEYS.EQUIPMENT, updatedEquip),
        saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updatedLogs),
        saveData(STORAGE_KEYS.INTERVALS, updatedIntervals),
      ]);
      console.log(`[SuperAdmin] Force deleted. Remaining equipment: ${updatedEquip.length}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      void queryClient.invalidateQueries({ queryKey: ['intervals'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const forceDeleteConsumableMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      console.log(`[SuperAdmin] Force deleting ${ids.length} consumables`);
      await addTombstones(ids);
      const updated = consumables.filter(c => !ids.includes(c.id));
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);
      console.log(`[SuperAdmin] Force deleted. Remaining consumables: ${updated.length}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consumables'] });
      void syncToServer({ skipMerge: true });
    },
  });

  const purgeAndResyncMutation = useMutation({
    mutationFn: async () => {
      console.log('[SuperAdmin] Purging local data and resyncing from server...');
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.EQUIPMENT),
        AsyncStorage.removeItem(STORAGE_KEYS.MAINTENANCE_LOGS),
        AsyncStorage.removeItem(STORAGE_KEYS.INTERVALS),
        AsyncStorage.removeItem(STORAGE_KEYS.CONSUMABLES),
        AsyncStorage.removeItem(STORAGE_KEYS.SERVICE_ROUTINES),
        AsyncStorage.removeItem(STORAGE_KEYS.INSPECTION_ROUTINES),
        AsyncStorage.removeItem(STORAGE_KEYS.WORK_ORDERS),
        AsyncStorage.removeItem(STORAGE_KEYS.EMPLOYEES),
        AsyncStorage.removeItem(STORAGE_KEYS.DELETED_IDS),
      ]);

      const remote = await fetchRemoteData(farmId);
      if (remote) {
        const remoteDeletedIds = remote.deletedIds ?? [];
        deletedIdsRef.current = remoteDeletedIds;

        await Promise.all([
          saveData(STORAGE_KEYS.EQUIPMENT, remote.equipment),
          saveData(STORAGE_KEYS.MAINTENANCE_LOGS, remote.maintenanceLogs),
          saveData(STORAGE_KEYS.INTERVALS, remote.intervals),
          saveData(STORAGE_KEYS.CONSUMABLES, remote.consumables),
          saveData(STORAGE_KEYS.SERVICE_ROUTINES, remote.serviceRoutines),
          saveData(STORAGE_KEYS.INSPECTION_ROUTINES, remote.inspectionRoutines),
          saveData(STORAGE_KEYS.WORK_ORDERS, remote.workOrders),
          saveData(STORAGE_KEYS.EMPLOYEES, remote.employees),
          saveData(STORAGE_KEYS.DELETED_IDS, remoteDeletedIds),
        ]);
        console.log('[SuperAdmin] Local data replaced with server data');
      } else {
        deletedIdsRef.current = [];
        console.log('[SuperAdmin] No remote data found, local data cleared');
      }

      initialMergeDoneRef.current = true;
      skipAutoMergeRef.current = true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  const manualSync = useCallback(async () => {
    console.log('[Manual Sync] Triggering manual sync with full merge...');
    initialMergeDoneRef.current = false;
    skipAutoMergeRef.current = false;
    await syncToServer({ skipMerge: false });
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['equipment'] }),
      queryClient.refetchQueries({ queryKey: ['maintenanceLogs'] }),
      queryClient.refetchQueries({ queryKey: ['consumables'] }),
      queryClient.refetchQueries({ queryKey: ['intervals'] }),
      queryClient.refetchQueries({ queryKey: ['serviceRoutines'] }),
      queryClient.refetchQueries({ queryKey: ['inspectionRoutines'] }),
      queryClient.refetchQueries({ queryKey: ['workOrders'] }),
      queryClient.refetchQueries({ queryKey: ['employees'] }),
      queryClient.refetchQueries({ queryKey: ['farmMembers'] }),
      queryClient.refetchQueries({ queryKey: ['remoteData'] }),
    ]);
    console.log('[Manual Sync] Manual sync completed');
  }, [syncToServer, queryClient]);

  const refreshData = useCallback(async () => {
    console.log('[Refresh] Pull-to-refresh triggered...');
    initialMergeDoneRef.current = false;
    skipAutoMergeRef.current = false;
    try {
      await syncToServer({ skipMerge: false });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['equipment'] }),
        queryClient.refetchQueries({ queryKey: ['maintenanceLogs'] }),
        queryClient.refetchQueries({ queryKey: ['consumables'] }),
        queryClient.refetchQueries({ queryKey: ['intervals'] }),
        queryClient.refetchQueries({ queryKey: ['serviceRoutines'] }),
        queryClient.refetchQueries({ queryKey: ['inspectionRoutines'] }),
        queryClient.refetchQueries({ queryKey: ['workOrders'] }),
        queryClient.refetchQueries({ queryKey: ['employees'] }),
        queryClient.refetchQueries({ queryKey: ['farmMembers'] }),
        queryClient.refetchQueries({ queryKey: ['remoteData'] }),
      ]);
      console.log('[Refresh] Pull-to-refresh completed');
    } catch (error) {
      console.error('[Refresh] Pull-to-refresh failed:', JSON.stringify(error));
    }
  }, [syncToServer, queryClient]);

  const refreshFarmMembers = useCallback(async () => {
    console.log('[Refresh] Refreshing farm members...');
    await queryClient.refetchQueries({ queryKey: ['farmMembers'] });
  }, [queryClient]);

  const isLoading =
    equipmentQuery.isLoading ||
    maintenanceLogsQuery.isLoading ||
    intervalsQuery.isLoading ||
    consumablesQuery.isLoading ||
    serviceRoutinesQuery.isLoading ||
    inspectionRoutinesQuery.isLoading ||
    workOrdersQuery.isLoading ||
    employeesQuery.isLoading;

  useEffect(() => {
    if (!isLoading) {
      console.log('Data loaded - Equipment:', equipment.length, 'Maintenance Logs:', maintenanceLogs.length, 'Consumables:', consumables.length);
    }
  }, [isLoading, equipment.length, maintenanceLogs.length, consumables.length]);

  return useMemo(() => ({
    farmId,
    deviceId,
    setFarmId: setFarmIdAndSync,
    isSyncing,
    lastSyncTime,
    syncToServer,
    memberCount: farmMembers.length,
    isAdmin,
    farmMembers,
    removeMember: removeMemberMutation.mutateAsync,
    deleteFarmFromServer: deleteFarmFromServerMutation.mutateAsync,
    isDeletingFarm: deleteFarmFromServerMutation.isPending,
    forceDeleteEquipment: forceDeleteEquipmentMutation.mutateAsync,
    forceDeleteConsumables: forceDeleteConsumableMutation.mutateAsync,
    purgeAndResync: purgeAndResyncMutation.mutateAsync,
    isPurging: purgeAndResyncMutation.isPending,
    joinPassword,
    setFarmPassword: setJoinPasswordMutation.mutateAsync,
    isSettingFarmPassword: setJoinPasswordMutation.isPending,
    createFarm: createFarmMutation.mutateAsync,
    isCreatingFarm: createFarmMutation.isPending,
    updateFarmId: updateFarmIdMutation.mutateAsync,
    isUpdatingFarmId: updateFarmIdMutation.isPending,
    displayName,
    updateDisplayName: updateDisplayNameMutation.mutateAsync,
    isUpdatingDisplayName: updateDisplayNameMutation.isPending,
    checkForDuplicatesOnJoin,
    applyDuplicateResolutions,
    equipment,
    maintenanceLogs,
    intervals,
    consumables,
    serviceRoutines,
    inspectionRoutines,
    isLoading,
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
    workOrders,
    employees,
    addWorkOrder: addWorkOrderMutation.mutateAsync,
    updateWorkOrder: updateWorkOrderMutation.mutateAsync,
    deleteWorkOrder: deleteWorkOrderMutation.mutateAsync,
    getWorkOrderById,
    addEmployee: addEmployeeMutation.mutateAsync,
    updateEmployee: updateEmployeeMutation.mutateAsync,
    deleteEmployee: deleteEmployeeMutation.mutateAsync,
    getEmployeeById,
    manualSync,
    refreshData,
    refreshFarmMembers,
  }), [
    farmId, deviceId, setFarmIdAndSync, isSyncing, lastSyncTime, syncToServer,
    farmMembers, isAdmin, joinPassword, displayName,
    removeMemberMutation.mutateAsync, deleteFarmFromServerMutation.mutateAsync, deleteFarmFromServerMutation.isPending,
    forceDeleteEquipmentMutation.mutateAsync, forceDeleteConsumableMutation.mutateAsync,
    purgeAndResyncMutation.mutateAsync, purgeAndResyncMutation.isPending,
    setJoinPasswordMutation.mutateAsync, setJoinPasswordMutation.isPending,
    createFarmMutation.mutateAsync, createFarmMutation.isPending,
    updateFarmIdMutation.mutateAsync, updateFarmIdMutation.isPending,
    updateDisplayNameMutation.mutateAsync, updateDisplayNameMutation.isPending,
    checkForDuplicatesOnJoin, applyDuplicateResolutions,
    equipment, maintenanceLogs, intervals, consumables, serviceRoutines, inspectionRoutines, isLoading,
    addEquipmentMutation.mutateAsync, updateEquipmentMutation.mutateAsync, deleteEquipmentMutation.mutateAsync,
    addMaintenanceLogMutation.mutateAsync, updateMaintenanceLogMutation.mutateAsync, deleteMaintenanceLogMutation.mutateAsync,
    getMaintenanceLogById, addIntervalMutation.mutateAsync, updateIntervalMutation.mutateAsync,
    getEquipmentById, getLogsForEquipment, getIntervalsForEquipment,
    addConsumableMutation.mutateAsync, updateConsumableMutation.mutateAsync, deleteConsumableMutation.mutateAsync,
    deductConsumablesMutation.mutateAsync, getConsumableById, getLowStockConsumables,
    bulkAddConsumablesMutation.mutateAsync, bulkAddEquipmentMutation.mutateAsync,
    addServiceRoutineMutation.mutateAsync, updateServiceRoutineMutation.mutateAsync, deleteServiceRoutineMutation.mutateAsync,
    getServiceRoutineById,
    addInspectionRoutineMutation.mutateAsync, updateInspectionRoutineMutation.mutateAsync, deleteInspectionRoutineMutation.mutateAsync,
    getInspectionRoutineById,
    workOrders, employees,
    addWorkOrderMutation.mutateAsync, updateWorkOrderMutation.mutateAsync, deleteWorkOrderMutation.mutateAsync, getWorkOrderById,
    addEmployeeMutation.mutateAsync, updateEmployeeMutation.mutateAsync, deleteEmployeeMutation.mutateAsync, getEmployeeById,
    manualSync, refreshData, refreshFarmMembers,
  ]);
});
