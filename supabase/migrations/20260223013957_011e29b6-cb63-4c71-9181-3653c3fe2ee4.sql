
-- Table for EPC inspections
CREATE TABLE public.inspecoes_epc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id),
  data_inspecao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  proxima_inspecao DATE,
  status TEXT NOT NULL DEFAULT 'conforme' CHECK (status IN ('conforme', 'nao_conforme', 'manutencao', 'reprovado')),
  responsavel_id UUID NOT NULL,
  observacao TEXT,
  acoes_corretivas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inspecoes_epc ENABLE ROW LEVEL SECURITY;

-- RLS: admin and almoxarifado can manage
CREATE POLICY "Admin almox manage inspecoes"
  ON public.inspecoes_epc
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarifado'));

-- RLS: all authenticated can read
CREATE POLICY "Auth read inspecoes"
  ON public.inspecoes_epc
  FOR SELECT
  USING (true);
