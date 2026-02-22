import { useState } from 'react';
import { Search, ClipboardCheck, Camera } from 'lucide-react';
import { epcs } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusMap = {
  OK: { status: 'ok' as const, label: 'OK' },
  MANUTENCAO: { status: 'warning' as const, label: 'Manutenção' },
  VENCIDO: { status: 'danger' as const, label: 'Vencido' },
};

export default function ControleEPC() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEpc, setSelectedEpc] = useState<typeof epcs[0] | null>(null);

  const filtered = epcs.filter((e) => {
    if (!e.ativo) return false;
    const s = search.toLowerCase();
    return !s || e.nome.toLowerCase().includes(s) || e.local_instalacao.toLowerCase().includes(s);
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Controle de EPC</h1>

      <div className="bg-card rounded-lg border p-4 mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar EPC por nome ou local..."
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Local</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Última Inspeção</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Próxima</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((epc) => {
                const st = statusMap[epc.status];
                return (
                  <tr key={epc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{epc.nome}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{epc.local_instalacao}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{epc.ultima_inspecao}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{epc.proxima_inspecao}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => { setSelectedEpc(epc); setModalOpen(true); }}
                      >
                        <ClipboardCheck size={13} className="mr-1" /> Registrar Inspeção
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Inspeção</DialogTitle>
          </DialogHeader>
          {selectedEpc && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedEpc.nome}</p>
              <div>
                <Label>Status Resultante</Label>
                <Select defaultValue="OK">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                    <SelectItem value="VENCIDO">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea className="mt-1" rows={3} placeholder="Detalhes da inspeção..." />
              </div>
              <div>
                <Label>Foto/Anexo</Label>
                <div className="mt-1 border-2 border-dashed rounded-lg h-20 flex items-center justify-center text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors">
                  <Camera size={16} className="mr-2" /> Anexar foto
                </div>
              </div>
              <Button className="w-full">Salvar Inspeção</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
