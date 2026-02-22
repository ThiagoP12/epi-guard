import { useState } from 'react';
import { Search, ClipboardCheck, History } from 'lucide-react';
import { colaboradores } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const statusMap = {
  atualizado: { status: 'ok' as const, label: 'Atualizado' },
  atencao: { status: 'warning' as const, label: 'Atenção' },
  irregular: { status: 'danger' as const, label: 'Irregular' },
};

export default function Colaboradores() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = colaboradores.filter((c) => {
    if (!c.ativo) return false;
    const s = search.toLowerCase();
    return !s || c.nome.toLowerCase().includes(s) || c.matricula.toLowerCase().includes(s);
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Colaboradores</h1>

      <div className="bg-card rounded-lg border p-4 mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Matrícula</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Função</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status EPI</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => {
                const st = statusMap[c.status_epi];
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs">{c.matricula}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.setor}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{c.funcao}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => navigate(`/entrega-epi?colaborador=${c.id}`)}
                        >
                          <ClipboardCheck size={13} className="mr-1" /> Nova Entrega
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <History size={13} className="mr-1" /> Histórico
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
