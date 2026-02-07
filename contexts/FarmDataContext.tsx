import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect } from 'react';
import { Equipment, MaintenanceLog, MaintenanceInterval, Consumable, ServiceRoutine, InspectionRoutine } from '@/types/equipment';
import { generateId } from '@/utils/helpers';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthContext';

export const [FarmDataProvider, useFarmData] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const equipmentQuery = useQuery({
    queryKey: ['equipment', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading equipment:', error);
        throw error;
      }
      console.log(`Equipment loaded: ${data?.length || 0} items`);
      return data as Equipment[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const maintenanceLogsQuery = useQuery({
    queryKey: ['maintenanceLogs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (error) {
        console.error('Error loading maintenance logs:', error);
        throw error;
      }
      console.log(`Maintenance logs loaded: ${data?.length || 0} items`);
      return data as MaintenanceLog[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const intervalsQuery = useQuery({
    queryKey: ['intervals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('maintenance_intervals')
        .select('*')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error loading intervals:', error);
        throw error;
      }
      return data as MaintenanceInterval[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const consumablesQuery = useQuery({
    queryKey: ['consumables', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('consumables')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading consumables:', error);
        throw error;
      }
      console.log(`Consumables loaded: ${data?.length || 0} items`);
      return data as Consumable[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const serviceRoutinesQuery = useQuery({
    queryKey: ['serviceRoutines', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('service_routines')
        .select('*')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error loading service routines:', error);
        throw error;
      }
      return data as ServiceRoutine[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const inspectionRoutinesQuery = useQuery({
    queryKey: ['inspectionRoutines', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('inspection_routines')
        .select('*')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error loading inspection routines:', error);
        throw error;
      }
      return data as InspectionRoutine[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!user) return;

    const equipmentChannel = supabase
      .channel('equipment_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['equipment', user.id] });
      })
      .subscribe();

    const logsChannel = supabase
      .channel('logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['maintenanceLogs', user.id] });
      })
      .subscribe();

    const consumablesChannel = supabase
      .channel('consumables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumables', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['consumables', user.id] });
      })
      .subscribe();

    return () => {
      equipmentChannel.unsubscribe();
      logsChannel.unsubscribe();
      consumablesChannel.unsubscribe();
    };
  }, [user, queryClient]);

  const equipment = useMemo(() => equipmentQuery.data ?? [], [equipmentQuery.data]);
  const maintenanceLogs = useMemo(() => maintenanceLogsQuery.data ?? [], [maintenanceLogsQuery.data]);
  const intervals = useMemo(() => intervalsQuery.data ?? [], [intervalsQuery.data]);
  const consumables = useMemo(() => consumablesQuery.data ?? [], [consumablesQuery.data]);
  const serviceRoutines = useMemo(() => serviceRoutinesQuery.data ?? [], [serviceRoutinesQuery.data]);
  const inspectionRoutines = useMemo(() => inspectionRoutinesQuery.data ?? [], [inspectionRoutinesQuery.data]);

  const addEquipmentMutation = useMutation({
    mutationFn: async (newEquipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const equipmentItem = {
        ...newEquipment,
        id: generateId(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase.from('equipment').insert(equipmentItem).select().single();
      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', user?.id] });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (updates: Partial<Equipment> & { id: string }) => {
      if (!user) throw new Error('User not authenticated');
      const { id, ...updateData } = updates;
      const { data, error } = await supabase
        .from('equipment')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', user?.id] });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error: logsError } = await supabase
        .from('maintenance_logs')
        .delete()
        .eq('equipment_id', id)
        .eq('user_id', user.id);
      if (logsError) throw logsError;

      const { error: intervalsError } = await supabase
        .from('maintenance_intervals')
        .delete()
        .eq('equipment_id', id)
        .eq('user_id', user.id);
      if (intervalsError) throw intervalsError;

      const { error } = await supabase.from('equipment').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['intervals', user?.id] });
    },
  });

  const addMaintenanceLogMutation = useMutation({
    mutationFn: async (log: Omit<MaintenanceLog, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('User not authenticated');
      const newLog = {
        ...log,
        id: generateId(),
        user_id: user.id,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('maintenance_logs').insert(newLog).select().single();
      if (error) throw error;
      return data as MaintenanceLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs', user?.id] });
    },
  });

  const deleteMaintenanceLogMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceLogs', user?.id] });
    },
  });

  const addIntervalMutation = useMutation({
    mutationFn: async (interval: Omit<MaintenanceInterval, 'id'>) => {
      if (!user) throw new Error('User not authenticated');
      const newInterval = {
        ...interval,
        id: generateId(),
        user_id: user.id,
      };
      const { data, error } = await supabase.from('maintenance_intervals').insert(newInterval).select().single();
      if (error) throw error;
      return data as MaintenanceInterval;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals', user?.id] });
    },
  });

  const updateIntervalMutation = useMutation({
    mutationFn: async (updates: Partial<MaintenanceInterval> & { id: string }) => {
      if (!user) throw new Error('User not authenticated');
      const { id, ...updateData } = updates;
      const { error } = await supabase
        .from('maintenance_intervals')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals', user?.id] });
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
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const consumableItem = {
        ...newConsumable,
        id: generateId(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase.from('consumables').insert(consumableItem).select().single();
      if (error) throw error;
      return data as Consumable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables', user?.id] });
    },
  });

  const updateConsumableMutation = useMutation({
    mutationFn: async (updates: Partial<Consumable> & { id: string }) => {
      if (!user) throw new Error('User not authenticated');
      const { id, ...updateData } = updates;
      const { data, error } = await supabase
        .from('consumables')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Consumable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables', user?.id] });
    },
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase.from('consumables').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables', user?.id] });
    },
  });

  const deductConsumablesMutation = useMutation({
    mutationFn: async (items: { consumableId: string; quantity: number }[]) => {
      if (!user) throw new Error('User not authenticated');
      for (const item of items) {
        const consumable = consumables.find(c => c.id === item.consumableId);
        if (consumable) {
          const newQuantity = Math.max(0, consumable.quantity - item.quantity);
          await supabase
            .from('consumables')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', item.consumableId)
            .eq('user_id', user.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables', user?.id] });
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

  const bulkAddConsumablesMutation = useMutation({
    mutationFn: async (newConsumables: Omit<Consumable, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const consumableItems = newConsumables.map(c => ({
        ...c,
        id: generateId(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      }));
      const { data, error } = await supabase.from('consumables').insert(consumableItems).select();
      if (error) throw error;
      return data as Consumable[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumables', user?.id] });
    },
  });

  const bulkAddEquipmentMutation = useMutation({
    mutationFn: async (newEquipmentList: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const equipmentItems = newEquipmentList.map(e => ({
        ...e,
        id: generateId(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      }));
      const { data, error } = await supabase.from('equipment').insert(equipmentItems).select();
      if (error) throw error;
      return data as Equipment[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', user?.id] });
    },
  });

  const addServiceRoutineMutation = useMutation({
    mutationFn: async (newRoutine: Omit<ServiceRoutine, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const routineItem = {
        ...newRoutine,
        id: generateId(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase.from('service_routines').insert(routineItem).select().single();
      if (error) throw error;
      return data as ServiceRoutine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines', user?.id] });
    },
  });

  const updateServiceRoutineMutation = useMutation({
    mutationFn: async (updates: Partial<ServiceRoutine> & { id: string }) => {
      if (!user) throw new Error('User not authenticated');
      const { id, ...updateData } = updates;
      const { data, error } = await supabase
        .from('service_routines')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as ServiceRoutine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines', user?.id] });
    },
  });

  const deleteServiceRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase.from('service_routines').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRoutines', user?.id] });
    },
  });

  const getServiceRoutineById = useCallback(
    (id: string) => serviceRoutines.find(r => r.id === id),
    [serviceRoutines]
  );

  const addInspectionRoutineMutation = useMutation({
    mutationFn: async (newRoutine: Omit<InspectionRoutine, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user) throw new Error('User not authenticated');
      const now = new Date().toISOString();
      const routineItem = {
        ...newRoutine,
        id: generateId(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase.from('inspection_routines').insert(routineItem).select().single();
      if (error) throw error;
      return data as InspectionRoutine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines', user?.id] });
    },
  });

  const updateInspectionRoutineMutation = useMutation({
    mutationFn: async (updates: Partial<InspectionRoutine> & { id: string }) => {
      if (!user) throw new Error('User not authenticated');
      const { id, ...updateData } = updates;
      const { data, error } = await supabase
        .from('inspection_routines')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as InspectionRoutine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines', user?.id] });
    },
  });

  const deleteInspectionRoutineMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      const { error } = await supabase.from('inspection_routines').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspectionRoutines', user?.id] });
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
    if (!isLoading && user) {
      console.log('Data loaded - Equipment:', equipment.length, 'Maintenance Logs:', maintenanceLogs.length, 'Consumables:', consumables.length);
    }
  }, [isLoading, equipment.length, maintenanceLogs.length, consumables.length, user]);

  return {
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
  };
});
