import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const EquipmentTypeSchema = z.enum([
  'tractor', 'combine', 'truck', 'implement', 'sprayer', 
  'planter', 'loader', 'mower', 'utv', 'other'
]);

const ConsumableCategorySchema = z.enum([
  'filter', 'oil', 'fluid', 'belt', 'electrical', 'hardware', 'other'
]);

const AttachmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  fileName: z.string(),
  fileUri: z.string(),
  createdAt: z.string(),
});

const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: EquipmentTypeSchema,
  make: z.string(),
  model: z.string(),
  year: z.number(),
  serialNumber: z.string(),
  purchaseDate: z.string(),
  currentHours: z.number(),
  oilCapacity: z.string().optional(),
  imageUrl: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MaintenanceLogSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  date: z.string(),
  hoursAtService: z.number(),
  type: z.enum(['routine', 'repair', 'inspection']),
  description: z.string(),
  consumablesUsed: z.array(z.object({
    consumableId: z.string(),
    name: z.string(),
    quantity: z.number(),
  })),
  performedBy: z.enum(['owner', 'dealer', 'employee']),
  performedByName: z.string().optional(),
  downtimeHours: z.number().optional(),
  notes: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.string(),
});

const MaintenanceIntervalSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  name: z.string(),
  intervalHours: z.number().optional(),
  intervalDays: z.number().optional(),
  lastPerformedHours: z.number().optional(),
  lastPerformedDate: z.string().optional(),
  notes: z.string().optional(),
});

const ConsumableSchema = z.object({
  id: z.string(),
  name: z.string(),
  partNumber: z.string(),
  category: ConsumableCategorySchema,
  supplier: z.string().optional(),
  supplierPartNumber: z.string().optional(),
  quantity: z.number(),
  lowStockThreshold: z.number(),
  compatibleEquipment: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const ServiceRoutineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  equipmentTypes: z.array(EquipmentTypeSchema).optional(),
  checklistItems: z.array(ChecklistItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const InspectionRoutineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  equipmentTypes: z.array(EquipmentTypeSchema).optional(),
  checklistItems: z.array(ChecklistItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const FarmDataSchema = z.object({
  equipment: z.array(EquipmentSchema),
  maintenanceLogs: z.array(MaintenanceLogSchema),
  intervals: z.array(MaintenanceIntervalSchema),
  consumables: z.array(ConsumableSchema),
  serviceRoutines: z.array(ServiceRoutineSchema),
  inspectionRoutines: z.array(InspectionRoutineSchema),
});

type FarmData = z.infer<typeof FarmDataSchema>;

const farmDataStore = new Map<string, FarmData>();

function getOrCreateFarmData(farmId: string): FarmData {
  if (!farmDataStore.has(farmId)) {
    farmDataStore.set(farmId, {
      equipment: [],
      maintenanceLogs: [],
      intervals: [],
      consumables: [],
      serviceRoutines: [],
      inspectionRoutines: [],
    });
  }
  return farmDataStore.get(farmId)!;
}

export const farmRouter = createTRPCRouter({
  getData: publicProcedure
    .input(z.object({ farmId: z.string() }))
    .query(({ input }) => {
      console.log(`[Farm] Getting data for farm: ${input.farmId}`);
      return getOrCreateFarmData(input.farmId);
    }),

  syncData: publicProcedure
    .input(z.object({
      farmId: z.string(),
      data: FarmDataSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Syncing data for farm: ${input.farmId}`);
      farmDataStore.set(input.farmId, input.data);
      return { success: true, timestamp: new Date().toISOString() };
    }),

  addEquipment: publicProcedure
    .input(z.object({
      farmId: z.string(),
      equipment: EquipmentSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Adding equipment for farm: ${input.farmId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.equipment.push(input.equipment);
      return input.equipment;
    }),

  updateEquipment: publicProcedure
    .input(z.object({
      farmId: z.string(),
      equipment: EquipmentSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Updating equipment: ${input.equipment.id}`);
      const data = getOrCreateFarmData(input.farmId);
      const index = data.equipment.findIndex(e => e.id === input.equipment.id);
      if (index !== -1) {
        data.equipment[index] = input.equipment;
      }
      return input.equipment;
    }),

  deleteEquipment: publicProcedure
    .input(z.object({
      farmId: z.string(),
      equipmentId: z.string(),
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Deleting equipment: ${input.equipmentId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.equipment = data.equipment.filter(e => e.id !== input.equipmentId);
      data.maintenanceLogs = data.maintenanceLogs.filter(l => l.equipmentId !== input.equipmentId);
      data.intervals = data.intervals.filter(i => i.equipmentId !== input.equipmentId);
      return { success: true };
    }),

  addMaintenanceLog: publicProcedure
    .input(z.object({
      farmId: z.string(),
      log: MaintenanceLogSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Adding maintenance log for farm: ${input.farmId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.maintenanceLogs.push(input.log);
      return input.log;
    }),

  updateMaintenanceLog: publicProcedure
    .input(z.object({
      farmId: z.string(),
      log: MaintenanceLogSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Updating maintenance log: ${input.log.id}`);
      const data = getOrCreateFarmData(input.farmId);
      const index = data.maintenanceLogs.findIndex(l => l.id === input.log.id);
      if (index !== -1) {
        data.maintenanceLogs[index] = input.log;
      }
      return input.log;
    }),

  deleteMaintenanceLog: publicProcedure
    .input(z.object({
      farmId: z.string(),
      logId: z.string(),
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Deleting maintenance log: ${input.logId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.maintenanceLogs = data.maintenanceLogs.filter(l => l.id !== input.logId);
      return { success: true };
    }),

  addConsumable: publicProcedure
    .input(z.object({
      farmId: z.string(),
      consumable: ConsumableSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Adding consumable for farm: ${input.farmId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.consumables.push(input.consumable);
      return input.consumable;
    }),

  updateConsumable: publicProcedure
    .input(z.object({
      farmId: z.string(),
      consumable: ConsumableSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Updating consumable: ${input.consumable.id}`);
      const data = getOrCreateFarmData(input.farmId);
      const index = data.consumables.findIndex(c => c.id === input.consumable.id);
      if (index !== -1) {
        data.consumables[index] = input.consumable;
      }
      return input.consumable;
    }),

  deleteConsumable: publicProcedure
    .input(z.object({
      farmId: z.string(),
      consumableId: z.string(),
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Deleting consumable: ${input.consumableId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.consumables = data.consumables.filter(c => c.id !== input.consumableId);
      return { success: true };
    }),

  addInterval: publicProcedure
    .input(z.object({
      farmId: z.string(),
      interval: MaintenanceIntervalSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Adding interval for farm: ${input.farmId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.intervals.push(input.interval);
      return input.interval;
    }),

  updateInterval: publicProcedure
    .input(z.object({
      farmId: z.string(),
      interval: MaintenanceIntervalSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Updating interval: ${input.interval.id}`);
      const data = getOrCreateFarmData(input.farmId);
      const index = data.intervals.findIndex(i => i.id === input.interval.id);
      if (index !== -1) {
        data.intervals[index] = input.interval;
      }
      return input.interval;
    }),

  addServiceRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: ServiceRoutineSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Adding service routine for farm: ${input.farmId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.serviceRoutines.push(input.routine);
      return input.routine;
    }),

  updateServiceRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: ServiceRoutineSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Updating service routine: ${input.routine.id}`);
      const data = getOrCreateFarmData(input.farmId);
      const index = data.serviceRoutines.findIndex(r => r.id === input.routine.id);
      if (index !== -1) {
        data.serviceRoutines[index] = input.routine;
      }
      return input.routine;
    }),

  deleteServiceRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routineId: z.string(),
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Deleting service routine: ${input.routineId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.serviceRoutines = data.serviceRoutines.filter(r => r.id !== input.routineId);
      return { success: true };
    }),

  addInspectionRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: InspectionRoutineSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Adding inspection routine for farm: ${input.farmId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.inspectionRoutines.push(input.routine);
      return input.routine;
    }),

  updateInspectionRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: InspectionRoutineSchema,
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Updating inspection routine: ${input.routine.id}`);
      const data = getOrCreateFarmData(input.farmId);
      const index = data.inspectionRoutines.findIndex(r => r.id === input.routine.id);
      if (index !== -1) {
        data.inspectionRoutines[index] = input.routine;
      }
      return input.routine;
    }),

  deleteInspectionRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routineId: z.string(),
    }))
    .mutation(({ input }) => {
      console.log(`[Farm] Deleting inspection routine: ${input.routineId}`);
      const data = getOrCreateFarmData(input.farmId);
      data.inspectionRoutines = data.inspectionRoutines.filter(r => r.id !== input.routineId);
      return { success: true };
    }),
});
