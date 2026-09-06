import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { CONSUMABLE_CATEGORIES, EQUIPMENT_TYPES } from '@/types/equipment';
import {
  CSV_TEMPLATE_HEADERS,
  CSV_TEMPLATE_EXAMPLE_ROWS,
  EQUIPMENT_CSV_HEADERS,
  EQUIPMENT_CSV_EXAMPLE_ROWS,
} from '@/utils/csvHelpers';

const TEMPLATE_DATA_ROWS = 500;

export interface ListValidationSpec {
  /** Excel range like "C2:C501" */
  sqref: string;
  options: string[];
  errorTitle: string;
  error: string;
  promptTitle?: string;
  prompt?: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDataValidationsXml(validations: ListValidationSpec[]): string {
  const items = validations
    .map((v) => {
      const listFormula = escapeXml(`"${v.options.join(',')}"`);
      const promptAttrs =
        v.promptTitle && v.prompt
          ? ` showInputMessage="1" promptTitle="${escapeXml(v.promptTitle)}" prompt="${escapeXml(v.prompt)}"`
          : '';
      return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="${escapeXml(v.errorTitle)}" error="${escapeXml(v.error)}"${promptAttrs} sqref="${v.sqref}"><formula1>${listFormula}</formula1></dataValidation>`;
    })
    .join('');

  return `<dataValidations count="${validations.length}">${items}</dataValidations>`;
}

async function injectDataValidations(base64Xlsx: string, validations: ListValidationSpec[]): Promise<string> {
  const zip = await JSZip.loadAsync(base64Xlsx, { base64: true });
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('Could not find worksheet XML in generated workbook');
  }

  let xml = await sheetFile.async('string');
  const dvXml = buildDataValidationsXml(validations);

  if (/<dataValidations[\s>]/.test(xml)) {
    xml = xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, dvXml);
  } else if (xml.includes('</worksheet>')) {
    xml = xml.replace('</worksheet>', `${dvXml}</worksheet>`);
  } else {
    throw new Error('Unexpected worksheet XML structure');
  }

  zip.file(sheetPath, xml);
  return zip.generateAsync({ type: 'base64' });
}

function setColumnWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

async function buildTemplateBase64(
  sheetName: string,
  headers: string[],
  exampleRows: string[][],
  columnWidths: number[],
  validations: ListValidationSpec[]
): Promise<string> {
  const aoa: (string | number)[][] = [headers, ...exampleRows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setColumnWidths(ws, columnWidths);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  return injectDataValidations(base64, validations);
}

/** Category enum values for the parts template dropdown (matches example rows + parser). */
export function getPartsCategoryDropdownOptions(): string[] {
  return CONSUMABLE_CATEGORIES.map((c) => c.value);
}

/** Type enum values for the equipment template dropdown. */
export function getEquipmentTypeDropdownOptions(): string[] {
  return EQUIPMENT_TYPES.map((t) => t.value);
}

/**
 * Generates a parts import .xlsx (base64) with a Category dropdown.
 * CSV template helpers in csvHelpers.ts are left intact as a fallback.
 */
export async function generatePartsExcelTemplateBase64(): Promise<string> {
  const categoryCol = CSV_TEMPLATE_HEADERS.findIndex((h) => h === 'Category') + 1; // 1-based
  const colLetter = XLSX.utils.encode_col(categoryCol - 1);

  return buildTemplateBase64(
    'Parts',
    CSV_TEMPLATE_HEADERS,
    CSV_TEMPLATE_EXAMPLE_ROWS,
    [22, 14, 12, 14, 18, 10, 16, 28, 28],
    [
      {
        sqref: `${colLetter}2:${colLetter}${TEMPLATE_DATA_ROWS + 1}`,
        options: getPartsCategoryDropdownOptions(),
        errorTitle: 'Invalid Category',
        error: 'Please select a category from the dropdown list.',
        promptTitle: 'Category',
        prompt: 'Choose from the list of accepted categories.',
      },
    ]
  );
}

/**
 * Generates an equipment import .xlsx (base64) with a Type dropdown.
 * CSV template helpers in csvHelpers.ts are left intact as a fallback.
 */
export async function generateEquipmentExcelTemplateBase64(): Promise<string> {
  const typeCol = EQUIPMENT_CSV_HEADERS.findIndex((h) => h === 'Type') + 1;
  const colLetter = XLSX.utils.encode_col(typeCol - 1);

  return buildTemplateBase64(
    'Equipment',
    EQUIPMENT_CSV_HEADERS,
    EQUIPMENT_CSV_EXAMPLE_ROWS,
    [16, 12, 14, 12, 8, 16, 14, 12, 14, 28],
    [
      {
        sqref: `${colLetter}2:${colLetter}${TEMPLATE_DATA_ROWS + 1}`,
        options: getEquipmentTypeDropdownOptions(),
        errorTitle: 'Invalid Type',
        error: 'Please select an equipment type from the dropdown list.',
        promptTitle: 'Type',
        prompt: 'Choose from the list of accepted equipment types.',
      },
    ]
  );
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  // Explicit ArrayBuffer backing so the result is a valid BlobPart under newer TS libs.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
