import type {
  Consumable,
  CustomFuelType,
  Employee,
  Equipment,
  FuelLog,
  MaintenanceInterval,
  MaintenanceLog,
  WorkOrder,
} from '@/types/equipment';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const now = new Date().toISOString();

export const DEMO_EQUIPMENT: Equipment[] = [
  {
    id: 'demo-eq-tractor-1',
    name: 'JD 8370RT',
    type: 'tractor',
    make: 'John Deere',
    model: '8370RT',
    year: 2018,
    serialNumber: '1RW8370RCJD918206',
    purchaseDate: '2025-07-22',
    currentHours: 2383.4,
    metric: 'hours',
    notes: 'Demo equipment. Editing is disabled until you subscribe.',
    createdAt: isoDaysAgo(120),
    updatedAt: isoDaysAgo(2),
  },
  {
    id: 'demo-eq-combine-1',
    name: 'S780',
    type: 'combine',
    make: 'John Deere',
    model: 'S780',
    year: 2019,
    serialNumber: '1H0S780STKT777777',
    purchaseDate: '2024-10-01',
    currentHours: 1321.2,
    metric: 'hours',
    createdAt: isoDaysAgo(160),
    updatedAt: isoDaysAgo(5),
  },
  {
    id: 'demo-eq-sprayer-1',
    name: 'R4038',
    type: 'sprayer',
    make: 'John Deere',
    model: 'R4038',
    year: 2020,
    serialNumber: '1N0R4038LKT888888',
    purchaseDate: '2025-04-15',
    currentHours: 742.5,
    metric: 'hours',
    createdAt: isoDaysAgo(90),
    updatedAt: isoDaysAgo(1),
  },
];

export const DEMO_MAINTENANCE_LOGS: MaintenanceLog[] = [
  {
    id: 'demo-log-1',
    equipmentId: 'demo-eq-tractor-1',
    date: isoDaysAgo(7),
    hoursAtService: 2350,
    type: 'routine',
    description: '250-hour service (oil + filters)',
    consumablesUsed: [
      { consumableId: 'demo-cons-1', name: 'Engine Oil 15W-40', quantity: 8 },
      { consumableId: 'demo-cons-2', name: 'Oil Filter', quantity: 1 },
    ],
    performedBy: 'owner',
    notes: 'Demo log entry.',
    createdAt: isoDaysAgo(7),
  },
  {
    id: 'demo-log-2',
    equipmentId: 'demo-eq-combine-1',
    date: isoDaysAgo(30),
    hoursAtService: 1290,
    type: 'inspection',
    description: 'Pre-harvest inspection',
    consumablesUsed: [],
    performedBy: 'employee',
    performedByName: 'Shop',
    createdAt: isoDaysAgo(30),
  },
];

export const DEMO_INTERVALS: MaintenanceInterval[] = [
  {
    id: 'demo-int-1',
    equipmentId: 'demo-eq-tractor-1',
    name: 'Engine oil & filter',
    intervalHours: 250,
    lastPerformedHours: 2350,
    lastPerformedDate: isoDaysAgo(7),
  },
  {
    id: 'demo-int-2',
    equipmentId: 'demo-eq-tractor-1',
    name: 'Grease points',
    intervalHours: 50,
    lastPerformedHours: 2375,
    lastPerformedDate: isoDaysAgo(2),
  },
];

export const DEMO_CONSUMABLES: Consumable[] = [
  {
    id: 'demo-cons-1',
    name: 'Engine Oil 15W-40',
    partNumber: 'OIL-15W40',
    category: 'oil',
    quantity: 12,
    lowStockThreshold: 4,
    createdAt: isoDaysAgo(200),
    updatedAt: isoDaysAgo(15),
  },
  {
    id: 'demo-cons-2',
    name: 'Oil Filter',
    partNumber: 'RE504836',
    category: 'filter',
    quantity: 2,
    lowStockThreshold: 2,
    createdAt: isoDaysAgo(200),
    updatedAt: isoDaysAgo(15),
  },
];

export const DEMO_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'demo-wo-1',
    title: 'Replace hydraulic hose',
    description: 'Hose near hitch has a hole; needs replaced',
    equipmentId: 'demo-eq-tractor-1',
    assignedTo: ['demo-emp-1'],
    priority: 'medium',
    status: 'pending',
    createdAt: isoDaysAgo(41),
    updatedAt: isoDaysAgo(41),
  },
  {
    id: 'demo-wo-2',
    title: 'Calibrate sprayer flow meter',
    description: 'Verify flow meter and section control before spraying',
    equipmentId: 'demo-eq-sprayer-1',
    assignedTo: ['demo-emp-2'],
    priority: 'high',
    status: 'in_progress',
    dueDate: isoDaysAgo(-3),
    createdAt: isoDaysAgo(10),
    updatedAt: isoDaysAgo(1),
  },
  {
    id: 'demo-wo-3',
    title: 'Clean combine sensors',
    description: 'Clean and inspect sensors after harvest',
    equipmentId: 'demo-eq-combine-1',
    priority: 'low',
    status: 'completed',
    createdAt: isoDaysAgo(80),
    updatedAt: isoDaysAgo(60),
    completedAt: isoDaysAgo(60),
  },
];

export const DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'demo-emp-1',
    name: 'Brian',
    role: 'Owner',
    createdAt: isoDaysAgo(300),
    updatedAt: isoDaysAgo(20),
  },
  {
    id: 'demo-emp-2',
    name: 'Shop',
    role: 'Employee',
    createdAt: isoDaysAgo(250),
    updatedAt: isoDaysAgo(25),
  },
];

export const DEMO_CUSTOM_FUEL_TYPES: CustomFuelType[] = [
  { id: 'demo-fuel-custom-1', name: 'Bulk tank diesel', createdAt: isoDaysAgo(400) },
];

export const DEMO_FUEL_LOGS: FuelLog[] = [
  {
    id: 'demo-fuel-1',
    equipmentId: 'demo-eq-tractor-1',
    date: isoDaysAgo(3),
    fuelType: 'off_road_diesel',
    gallons: 72,
    defGallons: 2.5,
    hoursAtFillUp: 2378,
    filledBy: 'owner',
    notes: 'Demo fuel entry.',
    createdAt: isoDaysAgo(3),
  },
  {
    id: 'demo-fuel-2',
    equipmentId: 'demo-eq-combine-1',
    date: isoDaysAgo(65),
    fuelType: 'custom',
    customFuelTypeName: 'Bulk tank diesel',
    gallons: 110,
    hoursAtFillUp: 1260,
    filledBy: 'employee',
    filledByName: 'Shop',
    createdAt: isoDaysAgo(65),
  },
];

export const DEMO_META = {
  generatedAt: now,
};

