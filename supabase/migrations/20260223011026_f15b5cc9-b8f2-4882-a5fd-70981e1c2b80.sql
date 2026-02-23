-- Create storage bucket for NR-06 PDF terms
INSERT INTO storage.buckets (id, name, public)
VALUES ('termos-nr06', 'termos-nr06', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can read their own files
CREATE POLICY "Auth users read termos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'termos-nr06');

-- RLS: service role (edge functions) can insert
CREATE POLICY "Service insert termos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'termos-nr06');

-- Add column to entregas_epi for PDF storage path
ALTER TABLE public.entregas_epi
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;