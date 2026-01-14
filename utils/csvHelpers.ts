import { ConsumableCategory, CONSUMABLE_CATEGORIES, EquipmentType, EQUIPMENT_TYPES } from '@/types/equipment';

export interface CSVParseResult {
  success: boolean;
  data: ParsedPart[];
  errors: string[];
}

export interface ParsedPart {
  name: string;
  partNumber: string;
  category: ConsumableCategory;
  supplier?: string;
  supplierPartNumber?: string;
  quantity: number;
  lowStockThreshold: number;
  equipment?: string;
  notes?: string;
  rowNumber: number;
  isValid: boolean;
  validationError?: string;
}

export const CSV_TEMPLATE_HEADERS = [
  'Part Name',
  'Part Number',
  'Category',
  'Supplier',
  'Supplier Part Number',
  'Quantity',
  'Low Stock Threshold',
  'Equipment',
  'Notes',
];

export const CSV_TEMPLATE_EXAMPLE_ROWS = [
  ['Engine Oil Filter', 'RE504836', 'filter', 'John Deere', 'JD-RE504836', '5', '2', 'Main Tractor', 'For 8R series tractors'],
  ['Hydraulic Filter', 'RE210857', 'filter', 'NAPA', 'NAP-2108', '3', '2', 'Main Tractor, Grain Combine', ''],
  ['15W-40 Engine Oil', 'TY26674', 'oil', 'John Deere', '', '12', '4', '', '2.5 gallon jugs'],
  ['Coolant', 'TY26575', 'fluid', 'John Deere', '', '4', '2', 'Main Tractor', 'Pre-mixed'],
  ['Fan Belt', 'R503581', 'belt', '', '', '2', '1', 'Farm Truck', 'Check for cracking'],
];

export function generateCSVTemplate(): string {
  const lines: string[] = [];
  
  lines.push(CSV_TEMPLATE_HEADERS.join(','));
  
  CSV_TEMPLATE_EXAMPLE_ROWS.forEach(row => {
    const escapedRow = row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    lines.push(escapedRow.join(','));
  });
  
  return lines.join('\n');
}

export function generateEmptyCSVTemplate(): string {
  const lines: string[] = [];
  
  lines.push(CSV_TEMPLATE_HEADERS.join(','));
  lines.push('');
  
  return lines.join('\n');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current.trim());
  return result;
}

function normalizeCategory(categoryStr: string): ConsumableCategory | null {
  const normalized = categoryStr.toLowerCase().trim();
  
  const categoryMap: Record<string, ConsumableCategory> = {
    'filter': 'filter',
    'filters': 'filter',
    'oil': 'oil',
    'oils': 'oil',
    'oil & lubricants': 'oil',
    'lubricant': 'oil',
    'lubricants': 'oil',
    'fluid': 'fluid',
    'fluids': 'fluid',
    'belt': 'belt',
    'belts': 'belt',
    'belts & hoses': 'belt',
    'hose': 'belt',
    'hoses': 'belt',
    'electrical': 'electrical',
    'electric': 'electrical',
    'hardware': 'hardware',
    'other': 'other',
  };
  
  if (categoryMap[normalized]) {
    return categoryMap[normalized];
  }
  
  const validCategory = CONSUMABLE_CATEGORIES.find(
    c => c.value === normalized || c.label.toLowerCase() === normalized
  );
  
  return validCategory?.value ?? null;
}

export function parseCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  const errors: string[] = [];
  const data: ParsedPart[] = [];
  
  if (lines.length === 0) {
    return { success: false, data: [], errors: ['File is empty'] };
  }
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
  
  const nameIndex = headers.findIndex(h => h.includes('name') && !h.includes('supplier'));
  const partNumberIndex = headers.findIndex(h => h.includes('part') && h.includes('number') && !h.includes('supplier'));
  const categoryIndex = headers.findIndex(h => h.includes('category'));
  const supplierIndex = headers.findIndex(h => h === 'supplier' || h === 'supplier name');
  const supplierPartIndex = headers.findIndex(h => h.includes('supplier') && h.includes('part'));
  const quantityIndex = headers.findIndex(h => h.includes('quantity') || h.includes('qty') || h.includes('stock'));
  const thresholdIndex = headers.findIndex(h => h.includes('threshold') || h.includes('low stock') || h.includes('alert'));
  const equipmentIndex = headers.findIndex(h => h.includes('equipment') || h.includes('machine') || h.includes('compatible'));
  const notesIndex = headers.findIndex(h => h.includes('note'));
  
  if (nameIndex === -1 || partNumberIndex === -1) {
    errors.push('Missing required columns: Part Name and Part Number');
    return { success: false, data: [], errors };
  }
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const rowNumber = i + 1;
    
    const name = values[nameIndex]?.trim() || '';
    const partNumber = values[partNumberIndex]?.trim() || '';
    const categoryStr = categoryIndex >= 0 ? values[categoryIndex]?.trim() || '' : '';
    const supplier = supplierIndex >= 0 ? values[supplierIndex]?.trim() || '' : '';
    const supplierPartNumber = supplierPartIndex >= 0 ? values[supplierPartIndex]?.trim() || '' : '';
    const quantityStr = quantityIndex >= 0 ? values[quantityIndex]?.trim() || '0' : '0';
    const thresholdStr = thresholdIndex >= 0 ? values[thresholdIndex]?.trim() || '2' : '2';
    const equipment = equipmentIndex >= 0 ? values[equipmentIndex]?.trim() || '' : '';
    const notes = notesIndex >= 0 ? values[notesIndex]?.trim() || '' : '';
    
    let isValid = true;
    let validationError: string | undefined;
    
    if (!name) {
      isValid = false;
      validationError = 'Part name is required';
    } else if (!partNumber) {
      isValid = false;
      validationError = 'Part number is required';
    }
    
    let category: ConsumableCategory = 'other';
    if (categoryStr) {
      const normalizedCategory = normalizeCategory(categoryStr);
      if (normalizedCategory) {
        category = normalizedCategory;
      } else {
        errors.push(`Row ${rowNumber}: Unknown category "${categoryStr}", using "other"`);
      }
    }
    
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 0) {
      errors.push(`Row ${rowNumber}: Invalid quantity "${quantityStr}", using 0`);
    }
    
    const lowStockThreshold = parseInt(thresholdStr, 10);
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      errors.push(`Row ${rowNumber}: Invalid threshold "${thresholdStr}", using 2`);
    }
    
    data.push({
      name,
      partNumber,
      category,
      supplier: supplier || undefined,
      supplierPartNumber: supplierPartNumber || undefined,
      quantity: isNaN(quantity) || quantity < 0 ? 0 : quantity,
      lowStockThreshold: isNaN(lowStockThreshold) || lowStockThreshold < 0 ? 2 : lowStockThreshold,
      equipment: equipment || undefined,
      notes: notes || undefined,
      rowNumber,
      isValid,
      validationError,
    });
  }
  
  if (data.length === 0) {
    errors.push('No data rows found in the file');
    return { success: false, data: [], errors };
  }
  
  const validCount = data.filter(d => d.isValid).length;
  console.log(`CSV parsing complete: ${validCount}/${data.length} valid rows`);
  
  return { 
    success: validCount > 0, 
    data, 
    errors 
  };
}

export interface ExportConsumable {
  name: string;
  partNumber: string;
  category: string;
  supplier?: string;
  supplierPartNumber?: string;
  quantity: number;
  lowStockThreshold: number;
  compatibleEquipment?: string[];
  notes?: string;
}

export interface ExportEquipment {
  id: string;
  name: string;
}

function getEquipmentNicknames(
  compatibleEquipment: string[] | undefined,
  equipmentList: ExportEquipment[]
): string {
  if (!compatibleEquipment || compatibleEquipment.length === 0) return '';
  
  return compatibleEquipment
    .map(idOrName => {
      const equipment = equipmentList.find(e => e.id === idOrName || e.name === idOrName);
      return equipment ? equipment.name : idOrName;
    })
    .join(', ');
}

function getPrimaryEquipment(
  compatibleEquipment: string[] | undefined,
  equipmentList: ExportEquipment[]
): string {
  if (!compatibleEquipment || compatibleEquipment.length === 0) return 'Unassigned';
  
  const firstId = compatibleEquipment[0];
  const equipment = equipmentList.find(e => e.id === firstId || e.name === firstId);
  return equipment ? equipment.name : firstId;
}

export function exportConsumablesToCSV(
  consumables: ExportConsumable[],
  equipmentList: ExportEquipment[] = []
): string {
  const lines: string[] = [];
  
  lines.push(CSV_TEMPLATE_HEADERS.join(','));
  
  const sortedConsumables = [...consumables].sort((a, b) => {
    const equipA = getPrimaryEquipment(a.compatibleEquipment, equipmentList);
    const equipB = getPrimaryEquipment(b.compatibleEquipment, equipmentList);
    
    if (equipA === 'Unassigned' && equipB !== 'Unassigned') return 1;
    if (equipB === 'Unassigned' && equipA !== 'Unassigned') return -1;
    
    const equipCompare = equipA.localeCompare(equipB);
    if (equipCompare !== 0) return equipCompare;
    
    return a.name.localeCompare(b.name);
  });
  
  let lastEquipment = '';
  
  sortedConsumables.forEach(item => {
    const currentEquipment = getPrimaryEquipment(item.compatibleEquipment, equipmentList);
    
    if (lastEquipment && currentEquipment !== lastEquipment) {
      lines.push(',,,,,,,,')
    }
    lastEquipment = currentEquipment;
    
    const equipmentNames = getEquipmentNicknames(item.compatibleEquipment, equipmentList);
    
    const row = [
      item.name,
      item.partNumber,
      item.category,
      item.supplier || '',
      item.supplierPartNumber || '',
      item.quantity.toString(),
      item.lowStockThreshold.toString(),
      equipmentNames,
      item.notes || '',
    ].map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    lines.push(row.join(','));
  });
  
  return lines.join('\n');
}

export function exportConsumablesToHTML(
  consumables: ExportConsumable[],
  equipmentList: ExportEquipment[] = []
): string {
  const sortedConsumables = [...consumables].sort((a, b) => {
    const equipA = getPrimaryEquipment(a.compatibleEquipment, equipmentList);
    const equipB = getPrimaryEquipment(b.compatibleEquipment, equipmentList);
    
    if (equipA === 'Unassigned' && equipB !== 'Unassigned') return 1;
    if (equipB === 'Unassigned' && equipA !== 'Unassigned') return -1;
    
    const equipCompare = equipA.localeCompare(equipB);
    if (equipCompare !== 0) return equipCompare;
    
    return a.name.localeCompare(b.name);
  });
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Parts Inventory Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #4a7c59; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr.low-stock { background-color: #ffcccc !important; }
    tr.low-stock td { color: #cc0000; font-weight: 500; }
    tr.group-separator td { background-color: #e8e8e8; height: 10px; padding: 0; border-left: none; border-right: none; }
    .export-date { color: #666; font-size: 14px; margin-bottom: 20px; }
    .legend { margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
    .legend-item { display: inline-block; margin-right: 20px; }
    .legend-color { display: inline-block; width: 20px; height: 20px; vertical-align: middle; margin-right: 5px; }
    .legend-low-stock { background-color: #ffcccc; border: 1px solid #cc0000; }
  </style>
</head>
<body>
  <h1>Parts Inventory Export</h1>
  <p class="export-date">Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
  <div class="legend">
    <span class="legend-item"><span class="legend-color legend-low-stock"></span> Low Stock</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Part Name</th>
        <th>Part Number</th>
        <th>Category</th>
        <th>Supplier</th>
        <th>Supplier Part #</th>
        <th>Quantity</th>
        <th>Low Stock Threshold</th>
        <th>Equipment</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>`;
  
  let lastEquipment = '';
  
  sortedConsumables.forEach(item => {
    const currentEquipment = getPrimaryEquipment(item.compatibleEquipment, equipmentList);
    const isLowStock = item.quantity <= item.lowStockThreshold;
    const equipmentNames = getEquipmentNicknames(item.compatibleEquipment, equipmentList);
    
    if (lastEquipment && currentEquipment !== lastEquipment) {
      html += `
      <tr class="group-separator"><td colspan="9"></td></tr>`;
    }
    lastEquipment = currentEquipment;
    
    const rowClass = isLowStock ? 'low-stock' : '';
    html += `
      <tr class="${rowClass}">
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.partNumber)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.supplier || '')}</td>
        <td>${escapeHtml(item.supplierPartNumber || '')}</td>
        <td>${item.quantity}</td>
        <td>${item.lowStockThreshold}</td>
        <td>${escapeHtml(equipmentNames)}</td>
        <td>${escapeHtml(item.notes || '')}</td>
      </tr>`;
  });
  
  html += `
    </tbody>
  </table>
</body>
</html>`;
  
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface EquipmentCSVParseResult {
  success: boolean;
  data: ParsedEquipment[];
  errors: string[];
}

export interface ParsedEquipment {
  name: string;
  type: EquipmentType;
  make: string;
  model: string;
  year: number;
  serialNumber: string;
  purchaseDate: string;
  currentHours: number;
  warrantyExpiry?: string;
  notes?: string;
  rowNumber: number;
  isValid: boolean;
  validationError?: string;
}

export const EQUIPMENT_CSV_HEADERS = [
  'Name',
  'Type',
  'Make',
  'Model',
  'Year',
  'Serial Number',
  'Purchase Date',
  'Current Hours',
  'Warranty Expiry',
  'Notes',
];

export const EQUIPMENT_CSV_EXAMPLE_ROWS = [
  ['Main Tractor', 'tractor', 'John Deere', '8R 370', '2022', 'JD8R370-12345', '2022-03-15', '1250', '2027-03-15', 'Primary field tractor'],
  ['Grain Combine', 'combine', 'John Deere', 'S780', '2021', 'JDS780-67890', '2021-06-01', '850', '2026-06-01', ''],
  ['Farm Truck', 'truck', 'Ford', 'F-350', '2020', 'F350-11111', '2020-01-10', '45000', '', 'Service truck'],
  ['Planter', 'planter', 'John Deere', 'DB60', '2023', 'JDDB60-22222', '2023-02-20', '150', '2028-02-20', '24 row planter'],
];

export function generateEquipmentCSVTemplate(): string {
  const lines: string[] = [];
  
  lines.push(EQUIPMENT_CSV_HEADERS.join(','));
  
  EQUIPMENT_CSV_EXAMPLE_ROWS.forEach(row => {
    const escapedRow = row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    lines.push(escapedRow.join(','));
  });
  
  return lines.join('\n');
}

function normalizeEquipmentType(typeStr: string): EquipmentType | null {
  const normalized = typeStr.toLowerCase().trim();
  
  const typeMap: Record<string, EquipmentType> = {
    'tractor': 'tractor',
    'tractors': 'tractor',
    'combine': 'combine',
    'combines': 'combine',
    'harvester': 'combine',
    'truck': 'truck',
    'trucks': 'truck',
    'pickup': 'truck',
    'implement': 'implement',
    'implements': 'implement',
    'attachment': 'implement',
    'sprayer': 'sprayer',
    'sprayers': 'sprayer',
    'planter': 'planter',
    'planters': 'planter',
    'seeder': 'planter',
    'loader': 'loader',
    'loaders': 'loader',
    'mower': 'mower',
    'mowers': 'mower',
    'other': 'other',
  };
  
  if (typeMap[normalized]) {
    return typeMap[normalized];
  }
  
  const validType = EQUIPMENT_TYPES.find(
    t => t.value === normalized || t.label.toLowerCase() === normalized
  );
  
  return validType?.value ?? null;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        return dateStr;
      } else {
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }
  
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

export function parseEquipmentCSV(csvContent: string): EquipmentCSVParseResult {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  const errors: string[] = [];
  const data: ParsedEquipment[] = [];
  
  if (lines.length === 0) {
    return { success: false, data: [], errors: ['File is empty'] };
  }
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
  
  const nameIndex = headers.findIndex(h => h === 'name' || h === 'equipment name');
  const typeIndex = headers.findIndex(h => h === 'type' || h === 'equipment type');
  const makeIndex = headers.findIndex(h => h === 'make' || h === 'manufacturer');
  const modelIndex = headers.findIndex(h => h === 'model');
  const yearIndex = headers.findIndex(h => h === 'year');
  const serialIndex = headers.findIndex(h => h.includes('serial'));
  const purchaseDateIndex = headers.findIndex(h => h.includes('purchase') && h.includes('date'));
  const hoursIndex = headers.findIndex(h => h.includes('hour'));
  const warrantyIndex = headers.findIndex(h => h.includes('warranty'));
  const notesIndex = headers.findIndex(h => h.includes('note'));
  
  if (nameIndex === -1) {
    errors.push('Missing required column: Name');
    return { success: false, data: [], errors };
  }
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const rowNumber = i + 1;
    
    const name = values[nameIndex]?.trim() || '';
    const typeStr = typeIndex >= 0 ? values[typeIndex]?.trim() || '' : '';
    const make = makeIndex >= 0 ? values[makeIndex]?.trim() || '' : '';
    const model = modelIndex >= 0 ? values[modelIndex]?.trim() || '' : '';
    const yearStr = yearIndex >= 0 ? values[yearIndex]?.trim() || '' : '';
    const serialNumber = serialIndex >= 0 ? values[serialIndex]?.trim() || '' : '';
    const purchaseDateStr = purchaseDateIndex >= 0 ? values[purchaseDateIndex]?.trim() || '' : '';
    const hoursStr = hoursIndex >= 0 ? values[hoursIndex]?.trim() || '0' : '0';
    const warrantyStr = warrantyIndex >= 0 ? values[warrantyIndex]?.trim() || '' : '';
    const notes = notesIndex >= 0 ? values[notesIndex]?.trim() || '' : '';
    
    let isValid = true;
    let validationError: string | undefined;
    
    if (!name) {
      isValid = false;
      validationError = 'Equipment name is required';
    }
    
    let type: EquipmentType = 'other';
    if (typeStr) {
      const normalizedType = normalizeEquipmentType(typeStr);
      if (normalizedType) {
        type = normalizedType;
      } else {
        errors.push(`Row ${rowNumber}: Unknown type "${typeStr}", using "other"`);
      }
    }
    
    const year = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();
    if (yearStr && (isNaN(year) || year < 1900 || year > currentYear + 2)) {
      errors.push(`Row ${rowNumber}: Invalid year "${yearStr}", using current year`);
    }
    
    const currentHours = parseFloat(hoursStr);
    if (isNaN(currentHours) || currentHours < 0) {
      errors.push(`Row ${rowNumber}: Invalid hours "${hoursStr}", using 0`);
    }
    
    let purchaseDate = parseDate(purchaseDateStr);
    if (purchaseDateStr && !purchaseDate) {
      errors.push(`Row ${rowNumber}: Invalid purchase date "${purchaseDateStr}", using today`);
      purchaseDate = new Date().toISOString().split('T')[0];
    }
    
    let warrantyExpiry: string | undefined;
    if (warrantyStr) {
      const parsedWarranty = parseDate(warrantyStr);
      if (parsedWarranty) {
        warrantyExpiry = parsedWarranty;
      } else {
        errors.push(`Row ${rowNumber}: Invalid warranty date "${warrantyStr}", skipping`);
      }
    }
    
    data.push({
      name,
      type,
      make: make || 'Unknown',
      model: model || 'Unknown',
      year: isNaN(year) || year < 1900 || year > currentYear + 2 ? currentYear : year,
      serialNumber: serialNumber || '',
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      currentHours: isNaN(currentHours) || currentHours < 0 ? 0 : currentHours,
      warrantyExpiry,
      notes: notes || undefined,
      rowNumber,
      isValid,
      validationError,
    });
  }
  
  if (data.length === 0) {
    errors.push('No data rows found in the file');
    return { success: false, data: [], errors };
  }
  
  const validCount = data.filter(d => d.isValid).length;
  console.log(`Equipment CSV parsing complete: ${validCount}/${data.length} valid rows`);
  
  return { 
    success: validCount > 0, 
    data, 
    errors 
  };
}

export function exportEquipmentToCSV(equipmentList: {
  name: string;
  type: string;
  make: string;
  model: string;
  year: number;
  serialNumber: string;
  purchaseDate: string;
  currentHours: number;
  warrantyExpiry?: string;
  notes?: string;
}[]): string {
  const lines: string[] = [];
  
  lines.push(EQUIPMENT_CSV_HEADERS.join(','));
  
  equipmentList.forEach(item => {
    const row = [
      item.name,
      item.type,
      item.make,
      item.model,
      item.year.toString(),
      item.serialNumber,
      item.purchaseDate,
      item.currentHours.toString(),
      item.warrantyExpiry || '',
      item.notes || '',
    ].map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    lines.push(row.join(','));
  });
  
  return lines.join('\n');
}
