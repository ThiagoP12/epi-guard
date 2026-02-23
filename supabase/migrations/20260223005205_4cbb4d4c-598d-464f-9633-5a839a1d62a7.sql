
-- Create storage bucket for company logo
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa', 'empresa', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read company files
CREATE POLICY "Anyone can view company files"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresa');

-- Only admins can upload/update/delete company files
CREATE POLICY "Admins can upload company files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'empresa' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update company files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'empresa' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete company files"
ON storage.objects FOR DELETE
USING (bucket_id = 'empresa' AND public.has_role(auth.uid(), 'admin'));
