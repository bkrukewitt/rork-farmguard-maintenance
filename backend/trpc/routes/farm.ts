import * as z from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { getFarmData, upsertFarmData, getFarmMembers, upsertFarmMember, updateMemberActivity, getValue, setValue } from "../../utils/rork-db";
import { verifyFarmAccess, getFarmPasswordFromDb } from "../../utils/supabase-server";
import { sanitizeObject } from "../../utils/sanitize";
import { requireSubscription, startTrial, getTrialInfo, verifySubscription } from "../../utils/revenuecat";

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

const WorkOrderSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  equipmentId: z.string().optional(),
  assignedTo: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
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
  workOrders: z.array(WorkOrderSchema).optional(),
  employees: z.array(EmployeeSchema).optional(),
});

type FarmData = z.infer<typeof FarmDataSchema>;

const DEFAULT_FARM_DATA: FarmData = {
  equipment: [],
  maintenanceLogs: [],
  intervals: [],
  consumables: [],
  serviceRoutines: [],
  inspectionRoutines: [],
  workOrders: [],
  employees: [],
};

const AuthenticatedFarmInput = z.object({
  farmId: z.string().min(1),
  farmPassword: z.string().nullable().optional(),
});



async function requireFarmAccess(farmId: string, farmPassword: string | null | undefined): Promise<void> {
  const allowed = await verifyFarmAccess(farmId, farmPassword ?? null);
  if (!allowed) {
    console.log(`[Auth] Access denied for farm: ${farmId}`);
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid farm password. Access denied.',
    });
  }
  console.log(`[Auth] Access granted for farm: ${farmId}`);
}

async function getOrCreateFarmData(farmId: string): Promise<FarmData> {
  const data = await getFarmData(farmId);
  if (data) {
    return {
      equipment: (data.equipment as FarmData['equipment']) || [],
      maintenanceLogs: (data.maintenanceLogs as FarmData['maintenanceLogs']) || [],
      intervals: (data.intervals as FarmData['intervals']) || [],
      consumables: (data.consumables as FarmData['consumables']) || [],
      serviceRoutines: (data.serviceRoutines as FarmData['serviceRoutines']) || [],
      inspectionRoutines: (data.inspectionRoutines as FarmData['inspectionRoutines']) || [],
      workOrders: (data.workOrders as FarmData['workOrders']) || [],
      employees: (data.employees as FarmData['employees']) || [],
    };
  }
  return { ...DEFAULT_FARM_DATA };
}

async function saveFarmData(farmId: string, data: FarmData): Promise<void> {
  const success = await upsertFarmData(farmId, data as unknown as Record<string, unknown>);
  if (!success) {
    throw new Error(`Failed to save farm data for farm: ${farmId}`);
  }
}

const MIN_REQUIRED_VERSION = "1.0.0";

export const farmRouter = createTRPCRouter({
  getMinVersion: publicProcedure
    .query(() => {
      console.log(`[Farm] Min required version requested: ${MIN_REQUIRED_VERSION}`);
      return { minVersion: MIN_REQUIRED_VERSION };
    }),

  verifyFarmPassword: publicProcedure
    .input(z.object({
      farmId: z.string().min(1),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log(`[Auth] Password verification requested for farm: ${input.farmId}`);
      const storedPassword = await getFarmPasswordFromDb(input.farmId);

      if (!storedPassword) {
        return { valid: true, hasPassword: false };
      }

      const isValid = storedPassword === input.password;
      console.log(`[Auth] Password verification result for farm ${input.farmId}: ${isValid}`);
      return { valid: isValid, hasPassword: true };
    }),

  getData: publicProcedure
    .input(AuthenticatedFarmInput)
    .query(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      console.log(`[Farm] Getting data for farm: ${input.farmId}`);
      return await getOrCreateFarmData(input.farmId);
    }),

  getMemberCount: publicProcedure
    .input(z.object({ farmId: z.string() }))
    .query(async ({ input }) => {
      const members = await getFarmMembers(input.farmId);
      return { count: members.length };
    }),

  joinFarm: publicProcedure
    .input(z.object({
      farmId: z.string(),
      deviceId: z.string(),
      farmPassword: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      console.log(`[Farm] Device ${input.deviceId} joining farm: ${input.farmId}`);
      await upsertFarmMember(input.farmId, input.deviceId);
      const members = await getFarmMembers(input.farmId);
      return { success: true, memberCount: members.length };
    }),

  updateActivity: publicProcedure
    .input(z.object({
      farmId: z.string(),
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await updateMemberActivity(input.farmId, input.deviceId);
      return { success: true };
    }),

  getTrialInfo: publicProcedure
    .input(z.object({ farmId: z.string().min(1) }))
    .query(async ({ input }) => {
      console.log(`[Farm] Getting trial info for farm: ${input.farmId}`);
      return await getTrialInfo(input.farmId);
    }),

  startTrial: publicProcedure
    .input(z.object({
      farmId: z.string().min(1),
      farmPassword: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      console.log(`[Farm] Starting trial for farm: ${input.farmId}`);
      return await startTrial(input.farmId);
    }),

  checkSubscription: publicProcedure
    .input(z.object({
      rcUserId: z.string().min(1),
      farmId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      console.log(`[Farm] Checking subscription for RC user: ${input.rcUserId}`);
      const status = await verifySubscription(input.rcUserId);
      const trial = await getTrialInfo(input.farmId);
      return {
        ...status,
        isTrial: trial.active,
        trialDaysRemaining: trial.daysRemaining,
        hasAccess: status.hasAccess || trial.active,
      };
    }),

  syncData: publicProcedure
    .input(z.object({
      farmId: z.string(),
      data: FarmDataSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Syncing data for farm: ${input.farmId}`);
      const sanitizedData = sanitizeObject(input.data);
      const dataToSave: FarmData = {
        ...sanitizedData,
        workOrders: sanitizedData.workOrders || [],
        employees: sanitizedData.employees || [],
      };
      await saveFarmData(input.farmId, dataToSave);
      return { success: true, timestamp: new Date().toISOString() };
    }),

  addEquipment: publicProcedure
    .input(z.object({
      farmId: z.string(),
      equipment: EquipmentSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Adding equipment for farm: ${input.farmId}`);
      const sanitizedEquipment = sanitizeObject(input.equipment);
      const data = await getOrCreateFarmData(input.farmId);
      data.equipment.push(sanitizedEquipment);
      await saveFarmData(input.farmId, data);
      return sanitizedEquipment;
    }),

  updateEquipment: publicProcedure
    .input(z.object({
      farmId: z.string(),
      equipment: EquipmentSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Updating equipment: ${input.equipment.id}`);
      const sanitizedEquipment = sanitizeObject(input.equipment);
      const data = await getOrCreateFarmData(input.farmId);
      const index = data.equipment.findIndex(e => e.id === sanitizedEquipment.id);
      if (index !== -1) {
        data.equipment[index] = sanitizedEquipment;
      }
      await saveFarmData(input.farmId, data);
      return sanitizedEquipment;
    }),

  deleteEquipment: publicProcedure
    .input(z.object({
      farmId: z.string(),
      equipmentId: z.string(),
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Deleting equipment: ${input.equipmentId}`);
      const data = await getOrCreateFarmData(input.farmId);
      data.equipment = data.equipment.filter(e => e.id !== input.equipmentId);
      data.maintenanceLogs = data.maintenanceLogs.filter(l => l.equipmentId !== input.equipmentId);
      data.intervals = data.intervals.filter(i => i.equipmentId !== input.equipmentId);
      await saveFarmData(input.farmId, data);
      return { success: true };
    }),

  addMaintenanceLog: publicProcedure
    .input(z.object({
      farmId: z.string(),
      log: MaintenanceLogSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Adding maintenance log for farm: ${input.farmId}`);
      const sanitizedLog = sanitizeObject(input.log);
      const data = await getOrCreateFarmData(input.farmId);
      data.maintenanceLogs.push(sanitizedLog);
      await saveFarmData(input.farmId, data);
      return sanitizedLog;
    }),

  updateMaintenanceLog: publicProcedure
    .input(z.object({
      farmId: z.string(),
      log: MaintenanceLogSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Updating maintenance log: ${input.log.id}`);
      const sanitizedLog = sanitizeObject(input.log);
      const data = await getOrCreateFarmData(input.farmId);
      const index = data.maintenanceLogs.findIndex(l => l.id === sanitizedLog.id);
      if (index !== -1) {
        data.maintenanceLogs[index] = sanitizedLog;
      }
      await saveFarmData(input.farmId, data);
      return sanitizedLog;
    }),

  deleteMaintenanceLog: publicProcedure
    .input(z.object({
      farmId: z.string(),
      logId: z.string(),
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Deleting maintenance log: ${input.logId}`);
      const data = await getOrCreateFarmData(input.farmId);
      data.maintenanceLogs = data.maintenanceLogs.filter(l => l.id !== input.logId);
      await saveFarmData(input.farmId, data);
      return { success: true };
    }),

  addConsumable: publicProcedure
    .input(z.object({
      farmId: z.string(),
      consumable: ConsumableSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Adding consumable for farm: ${input.farmId}`);
      const sanitizedConsumable = sanitizeObject(input.consumable);
      const data = await getOrCreateFarmData(input.farmId);
      data.consumables.push(sanitizedConsumable);
      await saveFarmData(input.farmId, data);
      return sanitizedConsumable;
    }),

  updateConsumable: publicProcedure
    .input(z.object({
      farmId: z.string(),
      consumable: ConsumableSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Updating consumable: ${input.consumable.id}`);
      const sanitizedConsumable = sanitizeObject(input.consumable);
      const data = await getOrCreateFarmData(input.farmId);
      const index = data.consumables.findIndex(c => c.id === sanitizedConsumable.id);
      if (index !== -1) {
        data.consumables[index] = sanitizedConsumable;
      }
      await saveFarmData(input.farmId, data);
      return sanitizedConsumable;
    }),

  deleteConsumable: publicProcedure
    .input(z.object({
      farmId: z.string(),
      consumableId: z.string(),
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Deleting consumable: ${input.consumableId}`);
      const data = await getOrCreateFarmData(input.farmId);
      data.consumables = data.consumables.filter(c => c.id !== input.consumableId);
      await saveFarmData(input.farmId, data);
      return { success: true };
    }),

  addInterval: publicProcedure
    .input(z.object({
      farmId: z.string(),
      interval: MaintenanceIntervalSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Adding interval for farm: ${input.farmId}`);
      const sanitizedInterval = sanitizeObject(input.interval);
      const data = await getOrCreateFarmData(input.farmId);
      data.intervals.push(sanitizedInterval);
      await saveFarmData(input.farmId, data);
      return sanitizedInterval;
    }),

  updateInterval: publicProcedure
    .input(z.object({
      farmId: z.string(),
      interval: MaintenanceIntervalSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Updating interval: ${input.interval.id}`);
      const sanitizedInterval = sanitizeObject(input.interval);
      const data = await getOrCreateFarmData(input.farmId);
      const index = data.intervals.findIndex(i => i.id === sanitizedInterval.id);
      if (index !== -1) {
        data.intervals[index] = sanitizedInterval;
      }
      await saveFarmData(input.farmId, data);
      return sanitizedInterval;
    }),

  addServiceRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: ServiceRoutineSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Adding service routine for farm: ${input.farmId}`);
      const sanitizedRoutine = sanitizeObject(input.routine);
      const data = await getOrCreateFarmData(input.farmId);
      data.serviceRoutines.push(sanitizedRoutine);
      await saveFarmData(input.farmId, data);
      return sanitizedRoutine;
    }),

  updateServiceRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: ServiceRoutineSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Updating service routine: ${input.routine.id}`);
      const sanitizedRoutine = sanitizeObject(input.routine);
      const data = await getOrCreateFarmData(input.farmId);
      const index = data.serviceRoutines.findIndex(r => r.id === sanitizedRoutine.id);
      if (index !== -1) {
        data.serviceRoutines[index] = sanitizedRoutine;
      }
      await saveFarmData(input.farmId, data);
      return sanitizedRoutine;
    }),

  deleteServiceRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routineId: z.string(),
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Deleting service routine: ${input.routineId}`);
      const data = await getOrCreateFarmData(input.farmId);
      data.serviceRoutines = data.serviceRoutines.filter(r => r.id !== input.routineId);
      await saveFarmData(input.farmId, data);
      return { success: true };
    }),

  addInspectionRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: InspectionRoutineSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Adding inspection routine for farm: ${input.farmId}`);
      const sanitizedRoutine = sanitizeObject(input.routine);
      const data = await getOrCreateFarmData(input.farmId);
      data.inspectionRoutines.push(sanitizedRoutine);
      await saveFarmData(input.farmId, data);
      return sanitizedRoutine;
    }),

  updateInspectionRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routine: InspectionRoutineSchema,
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Updating inspection routine: ${input.routine.id}`);
      const sanitizedRoutine = sanitizeObject(input.routine);
      const data = await getOrCreateFarmData(input.farmId);
      const index = data.inspectionRoutines.findIndex(r => r.id === sanitizedRoutine.id);
      if (index !== -1) {
        data.inspectionRoutines[index] = sanitizedRoutine;
      }
      await saveFarmData(input.farmId, data);
      return sanitizedRoutine;
    }),

  deleteInspectionRoutine: publicProcedure
    .input(z.object({
      farmId: z.string(),
      routineId: z.string(),
      farmPassword: z.string().nullable().optional(),
      rcUserId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireFarmAccess(input.farmId, input.farmPassword);
      await requireSubscription(input.rcUserId, input.farmId);
      console.log(`[Farm] Deleting inspection routine: ${input.routineId}`);
      const data = await getOrCreateFarmData(input.farmId);
      data.inspectionRoutines = data.inspectionRoutines.filter(r => r.id !== input.routineId);
      await saveFarmData(input.farmId, data);
      return { success: true };
    }),

  submitFeedback: publicProcedure
    .input(z.object({
      email: z.string().email(),
      category: z.enum(['bug', 'feature', 'question', 'other']),
      subject: z.string().optional(),
      message: z.string().min(1),
      farmId: z.string().optional(),
      deviceId: z.string().optional(),
      platform: z.string().optional(),
      appVersion: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log(`[Farm] Submitting feedback from: ${input.email}`);
      const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const feedbackEntry = {
        id: feedbackId,
        ...input,
        createdAt: new Date().toISOString(),
      };
      const success = await setValue(`feedback:${feedbackId}`, feedbackEntry);
      if (!success) {
        console.error(`[Farm] Failed to save feedback entry: ${feedbackId}`);
        const indexKey = 'app_feedback_index';
        const existing = await getValue<string[]>(indexKey) ?? [];
        existing.push(feedbackId);
        const indexSuccess = await setValue(indexKey, existing);
        if (!indexSuccess) {
          console.error(`[Farm] Also failed to save feedback index`);
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save feedback' });
      }
      try {
        const indexKey = 'app_feedback_index';
        const existing = await getValue<string[]>(indexKey) ?? [];
        existing.push(feedbackId);
        await setValue(indexKey, existing);
      } catch (indexErr) {
        console.error(`[Farm] Failed to update feedback index, but entry was saved:`, indexErr);
      }
      console.log(`[Farm] Feedback saved: ${feedbackId}`);
      return { success: true, feedbackId };
    }),
});
