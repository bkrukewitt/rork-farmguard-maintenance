import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';

const BUCKET_NAME = 'farm-images';

const FARM_IMAGES_PUBLIC_MARKER = '/object/public/farm-images/';

/** Extract storage object path from a Supabase public URL for `farm-images`, or null if not from this bucket. */
export function getFarmImagesStoragePathFromPublicUrl(url: string): string | null {
  const i = url.indexOf(FARM_IMAGES_PUBLIC_MARKER);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + FARM_IMAGES_PUBLIC_MARKER.length).split(/[?#]/)[0]);
}

/** Remove an object from `farm-images` when the app no longer references this public URL. */
export async function deleteFarmImageByPublicUrl(url: string | undefined | null): Promise<void> {
  const path = url ? getFarmImagesStoragePathFromPublicUrl(url) : null;
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) {
    console.error('[ImageUpload] Storage delete failed:', path, error.message);
  }
}

/**
 * True when the URI still points at device storage (or another non-remote source)
 * and should be uploaded to Supabase `farm-images` for cross-device access.
 */
export function isLocalImageUri(uri: string): boolean {
  const t = uri.trim().toLowerCase();
  if (!t || t.length < 4) return false;
  if (t.startsWith('http://') || t.startsWith('https://')) return false;
  if (t.startsWith('data:')) return false;
  return true;
}

function generateFileName(extension: string = 'jpg'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${random}.${extension}`;
}

async function ensureBucketExists(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    if (!exists) {
      console.log('[ImageUpload] Creating bucket:', BUCKET_NAME);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (error) {
        console.error('[ImageUpload] Error creating bucket:', error.message);
        if (!error.message.includes('already exists')) {
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    console.error('[ImageUpload] Error checking bucket:', error);
    return true;
  }
}

async function uploadFromNative(localUri: string, fileName: string): Promise<string> {
  console.log('[ImageUpload] Reading file as base64:', localUri);
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  const contentType = localUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  console.log('[ImageUpload] Uploading to Supabase Storage:', fileName);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, byteArray, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[ImageUpload] Upload error:', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  console.log('[ImageUpload] Upload success:', data.path);
  return data.path;
}

async function uploadFromWeb(localUri: string, fileName: string): Promise<string> {
  console.log('[ImageUpload] Fetching blob from URI:', localUri);
  const response = await fetch(localUri);
  const blob = await response.blob();

  const contentType = blob.type || 'image/jpeg';

  console.log('[ImageUpload] Uploading blob to Supabase Storage:', fileName);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[ImageUpload] Upload error:', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  console.log('[ImageUpload] Upload success:', data.path);
  return data.path;
}

export async function uploadImage(localUri: string): Promise<string> {
  console.log('[ImageUpload] Starting upload for:', localUri);

  if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
    console.log('[ImageUpload] Already a remote URL, skipping upload');
    return localUri;
  }

  await ensureBucketExists();

  const extension = localUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const fileName = generateFileName(extension);

  let path: string;
  if (Platform.OS === 'web') {
    path = await uploadFromWeb(localUri, fileName);
  } else {
    path = await uploadFromNative(localUri, fileName);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  console.log('[ImageUpload] Public URL:', urlData.publicUrl);
  return urlData.publicUrl;
}

export async function uploadMultipleImages(
  localUris: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const url = await uploadImage(localUris[i]);
    results.push(url);
    onProgress?.(i + 1, localUris.length);
  }
  return results;
}
