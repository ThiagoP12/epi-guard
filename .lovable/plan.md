

## Expansão do Fluxo de Status das Solicitações de EPI

### Resumo
Adicionar novos campos e expandir os status da tabela `solicitacoes_epi` para refletir o fluxo completo de aprovação com rastreabilidade do usuário aprovador.

### 1. Migração de Banco de Dados

Adicionar colunas faltantes à tabela `solicitacoes_epi`:
- `criado_por_usuario_id` (uuid, nullable) — quem criou a solicitação
- `observacao_aprovacao` (text, nullable) — observação ao aprovar/reprovar

**Nota:** `aprovado_por` e `aprovado_em` já existem. `unidade_id` mapeia para `empresa_id` que já existe.

Migrar os status existentes para os novos valores:
- `pendente` → `ENVIADA`
- `aprovado` → `APROVADA`
- `rejeitado` → `REPROVADA`
- `entregue` → `ENTREGUE`

### 2. Atualizar `src/pages/Solicitacoes.tsx`

- Atualizar `statusConfig` com todos os 8 status: `CRIADA`, `ENVIADA`, `APROVADA`, `REPROVADA`, `EM_SEPARACAO`, `BAIXADA_NO_ESTOQUE`, `ENTREGUE`, `CONFIRMADA`
- Atualizar filtros e contadores KPI para os novos status
- No `handleApprove`: gravar `observacao_aprovacao` junto com `aprovado_por` e `aprovado_em`, usar status `APROVADA`
- No `handleReject`: usar status `REPROVADA`
- No `handleDeliver`: usar status `ENTREGUE`
- Adicionar botões para transições intermediárias (EM_SEPARACAO, BAIXADA_NO_ESTOQUE, CONFIRMADA)
- Mostrar nome do aprovador nos detalhes (buscar da tabela `profiles`)
- Adicionar campo `observacao_aprovacao` no dialog de aprovação

### 3. Atualizar `src/pages/PortalColaborador.tsx`

- Atualizar `statusConfig` com os novos status
- Ajustar filtros de histórico e recebimentos para os novos valores
- Atualizar contadores (pendingCount usa `ENVIADA` em vez de `pendente`)

### 4. Atualizar `src/components/ComprovanteSolicitacao.tsx`

- Atualizar mapeamento `statusLabel` para os novos valores

### 5. Atualizar `src/pages/Dashboard.tsx`

- Ajustar queries que filtram por status antigos para usar os novos valores

### Detalhes Técnicos

**SQL de migração:**
```sql
ALTER TABLE solicitacoes_epi 
  ADD COLUMN IF NOT EXISTS criado_por_usuario_id uuid,
  ADD COLUMN IF NOT EXISTS observacao_aprovacao text;

UPDATE solicitacoes_epi SET status = 'ENVIADA' WHERE status = 'pendente';
UPDATE solicitacoes_epi SET status = 'APROVADA' WHERE status = 'aprovado';
UPDATE solicitacoes_epi SET status = 'REPROVADA' WHERE status = 'rejeitado';
UPDATE solicitacoes_epi SET status = 'ENTREGUE' WHERE status = 'entregue';
```

**Arquivos afetados:**
- `src/pages/Solicitacoes.tsx` — principal, fluxo de aprovação
- `src/pages/PortalColaborador.tsx` — visualização do colaborador
- `src/components/ComprovanteSolicitacao.tsx` — labels de status
- `src/pages/Dashboard.tsx` — contadores e filtros

