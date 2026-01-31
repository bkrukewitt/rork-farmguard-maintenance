import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface ErrorLogEntry {
  timestamp: string;
  platform: string;
  error: string;
  context?: string;
  stack?: string;
  additionalData?: Record<string, any>;
}

const ERROR_LOG_KEY = 'farmguard_error_logs';
const MAX_LOG_ENTRIES = 1000; // Keep last 1000 entries

export async function logError(
  error: Error | string,
  context?: string,
  additionalData?: Record<string, any>
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      error: errorMessage,
      context,
      stack: errorStack,
      additionalData,
    };

    const existingLogs = await getErrorLogs();
    const updatedLogs = [logEntry, ...existingLogs].slice(0, MAX_LOG_ENTRIES);
    
    await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
  } catch (storageError) {
    // If we can't log, at least log to console
    console.error('Failed to save error log:', storageError);
    console.error('Original error:', error);
  }
}

export async function getErrorLogs(): Promise<ErrorLogEntry[]> {
  try {
    const logsJson = await AsyncStorage.getItem(ERROR_LOG_KEY);
    if (!logsJson) {
      return [];
    }
    return JSON.parse(logsJson);
  } catch (error) {
    console.error('Failed to read error logs:', error);
    return [];
  }
}

export async function clearErrorLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ERROR_LOG_KEY);
  } catch (error) {
    console.error('Failed to clear error logs:', error);
  }
}

export function formatErrorLogsAsText(logs: ErrorLogEntry[]): string {
  if (logs.length === 0) {
    return 'No error logs found.';
  }

  let text = `FarmGuard Maintenance - Error Logs\n`;
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Total Entries: ${logs.length}\n`;
  text += `${'='.repeat(60)}\n\n`;

  logs.forEach((entry, index) => {
    text += `Entry ${index + 1}\n`;
    text += `${'-'.repeat(60)}\n`;
    text += `Timestamp: ${new Date(entry.timestamp).toLocaleString()}\n`;
    text += `Platform: ${entry.platform}\n`;
    if (entry.context) {
      text += `Context: ${entry.context}\n`;
    }
    text += `Error: ${entry.error}\n`;
    if (entry.stack) {
      text += `Stack Trace:\n${entry.stack}\n`;
    }
    if (entry.additionalData && Object.keys(entry.additionalData).length > 0) {
      text += `Additional Data:\n${JSON.stringify(entry.additionalData, null, 2)}\n`;
    }
    text += `\n`;
  });

  return text;
}
