import { Platform } from 'react-native';

let FileSystemModule: typeof import('expo-file-system') | null = null;

async function getFileSystem() {
  if (!FileSystemModule) {
    FileSystemModule = await import('expo-file-system');
  }
  return FileSystemModule;
}

export const documentDirectory = Platform.OS !== 'web'
  ? (() => {
      try {
        const fs = require('expo-file-system');
        return fs.documentDirectory ?? '';
      } catch {
        return '';
      }
    })()
  : '';

export async function writeAsStringAsync(uri: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('writeAsStringAsync not fully supported on web');
    return;
  }
  const fs = await getFileSystem();
  await (fs as any).writeAsStringAsync(uri, content, {
    encoding: 'utf8',
  });
}

export async function readAsStringAsync(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    console.log('readAsStringAsync not fully supported on web');
    return '';
  }
  const fs = await getFileSystem();
  return (fs as any).readAsStringAsync(uri, {
    encoding: 'utf8',
  });
}

export async function getInfoAsync(uri: string): Promise<{ exists: boolean; uri?: string; size?: number }> {
  if (Platform.OS === 'web') {
    return { exists: false };
  }
  try {
    const fs = await getFileSystem();
    const info = await fs.getInfoAsync(uri);
    return { exists: info.exists, uri: info.uri, size: info.exists ? info.size : undefined };
  } catch {
    return { exists: false };
  }
}

export async function makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const fs = await getFileSystem();
  await fs.makeDirectoryAsync(uri, { intermediates: options?.intermediates ?? false });
}

export async function copyAsync(options: { from: string; to: string }): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const fs = await getFileSystem();
  await fs.copyAsync(options);
}

export async function deleteAsync(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const fs = await getFileSystem();
    await fs.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.log('deleteAsync error:', e);
  }
}
