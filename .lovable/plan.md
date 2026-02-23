

## Ocultar solicitações entregues da aba "Minhas Solicitações"

### Problema
Quando uma solicitação é marcada como **"Entregue"**, ela continua aparecendo na aba **Minhas Solicitações**, mesmo já estando visível na aba **Recebimentos**. Isso causa duplicidade e confusão.

### Solução
Filtrar as solicitações com status `entregue` da aba "Minhas Solicitações", já que elas são exibidas na aba "Recebimentos".

### Detalhes Técnicos

**Arquivo:** `src/pages/PortalColaborador.tsx`

1. Na seção "Histórico" (linha ~538), filtrar as solicitações para excluir as com status `entregue`:
   - De: `solicitacoes.map(s => ...)`
   - Para: `solicitacoes.filter(s => s.status !== 'entregue').map(s => ...)`

2. Atualizar a verificação de lista vazia para considerar apenas solicitações não-entregues.

3. Atualizar o contador de "pendentes" no badge do histórico para refletir corretamente (já está correto pois só conta `pendente`).

4. Atualizar o `StatCard` de "Solicitações" para mostrar apenas as não-entregues, mantendo coerência visual.

Mudança simples e cirúrgica em um único arquivo.
