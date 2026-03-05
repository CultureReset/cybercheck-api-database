-- ============================================================
-- Storage Policies for media bucket
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Public can read all media (images show on websites)
CREATE POLICY "public_read_media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- Authenticated users can upload files
CREATE POLICY "auth_insert_media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

-- Authenticated users can update their files
CREATE POLICY "auth_update_media" ON storage.objects
  FOR UPDATE USING (bucket_id = 'media' AND auth.role() = 'authenticated');

-- Authenticated users can delete their files
CREATE POLICY "auth_delete_media" ON storage.objects
  FOR DELETE USING (bucket_id = 'media' AND auth.role() = 'authenticated');
