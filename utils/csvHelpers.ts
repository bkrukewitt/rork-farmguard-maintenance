import { ConsumableCategory, CONSUMABLE_CATEGORIES } from '@/types/equipment';

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
  'Notes',
];

export const CSV_TEMPLATE_EXAMPLE_ROWS = [
  ['Engine Oil Filter', 'RE504836', 'filter', 'John Deere', 'JD-RE504836', '5', '2', 'For 8R series tractors'],
  ['Hydraulic Filter', 'RE210857', 'filter', 'NAPA', 'NAP-2108', '3', '2', ''],
  ['15W-40 Engine Oil', 'TY26674', 'oil', 'John Deere', '', '12', '4', '2.5 gallon jugs'],
  ['Coolant', 'TY26575', 'fluid', 'John Deere', '', '4', '2', 'Pre-mixed'],
  ['Fan Belt', 'R503581', 'belt', '', '', '2', '1', 'Check for cracking'],
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

export function exportConsumablesToCSV(consumables: {
  name: string;
  partNumber: string;
  category: string;
  supplier?: string;
  supplierPartNumber?: string;
  quantity: number;
  lowStockThreshold: number;
  notes?: string;
}[]): string {
  const lines: string[] = [];
  
  lines.push(CSV_TEMPLATE_HEADERS.join(','));
  
  consumables.forEach(item => {
    const row = [
      item.name,
      item.partNumber,
      item.category,
      item.supplier || '',
      item.supplierPartNumber || '',
      item.quantity.toString(),
      item.lowStockThreshold.toString(),
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
