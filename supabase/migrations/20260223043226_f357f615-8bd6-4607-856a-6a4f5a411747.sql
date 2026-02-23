
ALTER TABLE public.solicitacoes_epi
  ADD COLUMN IF NOT EXISTS geo_latitude double precision,
  ADD COLUMN IF NOT EXISTS geo_longitude double precision,
  ADD COLUMN IF NOT EXISTS geo_accuracy double precision,
  ADD COLUMN IF NOT EXISTS assinado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cpf_colaborador text,
  ADD COLUMN IF NOT EXISTS email_colaborador text;

ALTER TABLE public.entregas_epi
  ADD COLUMN IF NOT EXISTS geo_latitude double precision,
  ADD COLUMN IF NOT EXISTS geo_longitude double precision,
  ADD COLUMN IF NOT EXISTS geo_accuracy double precision;
