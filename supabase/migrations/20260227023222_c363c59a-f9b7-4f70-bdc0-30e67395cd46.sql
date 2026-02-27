-- Fix produtos: restrict read to user's linked empresas (was global)
DROP POLICY IF EXISTS "Read all produtos" ON public.produtos;

CREATE POLICY "Read produtos in own empresas"
  ON public.produtos
  FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR user_has_empresa_access(auth.uid(), empresa_id)
  );