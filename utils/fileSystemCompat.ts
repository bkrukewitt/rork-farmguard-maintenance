import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export const documentDirectory = Paths.document.uri;

export async function writeAsStringAsync(uri: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('writeAsStringAsync not fully supported on web');
    return;
  }
  const file = new File(uri);
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  file.write(content);
}

export async function readAsStringAsync(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    console.log('readAsStringAsync not fully supported on web');
    return '';
  }
  const file = new File(uri);
  return file.text();
}

export async function getInfoAsync(uri: string): Promise<{ exists: boolean; uri?: string; size?: number }> {
  if (Platform.OS === 'web') {
    return { exists: false };
  }
  try {
    const pathInfo = Paths.info(uri);
    if (pathInfo.isDirectory) {
      const dir = new Directory(uri);
      return { exists: dir.exists, uri };
    }
    const file = new File(uri);
    return { exists: file.exists, uri, size: file.exists ? file.size : undefined };
  } catch {
    return { exists: false };
  }
}

export async function makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const dir = new Directory(uri);
  if (!dir.exists) {
    dir.create({ intermediates: options?.intermediates ?? false, idempotent: true });
  }
}

export async function copyAsync(options: { from: string; to: string }): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const sourceFile = new File(options.from);
  const destFile = new File(options.to);
  sourceFile.copy(destFile);
}

export async function deleteAsync(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    try {
      const dir = new Directory(uri);
      if (dir.exists) {
        dir.delete();
      }
    } catch (e) {
      console.log('deleteAsync error:', e);
    }
  }
}
