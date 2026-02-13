import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { Equipment, MaintenanceLog, MaintenanceInterval, Consumable, ServiceRoutine, InspectionRoutine, WorkOrder, Employee } from '@/types/equipment';
import { generateId } from '@/utils/helpers';
import { trpc } from '@/lib/trpc';

const STORAGE_KEYS = {
  EQUIPMENT: 'farmguard_equipment',
  MAINTENANCE_LOGS: 'farmguard_maintenance_logs',
  INTERVALS: 'farmguard_intervals',
  CONSUMABLES: 'farmguard_consumables',
  SERVICE_ROUTINES: 'farmguard_service_routines',
  INSPECTION_ROUTINES: 'farmguard_inspection_routines',
  WORK_ORDERS: 'farmguard_work_orders',
  EMPLOYEES: 'farmguard_employees',
  FARM_ID: 'farmguard_farm_id',
  DEVICE_ID: 'farmguard_device_id',
};

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
    let farmId = await AsyncStorage.getItem(STORAGE_KEYS.FARM_ID);
    if (!farmId) {
      farmId = generateId();
      await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, farmId);
      console.log(`Generated new farm ID: ${farmId}`);
    }
    return farmId;
  } catch (error) {
    console.error('Error getting farm ID:', error);
    return generateId();
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

export const [FarmDataProvider, useFarmData] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [farmId, setFarmId] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  

  useEffect(() => {
    getFarmId().then(setFarmId);
    getDeviceId().then(setDeviceId);
  }, []);

  const memberCountQuery = trpc.farm.getMemberCount.useQuery(
    { farmId },
    {
      enabled: !!farmId,
      staleTime: 1000 * 60 * 5,
    }
  );

  const joinFarmMutation = trpc.farm.joinFarm.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm', 'getMemberCount'] });
    },
  });

  const remoteDataQuery = trpc.farm.getData.useQuery(
    { farmId },
    {
      enabled: !!farmId,
      staleTime: 1000 * 60 * 2,
      refetchOnMount: true,
      refetchOnReconnect: true,
    }
  );

  const syncDataMutation = trpc.farm.syncData.useMutation({
    onSuccess: (result) => {
      setLastSyncTime(result.timestamp);
      console.log('Data synced to server successfully');
    },
    onError: (error) => {
      console.error('Failed to sync data to server:', error);
    },
  });

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

  const workOrdersQuery = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => loadData<WorkOrder>(STORAGE_KEYS.WORK_ORDERS),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: () => loadData<Employee>(STORAGE_KEYS.EMPLOYEES),
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
  const workOrders = useMemo(() => workOrdersQuery.data ?? [], [workOrdersQuery.data]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  useEffect(() => {
    if (remoteDataQuery.data && farmId) {
      const remote = remoteDataQuery.data;
      const hasRemoteData = 
        remote.equipment.length > 0 ||
        remote.maintenanceLogs.length > 0 ||
        remote.consumables.length > 0 ||
        remote.intervals.length > 0 ||
        remote.serviceRoutines.length > 0 ||
        remote.inspectionRoutines.length > 0;

      if (hasRemoteData) {
        console.log('Remote data found, merging with local...');
        const mergeArrays = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
          const map = new Map<string, T>();
          local.forEach(item => map.set(item.id, item));
          remote.forEach(item => {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        };

        const mergedEquipment = mergeArrays(equipment, remote.equipment);
        const mergedLogs = mergeArrays(maintenanceLogs, remote.maintenanceLogs);
        const mergedConsumables = mergeArrays(consumables, remote.consumables);
        const mergedIntervals = mergeArrays(intervals, remote.intervals);
        const mergedServiceRoutines = mergeArrays(serviceRoutines, remote.serviceRoutines);
        const mergedInspectionRoutines = mergeArrays(inspectionRoutines, remote.inspectionRoutines);

        Promise.all([
          saveData(STORAGE_KEYS.EQUIPMENT, mergedEquipment),
          saveData(STORAGE_KEYS.MAINTENANCE_LOGS, mergedLogs),
          saveData(STORAGE_KEYS.CONSUMABLES, mergedConsumables),
          saveData(STORAGE_KEYS.INTERVALS, mergedIntervals),
          saveData(STORAGE_KEYS.SERVICE_ROUTINES, mergedServiceRoutines),
          saveData(STORAGE_KEYS.INSPECTION_ROUTINES, mergedInspectionRoutines),
        ]).then(() => {
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
          queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
          queryClient.invalidateQueries({ queryKey: ['consumables'] });
          queryClient.invalidateQueries({ queryKey: ['intervals'] });
          queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
          queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
          console.log('Data merged and saved locally');
        });
      }
    }
  }, [remoteDataQuery.data, farmId]);

  const syncToServer = useCallback(async () => {
    if (!farmId) return;
    
    setIsSyncing(true);
    try {
      await syncDataMutation.mutateAsync({
        farmId,
        data: {
          equipment,
          maintenanceLogs,
          intervals,
          consumables,
          serviceRoutines,
          inspectionRoutines,
        },
      });
    } finally {
      setIsSyncing(false);
    }
  }, [farmId, equipment, maintenanceLogs, intervals, consumables, serviceRoutines, inspectionRoutines, syncDataMutation]);

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
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      syncToServer();
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = equipment.filter(e => e.id !== id);
      await saveData(STORAGE_KEYS.EQUIPMENT, updated);
      const updatedLogs = maintenanceLogs.filter(l => l.equipmentId !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updatedLogs);
      const updatedIntervals = intervals.filter(i => i.equipmentId !== id);
      await saveData(STORAGE_KEYS.INTERVALS, updatedIntervals);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      syncToServer();
    },
  });

  const deleteMaintenanceLogMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = maintenanceLogs.filter(l => l.id !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
      syncToServer();
    },
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = consumables.filter(c => c.id !== id);
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      syncToServer();
    },
  });

  const deleteServiceRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = serviceRoutines.filter(r => r.id !== id);
      await saveData(STORAGE_KEYS.SERVICE_ROUTINES, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      syncToServer();
    },
  });

  const deleteInspectionRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = inspectionRoutines.filter(r => r.id !== id);
      await saveData(STORAGE_KEYS.INSPECTION_ROUTINES, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      syncToServer();
    },
  });

  const deleteWorkOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = workOrders.filter(w => w.id !== id);
      await saveData(STORAGE_KEYS.WORK_ORDERS, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      syncToServer();
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
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      syncToServer();
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = employees.filter(e => e.id !== id);
      await saveData(STORAGE_KEYS.EMPLOYEES, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      syncToServer();
    },
  });

  const getEmployeeById = useCallback(
    (id: string) => employees.find(e => e.id === id),
    [employees]
  );

  const setFarmIdAndSync = useCallback(async (newFarmId: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, newFarmId);
    setFarmId(newFarmId);
    queryClient.invalidateQueries({ queryKey: ['farm', 'getData'] });
  }, [queryClient]);

  const checkForDuplicatesOnJoin = useCallback(async (newFarmId: string): Promise<DuplicateResolutionResult> => {
    const hasLocalData = equipment.length > 0 || consumables.length > 0 || 
                         serviceRoutines.length > 0 || inspectionRoutines.length > 0;
    
    const remoteData = await queryClient.fetchQuery({
      queryKey: ['farm', 'getData', { farmId: newFarmId }],
      queryFn: async () => {
        const response = await fetch(`${process.env.EXPO_PUBLIC_RORK_API_BASE_URL}/trpc/farm.getData?input=${encodeURIComponent(JSON.stringify({ farmId: newFarmId }))}`);
        const json = await response.json();
        return json.result?.data || { equipment: [], maintenanceLogs: [], intervals: [], consumables: [], serviceRoutines: [], inspectionRoutines: [] };
      },
    });

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
  }, [equipment, consumables, serviceRoutines, inspectionRoutines, queryClient]);

  const applyDuplicateResolutions = useCallback(async (
    newFarmId: string,
    resolutions: DuplicateItem[]
  ) => {
    const remoteData = await queryClient.fetchQuery({
      queryKey: ['farm', 'getData', { farmId: newFarmId }],
      queryFn: async () => {
        const response = await fetch(`${process.env.EXPO_PUBLIC_RORK_API_BASE_URL}/trpc/farm.getData?input=${encodeURIComponent(JSON.stringify({ farmId: newFarmId }))}`);
        const json = await response.json();
        return json.result?.data || { equipment: [], maintenanceLogs: [], intervals: [], consumables: [], serviceRoutines: [], inspectionRoutines: [] };
      },
    });

    let mergedEquipment = [...equipment];
    let mergedConsumables = [...consumables];
    let mergedServiceRoutines = [...serviceRoutines];
    let mergedInspectionRoutines = [...inspectionRoutines];
    let mergedLogs = [...maintenanceLogs];
    let mergedIntervals = [...intervals];

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

    await Promise.all([
      saveData(STORAGE_KEYS.EQUIPMENT, mergedEquipment),
      saveData(STORAGE_KEYS.CONSUMABLES, mergedConsumables),
      saveData(STORAGE_KEYS.SERVICE_ROUTINES, mergedServiceRoutines),
      saveData(STORAGE_KEYS.INSPECTION_ROUTINES, mergedInspectionRoutines),
      saveData(STORAGE_KEYS.MAINTENANCE_LOGS, mergedLogs),
      saveData(STORAGE_KEYS.INTERVALS, mergedIntervals),
    ]);

    await AsyncStorage.setItem(STORAGE_KEYS.FARM_ID, newFarmId);
    setFarmId(newFarmId);

    if (deviceId) {
      await joinFarmMutation.mutateAsync({ farmId: newFarmId, deviceId });
    }

    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['consumables'] });
    queryClient.invalidateQueries({ queryKey: ['serviceRoutines'] });
    queryClient.invalidateQueries({ queryKey: ['inspectionRoutines'] });
    queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
    queryClient.invalidateQueries({ queryKey: ['intervals'] });
    queryClient.invalidateQueries({ queryKey: ['farm', 'getData'] });
    queryClient.invalidateQueries({ queryKey: ['farm', 'getMemberCount'] });

    console.log('Data merged and saved after duplicate resolution');
  }, [equipment, consumables, serviceRoutines, inspectionRoutines, maintenanceLogs, intervals, deviceId, queryClient, joinFarmMutation]);

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

  return {
    farmId,
    setFarmId: setFarmIdAndSync,
    isSyncing,
    lastSyncTime,
    syncToServer,
    memberCount: memberCountQuery.data?.count ?? 0,
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
  };
});
