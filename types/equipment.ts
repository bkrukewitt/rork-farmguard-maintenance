export type EquipmentType = 
  | 'tractor'
  | 'combine'
  | 'truck'
  | 'implement'
  | 'sprayer'
  | 'planter'
  | 'loader'
  | 'mower'
  | 'utv'
  | 'building'
  | 'other';

export interface EquipmentAttachment {
  id: string;
  label: string;
  fileName: string;
  /**
   * Local file path on the device (FileSystem.documentDirectory...)
   */
  fileUri: string;
  /**
   * Path of the file in Supabase Storage (farm-attachments bucket), e.g. "farmId/equipment/equipId/attachmentId.pdf"
   */
  remotePath?: string;
  createdAt: string;
}

export type EquipmentMetric = 'hours' | 'miles';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  make: string;
  model: string;
  year: number;
  serialNumber: string;
  purchaseDate: string;
  currentHours: number;
  metric?: EquipmentMetric;
  oilCapacity?: string;
  imageUrl?: string;
  warrantyExpiry?: string;
  notes?: string;
  attachments?: EquipmentAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceInterval {
  id: string;
  equipmentId: string;
  name: string;
  intervalHours?: number;
  intervalDays?: number;
  lastPerformedHours?: number;
  lastPerformedDate?: string;
  notes?: string;
}

export type ConsumableCategory = 
  | 'filter'
  | 'oil'
  | 'fluid'
  | 'belt'
  | 'electrical'
  | 'hardware'
  | 'other';

export interface Consumable {
  id: string;
  name: string;
  partNumber: string;
  category: ConsumableCategory;
  supplier?: string;
  supplierPartNumber?: string;
  quantity: number;
  lowStockThreshold: number;
  compatibleEquipment?: string[];
  imageUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const CONSUMABLE_CATEGORIES: { value: ConsumableCategory; label: string }[] = [
  { value: 'filter', label: 'Filters' },
  { value: 'oil', label: 'Oil & Lubricants' },
  { value: 'fluid', label: 'Fluids' },
  { value: 'belt', label: 'Belts & Hoses' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  date: string;
  hoursAtService: number;
  type: 'routine' | 'repair' | 'inspection';
  description: string;
  consumablesUsed: { consumableId: string; name: string; quantity: number }[];
  performedBy: 'owner' | 'dealer' | 'employee';
  performedByName?: string;
  downtimeHours?: number;
  notes?: string;
  attachments?: EquipmentAttachment[];
  createdAt: string;
}

export const EQUIPMENT_TYPES: { value: EquipmentType; label: string; icon: string }[] = [
  { value: 'tractor', label: 'Tractor', icon: 'tractor' },
  { value: 'combine', label: 'Combine', icon: 'combine' },
  { value: 'truck', label: 'Truck', icon: 'truck' },
  { value: 'implement', label: 'Implement', icon: 'tool' },
  { value: 'sprayer', label: 'Sprayer', icon: 'sprayer' },
  { value: 'planter', label: 'Planter', icon: 'planter' },
  { value: 'loader', label: 'Loader', icon: 'loader' },
  { value: 'mower', label: 'Mower', icon: 'mower' },
  { value: 'utv', label: 'UTV', icon: 'utv' },
  { value: 'building', label: 'Building', icon: 'building' },
  { value: 'other', label: 'Other', icon: 'settings' },
];

export const DEFAULT_MAINTENANCE_INTERVALS: { name: string; intervalHours?: number; intervalDays?: number }[] = [];

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ServiceRoutine {
  id: string;
  name: string;
  description?: string;
  equipmentTypes?: EquipmentType[];
  checklistItems: Omit<ChecklistItem, 'completed'>[];
  createdAt: string;
  updatedAt: string;
}

export interface InspectionRoutine {
  id: string;
  name: string;
  description?: string;
  equipmentTypes?: EquipmentType[];
  checklistItems: Omit<ChecklistItem, 'completed'>[];
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  linkedDeviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface WorkOrderImage {
  id: string;
  uri: string;
  caption?: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  equipmentId?: string;
  assignedTo?: string[];
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  dueDate?: string;
  estimatedHours?: number;
  notes?: string;
  images?: WorkOrderImage[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const WORK_ORDER_PRIORITIES: { value: WorkOrderPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#6B7280' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'urgent', label: 'Urgent', color: '#DC2626' },
];

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: '#6B7280' },
  { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
  { value: 'completed', label: 'Completed', color: '#10B981' },
  { value: 'cancelled', label: 'Cancelled', color: '#9CA3AF' },
];

export type FuelType = 'off_road_diesel' | 'on_road_diesel' | 'gasoline' | 'custom';

export interface FuelLog {
  id: string;
  equipmentId: string;
  date: string;
  fuelType: FuelType;
  customFuelTypeName?: string;
  gallons: number;
  defGallons?: number;
  hoursAtFillUp: number;
  filledBy: 'owner' | 'dealer' | 'employee';
  filledByName?: string;
  notes?: string;
  createdAt: string;
}

export interface CustomFuelType {
  id: string;
  name: string;
  createdAt: string;
}

export const BUILT_IN_FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'off_road_diesel', label: 'Off-Road Diesel' },
  { value: 'on_road_diesel', label: 'On-Road Diesel' },
  { value: 'gasoline', label: 'Gasoline' },
];

export const FUEL_FILLER_OPTIONS: { value: FuelLog['filledBy']; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'employee', label: 'Employee' },
];

export const DEFAULT_SERVICE_ROUTINES: Omit<ServiceRoutine, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '250 Hour Service',
    description: 'Standard 250 hour maintenance routine',
    checklistItems: [
      { id: '1', text: 'Change engine oil' },
      { id: '2', text: 'Replace oil filter' },
      { id: '3', text: 'Check air filter' },
      { id: '4', text: 'Grease all fittings' },
      { id: '5', text: 'Check coolant level' },
      { id: '6', text: 'Inspect belts for wear' },
      { id: '7', text: 'Check tire pressure' },
    ],
  },
  {
    name: 'Daily Pre-Operation Check',
    description: 'Quick daily inspection before use',
    checklistItems: [
      { id: '1', text: 'Check engine oil level' },
      { id: '2', text: 'Check coolant level' },
      { id: '3', text: 'Check hydraulic fluid' },
      { id: '4', text: 'Inspect for leaks' },
      { id: '5', text: 'Check tire condition' },
      { id: '6', text: 'Test lights and signals' },
    ],
  },
];
