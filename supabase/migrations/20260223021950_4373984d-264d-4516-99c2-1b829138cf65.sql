
-- Add user_id to colaboradores to link to auth.users
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_user_id_unique ON public.colaboradores(user_id) WHERE user_id IS NOT NULL;

-- Create solicitacoes_epi table
CREATE TABLE IF NOT EXISTS public.solicitacoes_epi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
  empresa_id uuid REFERENCES public.empresas(id),
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  quantidade integer NOT NULL DEFAULT 1,
  motivo text NOT NULL DEFAULT 'Solicitação',
  observacao text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'entregue')),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  motivo_rejeicao text,
  assinatura_base64 text,
  declaracao_aceita boolean NOT NULL DEFAULT false,
  ip_origem text,
  user_agent text,
  pdf_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.solicitacoes_epi ENABLE ROW LEVEL SECURITY;

-- Colaborador can read own solicitations
CREATE POLICY "Colaborador read own solicitacoes"
ON public.solicitacoes_epi FOR SELECT
USING (
  colaborador_id IN (SELECT id FROM public.colaboradores WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'almoxarifado')
);

-- Colaborador can insert own solicitations
CREATE POLICY "Colaborador insert own solicitacoes"
ON public.solicitacoes_epi FOR INSERT
WITH CHECK (
  colaborador_id IN (SELECT id FROM public.colaboradores WHERE user_id = auth.uid())
);

-- Admin/almox can update (approve/reject)
CREATE POLICY "Admin almox update solicitacoes"
ON public.solicitacoes_epi FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarifado')
);

-- Colaborador can read own colaborador record
CREATE POLICY "Colaborador read own record"
ON public.colaboradores FOR SELECT
USING (user_id = auth.uid());

-- Allow colaborador to read produtos
CREATE POLICY "Colaborador read produtos"
ON public.produtos FOR SELECT
USING (has_role(auth.uid(), 'colaborador'));
