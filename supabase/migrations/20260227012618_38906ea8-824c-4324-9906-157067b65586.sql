
-- Drop old constraint first
ALTER TABLE solicitacoes_epi DROP CONSTRAINT IF EXISTS solicitacoes_epi_status_check;

-- Migrate data while no constraint exists
UPDATE solicitacoes_epi SET status = 'ENVIADA' WHERE status = 'pendente';
UPDATE solicitacoes_epi SET status = 'APROVADA' WHERE status = 'aprovado';
UPDATE solicitacoes_epi SET status = 'REPROVADA' WHERE status = 'rejeitado';
UPDATE solicitacoes_epi SET status = 'ENTREGUE' WHERE status = 'entregue';

-- Add new constraint
ALTER TABLE solicitacoes_epi ADD CONSTRAINT solicitacoes_epi_status_check 
  CHECK (status = ANY (ARRAY['CRIADA','ENVIADA','APROVADA','REPROVADA','EM_SEPARACAO','BAIXADA_NO_ESTOQUE','ENTREGUE','CONFIRMADA']));

-- Change default
ALTER TABLE solicitacoes_epi ALTER COLUMN status SET DEFAULT 'ENVIADA';

-- Add new columns (idempotent)
ALTER TABLE solicitacoes_epi ADD COLUMN IF NOT EXISTS criado_por_usuario_id uuid;
ALTER TABLE solicitacoes_epi ADD COLUMN IF NOT EXISTS observacao_aprovacao text;
