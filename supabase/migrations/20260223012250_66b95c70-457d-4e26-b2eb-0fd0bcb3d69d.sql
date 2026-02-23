-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tecnico';

-- Create empresas table
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  matriz_id UUID REFERENCES public.empresas(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- RLS: all authenticated can read empresas
CREATE POLICY "Auth read empresas" ON public.empresas
FOR SELECT TO authenticated
USING (true);

-- RLS: admin can manage empresas
CREATE POLICY "Admin manage empresas" ON public.empresas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add empresa_id to colaboradores
ALTER TABLE public.colaboradores
ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);

-- Add empresa_id to produtos
ALTER TABLE public.produtos
ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);

-- Add empresa_id to entregas_epi
ALTER TABLE public.entregas_epi
ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);

-- Add empresa_id to movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque
ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);

-- User-empresa link table (which empresas a user can access)
CREATE TABLE public.user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  UNIQUE(user_id, empresa_id)
);

ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own empresas" ON public.user_empresas
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin manage user_empresas" ON public.user_empresas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert the 7 companies
-- First the matrices
INSERT INTO public.empresas (id, nome) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Revalle Juazeiro'),
  ('a1000000-0000-0000-0000-000000000003', 'Revalle Petrolina'),
  ('a1000000-0000-0000-0000-000000000004', 'Revalle Ribeira do Pombal'),
  ('a1000000-0000-0000-0000-000000000006', 'Revalle Alagoinhas');

-- Then the filials
INSERT INTO public.empresas (id, nome, matriz_id) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Revalle Bonfim', 'a1000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000005', 'Revalle Paulo Afonso', 'a1000000-0000-0000-0000-000000000004'),
  ('a1000000-0000-0000-0000-000000000007', 'Revalle Serrinha', 'a1000000-0000-0000-0000-000000000006');

-- Security definer function to check user empresa access
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(_user_id UUID, _empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'admin') 
    OR EXISTS (
      SELECT 1 FROM public.user_empresas 
      WHERE user_id = _user_id AND empresa_id = _empresa_id
    )
$$;