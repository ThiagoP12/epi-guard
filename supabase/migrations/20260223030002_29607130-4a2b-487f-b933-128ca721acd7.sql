
CREATE TABLE public.setores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage setores" ON public.setores FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth read setores" ON public.setores FOR SELECT USING (true);
