import { Equipment, EquipmentType } from '@/types/equipment';
import { formatMetric } from '@/utils/helpers';

export interface MaintenanceIntervalTemplate {
  name: string;
  intervalHours?: number;
  intervalDays?: number;
}

export interface EquipmentFormFieldConfig {
  photoSectionTitle: string;
  saveButtonText: string;
  name: { label: string; placeholder: string };
  make: { label: string; placeholder: string; required: boolean };
  model: { label: string; placeholder: string; required: boolean };
  year: { label: string; placeholder: string };
  showHours: boolean;
  showMetric: boolean;
  showSerialNumber: boolean;
  serialNumber: { label: string; placeholder: string };
  showOilCapacity: boolean;
  oilCapacity: { label: string; placeholder: string };
  purchaseDate: { label: string };
  notes: { placeholder: string };
  maintenanceInfoTitle: string;
  maintenanceInfoText: string;
}

const DEFAULT_FORM_CONFIG: EquipmentFormFieldConfig = {
  photoSectionTitle: 'Equipment Photo',
  saveButtonText: 'Save Equipment',
  name: { label: 'Name / Nickname *', placeholder: 'e.g., Main Tractor, Big Red' },
  make: { label: 'Make *', placeholder: 'John Deere', required: true },
  model: { label: 'Model *', placeholder: '8R 410', required: true },
  year: { label: 'Year', placeholder: '2024' },
  showHours: true,
  showMetric: true,
  showSerialNumber: true,
  serialNumber: { label: 'Serial Number', placeholder: 'Enter serial number' },
  showOilCapacity: true,
  oilCapacity: { label: 'Oil Capacity', placeholder: 'e.g., 15 quarts, 3.5 gallons' },
  purchaseDate: { label: 'Purchase Date' },
  notes: { placeholder: 'Additional notes about this equipment...' },
  maintenanceInfoTitle: 'Default Maintenance Schedules',
  maintenanceInfoText:
    'Standard maintenance intervals will be automatically created for this equipment. You can customize them later from the equipment details screen.',
};

const BUILDING_FORM_CONFIG: EquipmentFormFieldConfig = {
  photoSectionTitle: 'Building Photo',
  saveButtonText: 'Save Building',
  name: { label: 'Building Name *', placeholder: 'e.g., North Machine Shed, Main Shop' },
  make: { label: 'Builder / Manufacturer', placeholder: 'e.g., Morton, Wick, local contractor', required: false },
  model: { label: 'Size / Style *', placeholder: 'e.g., 40x60 pole barn, 80x120 machine shed', required: true },
  year: { label: 'Year Built', placeholder: '2024' },
  showHours: false,
  showMetric: false,
  showSerialNumber: true,
  serialNumber: { label: 'Permit / Parcel ID', placeholder: 'Optional permit or parcel number' },
  showOilCapacity: true,
  oilCapacity: { label: 'Square Footage', placeholder: 'e.g., 2,400 sq ft' },
  purchaseDate: { label: 'Install / Purchase Date' },
  notes: {
    placeholder:
      'Roof type, door sizes, electrical service, drainage, warranty details, or other building notes...',
  },
  maintenanceInfoTitle: 'Building Maintenance',
  maintenanceInfoText:
    'Annual roof inspection, semi-annual gutter cleaning, and quarterly door checks will be set up automatically. You can customize schedules from the building details screen.',
};

const FORM_CONFIG_BY_TYPE: Partial<Record<EquipmentType, EquipmentFormFieldConfig>> = {
  building: BUILDING_FORM_CONFIG,
};

export interface EquipmentDetailConfig {
  detailsSectionTitle: string;
  serialNumberLabel: string;
  purchaseDateLabel: string;
  oilCapacityLabel: string;
  showUsageMetric: boolean;
  showFuelHistory: boolean;
  showHoursInServiceLogs: boolean;
  includeFuelInExport: boolean;
}

const DEFAULT_DETAIL_CONFIG: EquipmentDetailConfig = {
  detailsSectionTitle: 'Equipment Details',
  serialNumberLabel: 'Serial Number',
  purchaseDateLabel: 'Purchase Date',
  oilCapacityLabel: 'Oil Capacity',
  showUsageMetric: true,
  showFuelHistory: true,
  showHoursInServiceLogs: true,
  includeFuelInExport: true,
};

const BUILDING_DETAIL_CONFIG: EquipmentDetailConfig = {
  detailsSectionTitle: 'Building Details',
  serialNumberLabel: 'Permit / Parcel ID',
  purchaseDateLabel: 'Install / Purchase Date',
  oilCapacityLabel: 'Square Footage',
  showUsageMetric: false,
  showFuelHistory: false,
  showHoursInServiceLogs: false,
  includeFuelInExport: false,
};

const DETAIL_CONFIG_BY_TYPE: Partial<Record<EquipmentType, EquipmentDetailConfig>> = {
  building: BUILDING_DETAIL_CONFIG,
};

export const DEFAULT_BUILDING_MAINTENANCE_INTERVALS: MaintenanceIntervalTemplate[] = [
  { name: 'Roof inspection', intervalDays: 365 },
  { name: 'Gutter cleaning', intervalDays: 180 },
  { name: 'Door & hardware check', intervalDays: 90 },
];

const MAINTENANCE_INTERVALS_BY_TYPE: Partial<Record<EquipmentType, MaintenanceIntervalTemplate[]>> = {
  building: DEFAULT_BUILDING_MAINTENANCE_INTERVALS,
};

export function isBuildingEquipment(type: EquipmentType): boolean {
  return type === 'building';
}

export function getEquipmentDetailConfig(type: EquipmentType): EquipmentDetailConfig {
  return DETAIL_CONFIG_BY_TYPE[type] ?? DEFAULT_DETAIL_CONFIG;
}

export function getDefaultMaintenanceIntervalsForType(type: EquipmentType): MaintenanceIntervalTemplate[] {
  return MAINTENANCE_INTERVALS_BY_TYPE[type] ?? [];
}

export function getEquipmentListCardSubtitle(equipment: Equipment): string {
  if (isBuildingEquipment(equipment.type)) {
    return equipment.oilCapacity?.trim() || 'Building';
  }
  return formatMetric(equipment.currentHours, equipment.metric);
}

export function formatMaintenanceIntervalLabel(intervalHours?: number, intervalDays?: number): string {
  if (intervalHours) return `Every ${intervalHours} hours`;
  if (!intervalDays) return '—';
  if (intervalDays === 365) return 'Annual';
  if (intervalDays === 180) return 'Every 6 months';
  if (intervalDays === 90) return 'Every 3 months';
  return `Every ${intervalDays} days`;
}

export function getEquipmentFormConfig(type: EquipmentType): EquipmentFormFieldConfig {
  return FORM_CONFIG_BY_TYPE[type] ?? DEFAULT_FORM_CONFIG;
}

export function validateEquipmentForm(
  type: EquipmentType,
  values: { name: string; make: string; model: string }
): string | null {
  const config = getEquipmentFormConfig(type);

  if (!values.name.trim()) {
    return type === 'building' ? 'Building name is required' : 'Equipment name is required';
  }
  if (config.make.required && !values.make.trim()) {
    return 'Make is required';
  }
  if (config.model.required && !values.model.trim()) {
    return type === 'building' ? 'Size / style is required' : 'Model is required';
  }

  return null;
}
