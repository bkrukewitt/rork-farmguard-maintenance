import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

import {
  generateMaintenancePdfHtml,
  generateFuelOnlyPdfHtml,
  sanitizeFileName,
  formatDateForFileName,
} from '@/utils/pdfTemplate';
import {
  Equipment,
  MaintenanceLog,
  FuelLog,
  Consumable,
  FuelType,
  BUILT_IN_FUEL_TYPES,
} from '@/types/equipment';
import { ColorScheme } from '@/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Option interfaces
// ---------------------------------------------------------------------------

export interface GeneratePdfOptions {
  equipment: Equipment[];
  maintenanceLogs: MaintenanceLog[];
  fuelLogs: FuelLog[];
  consumables: Consumable[];
  colorScheme: ColorScheme;
  dateRange: { start: string; end: string; label: string };
  includeFuel: boolean;
  includeNotes: boolean;
  includeAttachments: boolean;
  isBatchSummary: boolean;
}

export interface GenerateFuelPdfOptions {
  equipment: Equipment[];
  fuelLogs: FuelLog[];
  colorScheme: ColorScheme;
  dateRange: { start: string; end: string; label: string };
}

export interface GenerateFuelExcelOptions {
  equipment: Equipment[];
  fuelLogs: FuelLog[];
  dateRange: { start: string; end: string; label: string };
  separateSheets: boolean;
}

export interface FileNameOptions {
  equipmentNames: string[];
  exportType: 'maintenance' | 'fuel';
  dateRangeLabel: string;
  extension: 'pdf' | 'xlsx' | 'zip';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFuelTypeLabel(fuelType: FuelType, customFuelTypeName?: string): string {
  if (fuelType === 'custom') {
    return customFuelTypeName || 'Custom';
  }
  const builtIn = BUILT_IN_FUEL_TYPES.find((t) => t.value === fuelType);
  return builtIn?.label ?? fuelType;
}

export function filterLogsByDateRange<T extends { date: string }>(
  logs: T[],
  start: string,
  end: string,
): T[] {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return logs.filter((log) => {
    const logDate = new Date(log.date);
    return logDate >= startDate && logDate <= endDate;
  });
}

export function getDateRangeForPreset(
  preset: 'ytd' | 'last12' | 'alltime',
  allDates: string[],
): { start: string; end: string; label: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (preset === 'ytd') {
    const start = `${today.getFullYear()}-01-01`;
    return { start, end: todayStr, label: `YTD ${today.getFullYear()}` };
  }

  if (preset === 'last12') {
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const start = twelveMonthsAgo.toISOString().split('T')[0];
    return { start, end: todayStr, label: 'Last 12 Months' };
  }

  // alltime
  if (allDates.length === 0) {
    return { start: todayStr, end: todayStr, label: 'All Time' };
  }

  const sorted = [...allDates].sort();
  const earliest = sorted[0];
  const formatReadable = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return {
    start: earliest,
    end: todayStr,
    label: `${formatReadable(earliest)} – ${formatReadable(todayStr)}`,
  };
}

export function getExportFileName(options: FileNameOptions): string {
  const { equipmentNames, exportType, dateRangeLabel, extension } = options;
  const sanitizedDateRange = sanitizeFileName(dateRangeLabel);
  const typeLabel = exportType === 'maintenance' ? 'Maintenance' : 'Fuel';

  if (extension === 'zip') {
    return `FarmGuard_Equipment_Reports_${sanitizedDateRange}.zip`;
  }

  if (equipmentNames.length === 1) {
    const sanitizedName = sanitizeFileName(equipmentNames[0]);
    return `FarmGuard_${sanitizedName}_${typeLabel}_${sanitizedDateRange}.${extension}`;
  }

  return `FarmGuard_AllEquipment_${typeLabel}_${sanitizedDateRange}.${extension}`;
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

export async function generateMaintenancePdf(
  options: GeneratePdfOptions,
): Promise<string> {
  try {
    const {
      equipment,
      maintenanceLogs,
      fuelLogs,
      consumables,
      colorScheme,
      dateRange,
      includeFuel,
      includeNotes,
      includeAttachments,
      isBatchSummary,
    } = options;

    const equipmentIds = equipment.map((e) => e.id);

    const filteredMaintenance = filterLogsByDateRange(
      maintenanceLogs.filter((log) => equipmentIds.includes(log.equipmentId)),
      dateRange.start,
      dateRange.end,
    );

    const filteredFuel = includeFuel
      ? filterLogsByDateRange(
          fuelLogs.filter((log) => equipmentIds.includes(log.equipmentId)),
          dateRange.start,
          dateRange.end,
        )
      : [];

    const generationDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const html = generateMaintenancePdfHtml({
      equipment,
      maintenanceLogs: filteredMaintenance,
      fuelLogs: filteredFuel,
      consumables,
      colorScheme,
      dateRange,
      includeFuel,
      includeNotes,
      includeAttachments,
      isBatchSummary,
      generationDate,
    });

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    console.error('Error generating maintenance PDF:', error);
    throw error;
  }
}

export async function generateFuelPdf(
  options: GenerateFuelPdfOptions,
): Promise<string> {
  try {
    const { equipment, fuelLogs, colorScheme, dateRange } = options;
    const equipmentIds = equipment.map((e) => e.id);

    const filteredFuel = filterLogsByDateRange(
      fuelLogs.filter((log) => equipmentIds.includes(log.equipmentId)),
      dateRange.start,
      dateRange.end,
    );

    const generationDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const html = generateFuelOnlyPdfHtml({
      equipment,
      fuelLogs: filteredFuel,
      colorScheme,
      dateRange,
      generationDate,
    });

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    console.error('Error generating fuel PDF:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Excel generation
// ---------------------------------------------------------------------------

export async function generateFuelExcel(
  options: GenerateFuelExcelOptions,
): Promise<string> {
  try {
    const { equipment, fuelLogs, dateRange, separateSheets } = options;
    const equipmentIds = equipment.map((e) => e.id);

    const filteredFuel = filterLogsByDateRange(
      fuelLogs.filter((log) => equipmentIds.includes(log.equipmentId)),
      dateRange.start,
      dateRange.end,
    );

    const workbook = XLSX.utils.book_new();

    if (separateSheets) {
      for (const equip of equipment) {
        const logsForEquip = filteredFuel.filter((l) => l.equipmentId === equip.id);
        if (logsForEquip.length === 0) continue;

        const rows = logsForEquip.map((log) => ({
          Date: log.date,
          'Fuel Type': getFuelTypeLabel(log.fuelType, log.customFuelTypeName),
          Gallons: log.gallons,
          'DEF Gallons': log.defGallons ?? 0,
          'Hours at Fill-up': log.hoursAtFillUp,
          'Filled By': log.filledByName || log.filledBy,
          Notes: log.notes || '',
        }));

        const totalGallons = logsForEquip.reduce((sum, l) => sum + l.gallons, 0);
        const totalDef = logsForEquip.reduce((sum, l) => sum + (l.defGallons ?? 0), 0);

        rows.push({
          Date: 'TOTALS',
          'Fuel Type': '',
          Gallons: totalGallons,
          'DEF Gallons': totalDef,
          'Hours at Fill-up': 0,
          'Filled By': '',
          Notes: '',
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const sheetName = sanitizeFileName(equip.name).substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    } else {
      const rows = filteredFuel.map((log) => {
        const equip = equipment.find((e) => e.id === log.equipmentId);
        return {
          Date: log.date,
          Equipment: equip?.name || 'Unknown',
          'Fuel Type': getFuelTypeLabel(log.fuelType, log.customFuelTypeName),
          Gallons: log.gallons,
          'DEF Gallons': log.defGallons ?? 0,
          'Hours at Fill-up': log.hoursAtFillUp,
          'Filled By': log.filledByName || log.filledBy,
          Notes: log.notes || '',
        };
      });

      const totalGallons = filteredFuel.reduce((sum, l) => sum + l.gallons, 0);
      const totalDef = filteredFuel.reduce((sum, l) => sum + (l.defGallons ?? 0), 0);

      rows.push({
        Date: 'TOTALS',
        Equipment: '',
        'Fuel Type': '',
        Gallons: totalGallons,
        'DEF Gallons': totalDef,
        'Hours at Fill-up': 0,
        'Filled By': '',
        Notes: '',
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Fuel Logs');
    }

    const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const fileName = `FarmGuard_FuelExport_${formatDateForFileName(new Date())}.xlsx`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  } catch (error) {
    console.error('Error generating fuel Excel:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// ZIP creation
// ---------------------------------------------------------------------------

export async function createZipFromFiles(
  files: { name: string; uri: string }[],
): Promise<string> {
  try {
    const zip = new JSZip();

    for (const file of files) {
      const fileBase64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      zip.file(file.name, fileBase64, { base64: true });
    }

    const zipBase64 = await zip.generateAsync({ type: 'base64' });
    const zipFileName = `FarmGuard_Reports_${formatDateForFileName(new Date())}.zip`;
    const zipUri = `${FileSystem.cacheDirectory}${zipFileName}`;

    await FileSystem.writeAsStringAsync(zipUri, zipBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return zipUri;
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Sharing / email
// ---------------------------------------------------------------------------

export async function shareFile(
  fileUri: string,
  mimeType: string,
): Promise<void> {
  try {
    await Sharing.shareAsync(fileUri, { mimeType });
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
}

export async function emailFile(
  fileUri: string,
  fileName: string,
  subject: string,
): Promise<void> {
  try {
    const isAvailable = await MailComposer.isAvailableAsync();

    if (isAvailable) {
      await MailComposer.composeAsync({
        subject,
        body: 'Please find the attached FarmGuard maintenance report.',
        attachments: [fileUri],
      });
    } else {
      const mimeType = fileName.endsWith('.pdf')
        ? 'application/pdf'
        : fileName.endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/zip';
      await shareFile(fileUri, mimeType);
    }
  } catch (error) {
    console.error('Error emailing file:', error);
    throw error;
  }
}
