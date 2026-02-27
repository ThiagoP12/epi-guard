
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento text NOT NULL,
  solicitacao_id uuid REFERENCES public.solicitacoes_epi(id),
  usuario_id uuid,
  unidade_id uuid REFERENCES public.empresas(id),
  empresa_id uuid REFERENCES public.empresas(id),
  data_hora timestamptz NOT NULL DEFAULT now(),
  detalhes jsonb
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin manage audit_logs"
  ON public.audit_logs FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin/almoxarifado read in own empresas
CREATE POLICY "Read audit_logs in own empresas"
  ON public.audit_logs FOR SELECT
  USING (
    user_has_empresa_access(auth.uid(), COALESCE(empresa_id, unidade_id))
  );

-- Admin/almoxarifado insert in own empresas
CREATE POLICY "Insert audit_logs in own empresas"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      user_has_empresa_access(auth.uid(), COALESCE(empresa_id, unidade_id))
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
    )
  );
