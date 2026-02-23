
-- 1. Add super_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Add aprovado column to empresas (existing empresas default to true)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;
UPDATE public.empresas SET aprovado = true WHERE aprovado = false;
