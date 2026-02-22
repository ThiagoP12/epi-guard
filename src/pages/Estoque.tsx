import { useState } from 'react';
import { Search, Filter, Plus, Minus, Edit } from 'lucide-react';
import { produtos, type Produto } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function getStatus(p: Produto): { status: 'ok' | 'warning' | 'danger'; label: string } {
  if (p.saldo < p.estoque_minimo) return { status: 'danger', label: 'Abaixo do mínimo' };
  if (p.data_validade) {
    const dias = Math.ceil((new Date(p.data_validade).getTime() - Date.now()) / 86400000);
    if (dias < 0) return { status: 'danger', label: 'Vencido' };
    if (dias <= 30) return { status: 'warning', label: `Vence em ${dias}d` };
  }
  return { status: 'ok', label: 'Normal' };
}

export default function Estoque() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'entrada' | 'saida' | 'editar'>('entrada');
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);

  const filtered = produtos.filter((p) => {
    if (!p.ativo) return false;
    const s = search.toLowerCase();
    if (s && !p.nome.toLowerCase().includes(s) && !p.codigo_interno.toLowerCase().includes(s) && !(p.ca || '').toLowerCase().includes(s)) return false;
    if (tipoFilter !== 'todos' && p.tipo !== tipoFilter) return false;
    if (statusFilter !== 'todos') {
      const st = getStatus(p);
      if (statusFilter === 'baixo' && st.status !== 'danger') return false;
      if (statusFilter === 'vencendo' && st.status !== 'warning') return false;
      if (statusFilter === 'normal' && st.status !== 'ok') return false;
    }
    return true;
  });

  const openModal = (type: 'entrada' | 'saida' | 'editar', product: Produto) => {
    setModalType(type);
    setSelectedProduct(product);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-foreground">Estoque</h1>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou CA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <Filter size={14} className="mr-1" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="EPI">EPI</SelectItem>
              <SelectItem value="EPC">EPC</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="baixo">Abaixo do mínimo</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Código</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">CA</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Tamanho</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qtde</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Mínimo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const st = getStatus(p);
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{p.codigo_interno}</td>
                    <td className="px-4 py-3 font-medium">{p.nome}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{p.tipo}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.ca || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{p.tamanho}</td>
                    <td className="px-4 py-3 text-right font-medium">{p.saldo}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">{p.estoque_minimo}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={st.status} label={st.label} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openModal('editar', p)}>
                          <Edit size={13} className="mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-status-ok" onClick={() => openModal('entrada', p)}>
                          <Plus size={13} className="mr-1" /> Entrada
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-status-danger" onClick={() => openModal('saida', p)}>
                          <Minus size={13} className="mr-1" /> Saída
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Nenhum produto encontrado.</div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalType === 'entrada' && 'Entrada de Estoque'}
              {modalType === 'saida' && 'Saída de Estoque'}
              {modalType === 'editar' && 'Editar Produto'}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedProduct.nome} ({selectedProduct.codigo_interno})
              </p>
              {modalType !== 'editar' ? (
                <>
                  <div>
                    <Label>Quantidade</Label>
                    <Input type="number" min={1} defaultValue={1} className="mt-1" />
                  </div>
                  {modalType === 'entrada' && (
                    <div>
                      <Label>Referência NF</Label>
                      <Input placeholder="Nº da nota fiscal" className="mt-1" />
                    </div>
                  )}
                  <div>
                    <Label>Observação</Label>
                    <Textarea placeholder="Observação (opcional)" className="mt-1" rows={2} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Nome</Label>
                    <Input defaultValue={selectedProduct.nome} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CA</Label>
                      <Input defaultValue={selectedProduct.ca || ''} className="mt-1" />
                    </div>
                    <div>
                      <Label>Estoque Mínimo</Label>
                      <Input type="number" defaultValue={selectedProduct.estoque_minimo} className="mt-1" />
                    </div>
                  </div>
                </>
              )}
              <Button className="w-full">
                {modalType === 'editar' ? 'Salvar' : 'Confirmar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
