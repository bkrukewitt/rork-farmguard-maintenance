import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export const ATTACHMENTS_BUCKET = 'farm-attachments';

function getMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

async function ensureAttachmentsBucketExists(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === ATTACHMENTS_BUCKET);
    if (!exists) {
      console.log('[AttachmentUpload] Creating bucket:', ATTACHMENTS_BUCKET);
      const { error } = await supabase.storage.createBucket(ATTACHMENTS_BUCKET, {
        public: true,
        // Allow common doc/image types; can be expanded in Supabase UI if needed
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
          'text/plain',
        ],
        fileSizeLimit: 20 * 1024 * 1024, // 20MB
      });
      if (error) {
        console.error('[AttachmentUpload] Error creating bucket:', error.message);
        // If bucket already exists, ignore; otherwise surface as non-fatal
        if (!error.message.includes('already exists')) {
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    console.error('[AttachmentUpload] Error checking bucket:', error);
    // Fail open so attachments still work locally even if bucket check fails
    return true;
  }
}

async function uploadFromNative(localUri: string, remotePath: string, mimeType: string): Promise<string> {
  console.log('[AttachmentUpload] Reading file as base64:', localUri);
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 string to Uint8Array
  const byteCharacters = global.atob ? global.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  console.log('[AttachmentUpload] Uploading to Supabase Storage:', remotePath);
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(remotePath, byteArray, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error('[AttachmentUpload] Upload error:', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  console.log('[AttachmentUpload] Upload success:', data.path);
  return data.path;
}

async function uploadFromWeb(localUri: string, remotePath: string, mimeType: string): Promise<string> {
  console.log('[AttachmentUpload] Fetching blob from URI:', localUri);
  const response = await fetch(localUri);
  const blob = await response.blob();

  const contentType = blob.type || mimeType;

  console.log('[AttachmentUpload] Uploading blob to Supabase Storage:', remotePath);
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(remotePath, blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[AttachmentUpload] Upload error:', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  console.log('[AttachmentUpload] Upload success:', data.path);
  return data.path;
}

export async function uploadAttachment(localUri: string, remotePath: string, fileName: string): Promise<string> {
  console.log('[AttachmentUpload] Starting upload for:', localUri, '->', remotePath);

  if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
    console.log('[AttachmentUpload] Already a remote URL, skipping upload');
    return remotePath;
  }

  await ensureAttachmentsBucketExists();

  const mimeType = getMimeType(fileName);

  let path: string;
  if (Platform.OS === 'web') {
    path = await uploadFromWeb(localUri, remotePath, mimeType);
  } else {
    path = await uploadFromNative(localUri, remotePath, mimeType);
  }

  return path;
}

export function getAttachmentPublicUrl(path: string): string {
  const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Remove an object from `farm-attachments` by its storage path (e.g. farmId/equipment/...). */
export async function deleteAttachmentFromStorage(remotePath: string | undefined | null): Promise<void> {
  if (!remotePath) return;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([remotePath]);
  if (error) {
    console.error('[AttachmentUpload] Storage delete failed:', remotePath, error.message);
  }
}

