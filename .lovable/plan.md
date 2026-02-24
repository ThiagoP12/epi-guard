
## Menu Lateral Fixo

### Problema
Quando a lista de itens do menu e muito grande, a area do perfil/sair/dark mode vai para baixo e sai da tela visivel, porque todo o sidebar rola junto.

### Solucao
Tornar o sidebar fixo com altura total da tela, onde apenas a area de navegacao (links do menu) rola, enquanto o rodape com perfil/sair/dark mode fica sempre visivel na parte inferior.

### Detalhes Tecnicos

**Arquivo:** `src/components/Layout.tsx`

1. **Sidebar (`<aside>`)** - Adicionar `h-[calc(100vh-2.75rem)] sm:h-[calc(100vh-3.5rem)]` para ocupar a altura restante abaixo do header, e garantir `flex flex-col` (ja existe).

2. **Nav** - Ja tem `flex-1` e `overflow-y-auto`, o que esta correto. O problema e que o sidebar nao tem altura fixa definida, entao o flex nao funciona corretamente.

3. **Footer do usuario** - Ja tem `border-t` e esta fora do nav, entao com a altura fixa do sidebar ele ficara sempre visivel no fundo.

Essencialmente, a unica mudanca e adicionar a altura calculada no `<aside>` para que o flexbox funcione corretamente e mantenha o footer fixo na parte inferior.
