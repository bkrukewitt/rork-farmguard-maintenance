-- =============================================================================
-- FarmGuard: Create farm-images storage bucket and policies
-- Run on the PRIMARY writable database as postgres (SQL Editor or direct URI).
-- Client apps cannot create buckets — supabase_storage_admin hits RLS on buckets.
-- =============================================================================

DO $$
BEGIN
  IF current_user = 'supabase_read_only_user' OR pg_is_in_recovery() THEN
    RAISE EXCEPTION
      'Read-only connection detected (user=%, replica=%). Restore project or connect via direct postgres URI.',
      current_user, pg_is_in_recovery();
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'farm-images',
  'farm-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "farm_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "farm_images_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "farm_images_public_update" ON storage.objects;
DROP POLICY IF EXISTS "farm_images_public_delete" ON storage.objects;

CREATE POLICY "farm_images_public_read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'farm-images' );

CREATE POLICY "farm_images_public_insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'farm-images' );

CREATE POLICY "farm_images_public_update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'farm-images' );

CREATE POLICY "farm_images_public_delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'farm-images' );

SELECT id, name, public FROM storage.buckets WHERE id IN ('farm-images', 'farm-attachments');
