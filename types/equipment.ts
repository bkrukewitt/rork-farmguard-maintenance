export type EquipmentType = 
  | 'tractor'
  | 'combine'
  | 'truck'
  | 'implement'
  | 'sprayer'
  | 'planter'
  | 'loader'
  | 'mower'
  | 'other';

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
  imageUrl?: string;
  warrantyExpiry?: string;
  notes?: string;
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
  { value: 'other', label: 'Other', icon: 'settings' },
];

export const DEFAULT_MAINTENANCE_INTERVALS = [
  { name: 'Oil Change', intervalHours: 250 },
  { name: 'Grease Fittings', intervalHours: 50 },
  { name: 'Air Filter', intervalHours: 500 },
  { name: 'Fuel Filter', intervalHours: 500 },
  { name: 'Hydraulic Filter', intervalHours: 1000 },
  { name: 'Coolant Check', intervalHours: 100 },
  { name: 'Belt Inspection', intervalHours: 500 },
  { name: 'Annual Inspection', intervalDays: 365 },
];

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
