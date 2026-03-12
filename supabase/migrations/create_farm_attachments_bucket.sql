-- =============================================================================
-- FarmGuard: Create farm-attachments storage bucket and policies
-- Run this in Supabase Dashboard → SQL Editor (or via Supabase CLI migration)
-- =============================================================================

-- 1. Create the storage bucket (if it doesn't exist)
--    Supabase uses id as the bucket identifier; name is the display name.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'farm-attachments',
  'farm-attachments',
  true,
  20971520,  -- 20 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'text/plain',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop existing policies for this bucket (so script is re-runnable)
DROP POLICY IF EXISTS "farm_attachments_public_read" ON storage.objects;
DROP POLICY IF EXISTS "farm_attachments_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "farm_attachments_public_update" ON storage.objects;
DROP POLICY IF EXISTS "farm_attachments_public_delete" ON storage.objects;

-- 3. Allow public read (required for getPublicUrl and for other farm devices)
CREATE POLICY "farm_attachments_public_read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'farm-attachments' );

-- 4. Allow insert so the app can upload new attachments (anon + authenticated)
CREATE POLICY "farm_attachments_public_insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'farm-attachments' );

-- 5. Allow update (e.g. upsert / replace file)
CREATE POLICY "farm_attachments_public_update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'farm-attachments' );

-- 6. Allow delete so users can remove attachments from equipment/logs
CREATE POLICY "farm_attachments_public_delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'farm-attachments' );
