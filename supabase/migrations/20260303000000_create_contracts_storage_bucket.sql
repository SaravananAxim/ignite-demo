-- Create contracts storage bucket for signed PDF storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload contracts
CREATE POLICY "Allow authenticated uploads to contracts bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Allow public read access (URLs sent via webhook need to be accessible)
CREATE POLICY "Allow public read access to contracts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contracts');

-- Allow authenticated users to update/overwrite contracts
CREATE POLICY "Allow authenticated updates to contracts bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contracts')
WITH CHECK (bucket_id = 'contracts');
