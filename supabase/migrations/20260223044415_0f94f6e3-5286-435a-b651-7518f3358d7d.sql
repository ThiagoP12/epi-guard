
-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Read produtos in own empresas" ON public.produtos;

-- Create new policy: any authenticated user can read all produtos
CREATE POLICY "Read all produtos"
  ON public.produtos
  FOR SELECT
  TO authenticated
  USING (true);
