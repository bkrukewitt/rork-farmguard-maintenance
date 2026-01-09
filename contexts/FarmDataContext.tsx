import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Equipment, MaintenanceLog, MaintenanceInterval, Consumable } from '@/types/equipment';
import { generateId } from '@/utils/helpers';

const STORAGE_KEYS = {
  EQUIPMENT: 'farmguard_equipment',
  MAINTENANCE_LOGS: 'farmguard_maintenance_logs',
  INTERVALS: 'farmguard_intervals',
  CONSUMABLES: 'farmguard_consumables',
};

async function loadData<T>(key: string): Promise<T[]> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.log('Error loading data:', key, error);
    return [];
  }
}

async function saveData<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.log('Error saving data:', key, error);
  }
}

export const [FarmDataProvider, useFarmData] = createContextHook(() => {
  const queryClient = useQueryClient();

  const equipmentQuery = useQuery({
    queryKey: ['equipment'],
    queryFn: () => loadData<Equipment>(STORAGE_KEYS.EQUIPMENT),
  });

  const maintenanceLogsQuery = useQuery({
    queryKey: ['maintenanceLogs'],
    queryFn: () => loadData<MaintenanceLog>(STORAGE_KEYS.MAINTENANCE_LOGS),
  });

  const intervalsQuery = useQuery({
    queryKey: ['intervals'],
    queryFn: () => loadData<MaintenanceInterval>(STORAGE_KEYS.INTERVALS),
  });

  const consumablesQuery = useQuery({
    queryKey: ['consumables'],
    queryFn: () => loadData<Consumable>(STORAGE_KEYS.CONSUMABLES),
  });

  const equipment = useMemo(() => equipmentQuery.data ?? [], [equipmentQuery.data]);
  const maintenanceLogs = useMemo(() => maintenanceLogsQuery.data ?? [], [maintenanceLogsQuery.data]);
  const intervals = useMemo(() => intervalsQuery.data ?? [], [intervalsQuery.data]);
  const consumables = useMemo(() => consumablesQuery.data ?? [], [consumablesQuery.data]);

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
      return newLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs'] });
    },
  });

  const deleteMaintenanceLogMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = maintenanceLogs.filter(l => l.id !== id);
      await saveData(STORAGE_KEYS.MAINTENANCE_LOGS, updated);
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals'] });
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
    },
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = consumables.filter(c => c.id !== id);
      await saveData(STORAGE_KEYS.CONSUMABLES, updated);
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables'] });
    },
  });

  const getConsumableById = useCallback(
    (id: string) => consumables.find(c => c.id === id),
    [consumables]
  );

  const getLowStockConsumables = useCallback(
    () => consumables.filter(c => c.quantity <= c.lowStockThreshold),
    [consumables]
  );

  const isLoading =
    equipmentQuery.isLoading ||
    maintenanceLogsQuery.isLoading ||
    intervalsQuery.isLoading ||
    consumablesQuery.isLoading;

  return {
    equipment,
    maintenanceLogs,
    intervals,
    consumables,
    isLoading,
    addEquipment: addEquipmentMutation.mutateAsync,
    updateEquipment: updateEquipmentMutation.mutateAsync,
    deleteEquipment: deleteEquipmentMutation.mutateAsync,
    addMaintenanceLog: addMaintenanceLogMutation.mutateAsync,
    deleteMaintenanceLog: deleteMaintenanceLogMutation.mutateAsync,
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
  };
});
