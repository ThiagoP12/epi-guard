

## Plan: Solicitações List Columns, Approval Details & Audit Trail

### 1. Database Migration — Create audit log table

Create `audit_logs` table:
- `id` uuid PK
- `evento` text NOT NULL (e.g. 'SOLICITACAO_APROVADA', 'SOLICITACAO_REPROVADA')
- `solicitacao_id` uuid
- `usuario_id` uuid
- `unidade_id` uuid (empresa_id)
- `data_hora` timestamptz default now()
- `detalhes` jsonb (optional extra data)
- `empresa_id` uuid

RLS: read/insert for admin/almoxarifado with empresa access, super_admin full access.

### 2. Update `Solicitacoes.tsx` — Enrich data & update list

**Data loading changes:**
- Fetch `empresas` names for each `empresa_id` to show "Unidade (revenda)"
- Fetch `profiles` names for each `aprovado_por` to show approver name
- Add `aprovado_por`, `aprovado_em`, `observacao_aprovacao` to the Solicitacao interface

**List view — add columns to each card:**
- Show short ID (`#XXXXXXXX`)
- Show Unidade (empresa name)
- Show "Aprovado por: Nome" or "—"
- Show "Data aprovação" if exists

**Detail dialog — add "Aprovação" block:**
- New section between Item info and Audit info
- Shows: Status (Aprovada/Reprovada), Usuário aprovador (name), Data/hora, Observação

### 3. Write audit log on approve/reject

In `handleApprove` and `handleReject`, insert into `audit_logs`:
```
{ evento: 'SOLICITACAO_APROVADA', solicitacao_id, usuario_id, unidade_id: empresa_id, data_hora }
```

Same pattern for status transitions (EM_SEPARACAO, BAIXADA_NO_ESTOQUE, ENTREGUE, CONFIRMADA).

### 4. Update `Auditoria.tsx`

Add ability to show `audit_logs` entries alongside `movimentacoes_estoque`, or add a tab/filter for solicitation audit events.

### Files affected
- New migration: `audit_logs` table + RLS
- `src/pages/Solicitacoes.tsx` — enriched data, list layout, detail approval block, audit log inserts
- `src/pages/Auditoria.tsx` — optionally show audit_logs

