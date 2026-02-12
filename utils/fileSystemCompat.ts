import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export const documentDirectory = FileSystem.documentDirectory ?? '';

export async function writeAsStringAsync(uri: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('writeAsStringAsync not fully supported on web');
    return;
  }
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function readAsStringAsync(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    console.log('readAsStringAsync not fully supported on web');
    return '';
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function getInfoAsync(uri: string): Promise<{ exists: boolean; uri?: string; size?: number }> {
  if (Platform.OS === 'web') {
    return { exists: false };
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return { exists: info.exists, uri: info.uri, size: info.exists ? info.size : undefined };
  } catch {
    return { exists: false };
  }
}

export async function makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await FileSystem.makeDirectoryAsync(uri, { intermediates: options?.intermediates ?? false });
}

export async function copyAsync(options: { from: string; to: string }): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await FileSystem.copyAsync(options);
}

export async function deleteAsync(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.log('deleteAsync error:', e);
  }
}
