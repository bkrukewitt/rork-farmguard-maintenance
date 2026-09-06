import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

export function isExcelFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase().split('?')[0];
  return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm');
}

function workbookFirstSheetToCsv(workbook: XLSX.WorkBook): string {
  if (!workbook.SheetNames.length) {
    throw new Error('The spreadsheet has no sheets');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error('Could not read the first sheet');
  }
  const csv = XLSX.utils.sheet_to_csv(sheet);
  if (!csv || !csv.trim()) {
    throw new Error('The spreadsheet appears to be empty');
  }
  return csv.replace(/^\uFEFF/, '');
}

function parseExcelBase64(base64: string): string {
  const workbook = XLSX.read(base64, { type: 'base64', cellDates: true });
  return workbookFirstSheetToCsv(workbook);
}

function parseExcelArrayBuffer(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbookFirstSheetToCsv(workbook);
}

async function readUriAsText(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  const content = await response.text();
  if (!content || !content.trim()) {
    throw new Error('File is empty (0 bytes)');
  }
  return content.replace(/^\uFEFF/, '');
}

async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    return response.arrayBuffer();
  }

  // Native: prefer FileSystem base64 for local file:// / content:// URIs
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) {
      throw new Error('File is empty (0 bytes)');
    }
    // Convert via XLSX path in caller using base64 when possible
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    return response.arrayBuffer();
  }
}

/**
 * Reads a CSV or Excel file and returns CSV text for the existing parsers.
 * Excel is converted from the first sheet via SheetJS; CSV helpers stay unchanged.
 */
export async function readSpreadsheetAsCsv(uri: string, fileName: string): Promise<string> {
  if (isExcelFileName(fileName)) {
    if (Platform.OS !== 'web') {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64) {
          throw new Error('File is empty (0 bytes)');
        }
        return parseExcelBase64(base64);
      } catch (fsError) {
        console.log('FileSystem Excel read failed, trying fetch:', fsError);
        const buffer = await readUriAsArrayBuffer(uri);
        return parseExcelArrayBuffer(buffer);
      }
    }

    const buffer = await readUriAsArrayBuffer(uri);
    return parseExcelArrayBuffer(buffer);
  }

  return readUriAsText(uri);
}

/**
 * Reads spreadsheet bytes from a Dropbox (or other) HTTP response into CSV text.
 */
export async function responseToCsv(response: Response, fileName: string): Promise<string> {
  if (isExcelFileName(fileName)) {
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) {
      throw new Error('The file appears to be empty');
    }
    return parseExcelArrayBuffer(buffer);
  }

  const content = await response.text();
  if (!content || !content.trim()) {
    throw new Error('The file appears to be empty');
  }
  return content.replace(/^\uFEFF/, '');
}
