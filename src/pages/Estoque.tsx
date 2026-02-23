import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Minus, PackageOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEmpresa } from '@/contexts/EmpresaContext';

interface ProdutoComSaldo {
  id: string;
  codigo_interno: string;
  nome: string;
  tipo: string;
  ca: string | null;
  tamanho: string | null;
  estoque_minimo: number;
  data_validade: string | null;
  saldo: number;
  marca: string | null;
  fornecedor: string | null;
  localizacao_fisica: string | null;
  custo_unitario: number;
  ativo: boolean;
}

function getStatus(p: ProdutoComSaldo): { status: 'ok' | 'warning' | 'danger'; label: string } {
  if (p.saldo < p.estoque_minimo) return { status: 'danger', label: 'Abaixo do mínimo' };
  if (p.data_validade) {
    const dias = Math.ceil((new Date(p.data_validade).getTime() - Date.now()) / 86400000);
    if (dias < 0) return { status: 'danger', label: 'Vencido' };
    if (dias <= 30) return { status: 'warning', label: `Vence em ${dias}d` };
  }
  return { status: 'ok', label: 'Normal' };
}

export default function Estoque() {
  const [produtos, setProdutos] = useState<ProdutoComSaldo[]>([]);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'entrada' | 'saida' | 'editar'>('entrada');
  const [selected, setSelected] = useState<ProdutoComSaldo | null>(null);
  const [qty, setQty] = useState(1);
  const [nf, setNf] = useState('');
  const [obs, setObs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();

  const loadProdutos = async () => {
    setLoading(true);
    let query = supabase.from('produtos').select('*').eq('ativo', true).order('codigo_interno');
    if (selectedEmpresa) {
      query = query.eq('empresa_id', selectedEmpresa.id);
    }
    const { data } = await query;
    if (!data) { setLoading(false); return; }

    const withSaldo: ProdutoComSaldo[] = [];
    for (const p of data) {
      const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
      withSaldo.push({ ...p, saldo: typeof saldo === 'number' ? saldo : 0 });
    }
    setProdutos(withSaldo);
    setLoading(false);
  };

  useEffect(() => { loadProdutos(); }, [selectedEmpresa]);

  const filtered = produtos.filter((p) => {
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

  const openModal = (type: 'entrada' | 'saida' | 'editar', product: ProdutoComSaldo) => {
    setModalType(type);
    setSelected(product);
    setQty(1);
    setNf('');
    setObs('');
    setModalOpen(true);
  };

  const handleMovimentacao = async () => {
    if (!selected || !user || qty < 1) return;
    if (modalType === 'saida' && qty > selected.saldo) {
      toast({ title: 'Erro', description: 'Saldo insuficiente.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from('movimentacoes_estoque').insert({
      produto_id: selected.id,
      tipo_movimentacao: modalType === 'entrada' ? 'ENTRADA' : 'SAIDA',
      quantidade: qty,
      motivo: modalType === 'entrada' ? 'Entrada manual' : 'Saída manual',
      usuario_id: user.id,
      referencia_nf: nf || null,
      observacao: obs || null,
      empresa_id: selectedEmpresa?.id || null,
    });

    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: `${modalType === 'entrada' ? 'Entrada' : 'Saída'} registrada.` });
      setModalOpen(false);
      loadProdutos();
    }
  };

  const stats = {
    total: produtos.length,
    baixo: produtos.filter(p => getStatus(p).status === 'danger').length,
    normal: produtos.filter(p => getStatus(p).status === 'ok').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Estoque</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.total} produtos • <span className="text-status-ok">{stats.normal} normal</span>
            {stats.baixo > 0 && <span className="text-status-danger"> • {stats.baixo} crítico</span>}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou CA..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-32 h-9"><Filter size={13} className="mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="EPI">EPI</SelectItem>
              <SelectItem value="EPC">EPC</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="baixo">Abaixo do mínimo</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">CA</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Tamanho</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Qtde</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Mínimo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className={`px-4 py-3.5 ${j > 4 && j < 7 ? 'hidden sm:table-cell' : ''} ${j === 4 ? 'hidden lg:table-cell' : ''} ${j === 3 ? 'hidden md:table-cell' : ''}`}>
                        <div className={`h-4 rounded skeleton-shimmer ${j === 1 ? 'w-28' : 'w-16'}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.map((p) => {
                const st = getStatus(p);
                return (
                  <tr key={p.id} className="table-row-hover group">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.codigo_interno}</td>
                    <td className="px-4 py-3 font-medium">{p.nome}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-[10px] font-semibold uppercase bg-muted px-2 py-0.5 rounded-full tracking-wide">{p.tipo}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{p.ca || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{p.tamanho || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-bold tabular-nums", st.status === 'danger' ? 'text-status-danger' : '')}>
                        {p.saldo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground text-xs">{p.estoque_minimo}</td>
                    <td className="px-4 py-3"><StatusBadge status={st.status} label={st.label} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-status-ok hover:text-status-ok" onClick={() => openModal('entrada', p)}>
                          <Plus size={13} className="mr-0.5" /> Entrada
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-status-danger hover:text-status-danger" onClick={() => openModal('saida', p)}>
                          <Minus size={13} className="mr-0.5" /> Saída
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <PackageOpen size={36} className="mx-auto text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros.</p>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalType === 'entrada' ? '📦 Entrada de Estoque' : '📤 Saída de Estoque'}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{selected.nome}</p>
                  <p className="text-xs text-muted-foreground">{selected.codigo_interno} • Saldo atual: <span className="font-semibold">{selected.saldo}</span></p>
                </div>
              </div>
              <div>
                <Label className="text-xs">Quantidade *</Label>
                <Input type="number" min={1} max={modalType === 'saida' ? selected.saldo : undefined} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 h-9" />
              </div>
              {modalType === 'entrada' && (
                <div>
                  <Label className="text-xs">Referência NF</Label>
                  <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Nº da nota fiscal" className="mt-1 h-9" />
                </div>
              )}
              <div>
                <Label className="text-xs">Observação</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="mt-1" rows={2} />
              </div>
              <Button className="w-full h-9 font-medium" onClick={handleMovimentacao} disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Registrando...
                  </span>
                ) : 'Confirmar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
