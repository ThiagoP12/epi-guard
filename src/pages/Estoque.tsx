import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Minus, PackageOpen, Package, AlertTriangle, DollarSign, History, Settings2, ArrowUpDown, Eye, Users, Download, Power } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import SignatureCanvas from '@/components/SignatureCanvas';

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

interface Movimentacao {
  id: string;
  tipo_movimentacao: string;
  quantidade: number;
  motivo: string | null;
  observacao: string | null;
  referencia_nf: string | null;
  data_hora: string;
  ajuste_tipo: string | null;
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

const emptyProduct = {
  codigo_interno: '', nome: '', tipo: 'EPI' as string, ca: '', tamanho: '',
  estoque_minimo: 0, data_validade: '', marca: '', fornecedor: '',
  localizacao_fisica: '', custo_unitario: 0,
};

export default function Estoque() {
  const [produtos, setProdutos] = useState<ProdutoComSaldo[]>([]);
  const [search, setSearch] = useState('');
  const [showInativos, setShowInativos] = useState(false);
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Movement modal
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [movType, setMovType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [selected, setSelected] = useState<ProdutoComSaldo | null>(null);
  const [qty, setQty] = useState(1);
  const [nf, setNf] = useState('');
  const [obs, setObs] = useState('');
  const [ajusteTipo, setAjusteTipo] = useState<'AUMENTO' | 'REDUCAO'>('AUMENTO');
  const [colaboradorId, setColaboradorId] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; matricula: string }[]>([]);
  // Product CRUD modal
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodForm, setProdForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<ProdutoComSaldo | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProdutoComSaldo | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();
  const isAdmin = role === 'admin';

  // Load colaboradores for exit modal
  useEffect(() => {
    const loadColaboradores = async () => {
      let query = supabase.from('colaboradores').select('id, nome, matricula').eq('ativo', true).order('nome');
      if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);
      const { data } = await query;
      setColaboradores(data || []);
    };
    loadColaboradores();
  }, [selectedEmpresa]);

  const loadProdutos = async () => {
    setLoading(true);
    let query = supabase.from('produtos').select('*').order('codigo_interno');
    if (!showInativos) query = query.eq('ativo', true);
    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);
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

  useEffect(() => { loadProdutos(); }, [selectedEmpresa, showInativos]);

  const filtered = produtos.filter((p) => {
    const s = search.toLowerCase();
    if (s && !p.nome.toLowerCase().includes(s) && !p.codigo_interno.toLowerCase().includes(s) && !(p.ca || '').toLowerCase().includes(s) && !(p.marca || '').toLowerCase().includes(s)) return false;
    if (tipoFilter !== 'todos' && p.tipo !== tipoFilter) return false;
    if (statusFilter !== 'todos') {
      const st = getStatus(p);
      if (statusFilter === 'baixo' && st.status !== 'danger') return false;
      if (statusFilter === 'vencendo' && st.status !== 'warning') return false;
      if (statusFilter === 'normal' && st.status !== 'ok') return false;
    }
    return true;
  });

  // --- Movement ---
  const openMovModal = (type: 'entrada' | 'saida' | 'ajuste', product: ProdutoComSaldo) => {
    setMovType(type);
    setSelected(product);
    setQty(1);
    setNf('');
    setObs('');
    setAjusteTipo('AUMENTO');
    setColaboradorId('');
    setAssinatura(null);
    setMovModalOpen(true);
  };

  const handleMovimentacao = async () => {
    if (!selected || !user || qty < 1) return;
    if (movType === 'saida' && !colaboradorId) {
      toast({ title: 'Atenção', description: 'Selecione o colaborador para a saída.', variant: 'destructive' });
      return;
    }
    if (movType === 'saida' && !assinatura && !isAdmin) {
      toast({ title: 'Atenção', description: 'Assinatura do colaborador é obrigatória.', variant: 'destructive' });
      return;
    }
    if (movType === 'saida' && qty > selected.saldo) {
      toast({ title: 'Erro', description: 'Saldo insuficiente.', variant: 'destructive' });
      return;
    }
    if (movType === 'ajuste' && ajusteTipo === 'REDUCAO' && qty > selected.saldo) {
      toast({ title: 'Erro', description: 'Redução maior que o saldo.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    const insertData: any = {
      produto_id: selected.id,
      quantidade: qty,
      usuario_id: user.id,
      referencia_nf: nf || null,
      observacao: obs || null,
      empresa_id: selectedEmpresa?.id || null,
      colaborador_id: movType === 'saida' ? colaboradorId : null,
      assinatura_base64: movType === 'saida' ? assinatura : null,
    };

    if (movType === 'ajuste') {
      insertData.tipo_movimentacao = 'AJUSTE';
      insertData.ajuste_tipo = ajusteTipo;
      insertData.motivo = `Ajuste manual (${ajusteTipo === 'AUMENTO' ? 'aumento' : 'redução'})`;
    } else {
      insertData.tipo_movimentacao = movType === 'entrada' ? 'ENTRADA' : 'SAIDA';
      insertData.motivo = movType === 'entrada' ? 'Entrada manual' : 'Saída manual';
    }

    const { error } = await supabase.from('movimentacoes_estoque').insert(insertData);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const labels = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };
      toast({ title: 'Sucesso', description: `${labels[movType]} registrada.` });
      setMovModalOpen(false);
      loadProdutos();
    }
  };

  // --- Product CRUD ---
  const openAddProduct = () => {
    setEditingId(null);
    setProdForm(emptyProduct);
    setProdModalOpen(true);
  };

  const openEditProduct = (p: ProdutoComSaldo) => {
    setEditingId(p.id);
    setProdForm({
      codigo_interno: p.codigo_interno,
      nome: p.nome,
      tipo: p.tipo,
      ca: p.ca || '',
      tamanho: p.tamanho || '',
      estoque_minimo: p.estoque_minimo,
      data_validade: p.data_validade || '',
      marca: p.marca || '',
      fornecedor: p.fornecedor || '',
      localizacao_fisica: p.localizacao_fisica || '',
      custo_unitario: p.custo_unitario,
    });
    setProdModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!prodForm.nome || !prodForm.codigo_interno || !prodForm.tipo) {
      toast({ title: 'Atenção', description: 'Preencha nome, código e tipo.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    const payload = {
      codigo_interno: prodForm.codigo_interno,
      nome: prodForm.nome,
      tipo: prodForm.tipo as any,
      ca: prodForm.ca || null,
      tamanho: prodForm.tamanho || null,
      estoque_minimo: prodForm.estoque_minimo || 0,
      data_validade: prodForm.data_validade || null,
      marca: prodForm.marca || null,
      fornecedor: prodForm.fornecedor || null,
      localizacao_fisica: prodForm.localizacao_fisica || null,
      custo_unitario: prodForm.custo_unitario || 0,
      empresa_id: selectedEmpresa?.id || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('produtos').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('produtos').insert(payload));
    }

    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: editingId ? 'Produto atualizado.' : 'Produto cadastrado.' });
      setProdModalOpen(false);
      loadProdutos();
    }
  };

  // --- History ---
  const openHistory = async (product: ProdutoComSaldo) => {
    setHistoryProduct(product);
    setHistoryOpen(true);
    setLoadingHistory(true);
    const { data } = await supabase.from('movimentacoes_estoque')
      .select('id, tipo_movimentacao, quantidade, motivo, observacao, referencia_nf, data_hora, ajuste_tipo')
      .eq('produto_id', product.id)
      .order('data_hora', { ascending: false })
      .limit(50);
    setMovimentacoes((data || []) as Movimentacao[]);
    setLoadingHistory(false);
  };

  // --- Detail ---
  const openDetail = (product: ProdutoComSaldo) => {
    setDetailProduct(product);
    setDetailOpen(true);
  };

  // --- Stats ---
  const stats = {
    total: produtos.length,
    baixo: produtos.filter(p => getStatus(p).status === 'danger').length,
    vencendo: produtos.filter(p => getStatus(p).status === 'warning').length,
    normal: produtos.filter(p => getStatus(p).status === 'ok').length,
    valorTotal: produtos.reduce((sum, p) => sum + (p.saldo * p.custo_unitario), 0),
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleExportCSV = () => {
    const headers = ['Código', 'Produto', 'Tipo', 'CA', 'Tamanho', 'Marca', 'Fornecedor', 'Saldo', 'Estoque Mínimo', 'Custo Unitário', 'Validade', 'Localização', 'Status'];
    const rows = filtered.map(p => {
      const st = getStatus(p);
      return [
        p.codigo_interno, p.nome, p.tipo, p.ca || '', p.tamanho || '', p.marca || '',
        p.fornecedor || '', p.saldo, p.estoque_minimo, p.custo_unitario,
        p.data_validade ? new Date(p.data_validade).toLocaleDateString('pt-BR') : '',
        p.localizacao_fisica || '', st.label,
      ];
    });
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoque_${selectedEmpresa?.nome || 'geral'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `${filtered.length} itens exportados em CSV.` });
  };

  const handleToggleAtivo = async (product: ProdutoComSaldo) => {
    const newAtivo = !product.ativo;
    const { error } = await supabase.from('produtos').update({ ativo: newAtivo }).eq('id', product.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: newAtivo ? 'Produto reativado.' : 'Produto inativado.' });
      loadProdutos();
    }
  };

  const movTypeLabel = (m: Movimentacao) => {
    if (m.tipo_movimentacao === 'AJUSTE') return m.ajuste_tipo === 'AUMENTO' ? 'Ajuste +' : 'Ajuste −';
    return m.tipo_movimentacao === 'ENTRADA' ? 'Entrada' : 'Saída';
  };
  const movTypeColor = (m: Movimentacao) => {
    if (m.tipo_movimentacao === 'ENTRADA' || (m.tipo_movimentacao === 'AJUSTE' && m.ajuste_tipo === 'AUMENTO')) return 'text-status-ok';
    return 'text-status-danger';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Controle de Estoque</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedEmpresa ? selectedEmpresa.nome : 'Todas as empresas'} • {stats.total} produtos cadastrados
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={loading || filtered.length === 0} className="gap-1.5">
            <Download size={15} /> Exportar CSV
          </Button>
          <Button size="sm" onClick={openAddProduct} className="gap-1.5">
            <Plus size={15} /> Novo Produto
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Itens</p>
            <Package size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : stats.total}</p>
          <p className="text-[10px] text-status-ok mt-0.5">{stats.normal} em estoque normal</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-danger">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estoque Baixo</p>
            <AlertTriangle size={14} className="text-status-danger" />
          </div>
          <p className="text-xl font-bold text-status-danger">{loading ? '—' : stats.baixo}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">abaixo do mínimo</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-warning">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vencendo</p>
            <AlertTriangle size={14} className="text-status-warning" />
          </div>
          <p className="text-xl font-bold text-status-warning">{loading ? '—' : stats.vencendo}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">próximos 30 dias</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Valor em Estoque</p>
            <DollarSign size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : formatCurrency(stats.valorTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">custo total estimado</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código, CA ou marca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
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
          <Button size="sm" variant={showInativos ? 'default' : 'outline'} onClick={() => setShowInativos(!showInativos)} className="gap-1.5 h-9">
            <Power size={13} /> {showInativos ? 'Mostrando inativos' : 'Ver inativos'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Produto</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">CA</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Marca</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Saldo</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Mín.</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Custo Un.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className={`h-4 rounded skeleton-shimmer ${j === 1 ? 'w-28' : 'w-16'}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.map((p) => {
                const st = getStatus(p);
                return (
                  <tr key={p.id} className={cn("table-row-hover group", !p.ativo && "opacity-50")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.codigo_interno}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(p)} className="text-left hover:underline">
                        <p className="font-medium text-foreground">{p.nome}</p>
                        {p.tamanho && <p className="text-[10px] text-muted-foreground">Tam: {p.tamanho}</p>}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={cn(
                        "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full tracking-wide",
                        p.tipo === 'EPI' ? 'bg-primary/10 text-primary' : 'bg-status-warning/10 text-status-warning'
                      )}>{p.tipo}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{p.ca || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{p.marca || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-bold tabular-nums", st.status === 'danger' ? 'text-status-danger' : '')}>
                        {p.saldo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground text-xs">{p.estoque_minimo}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground text-xs">
                      {p.custo_unitario > 0 ? formatCurrency(p.custo_unitario) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={st.status} label={st.label} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-status-ok hover:text-status-ok" onClick={() => openMovModal('entrada', p)} title="Entrada">
                          <Plus size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-status-danger hover:text-status-danger" onClick={() => openMovModal('saida', p)} title="Saída">
                          <Minus size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => openMovModal('ajuste', p)} title="Ajuste">
                          <ArrowUpDown size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => openHistory(p)} title="Histórico">
                          <History size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => openEditProduct(p)} title="Editar">
                          <Settings2 size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className={cn("h-7 px-1.5 text-xs", p.ativo ? "text-status-danger hover:text-status-danger" : "text-status-ok hover:text-status-ok")} onClick={() => handleToggleAtivo(p)} title={p.ativo ? 'Inativar' : 'Reativar'}>
                          <Power size={13} />
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
            <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros ou cadastre um novo produto.</p>
          </div>
        )}
      </div>

      {/* Movement Modal */}
      <Dialog open={movModalOpen} onOpenChange={setMovModalOpen}>
        <DialogContent className={cn("sm:max-w-md", movType === 'saida' && "sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle>
              {movType === 'entrada' ? '📦 Entrada de Estoque' : movType === 'saida' ? '📤 Saída de Estoque' : '⚖️ Ajuste de Estoque'}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{selected.nome}</p>
                  <p className="text-xs text-muted-foreground">{selected.codigo_interno} • Saldo atual: <span className="font-semibold">{selected.saldo}</span></p>
                </div>
              </div>
              {movType === 'saida' && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><Users size={12} /> Colaborador *</Label>
                  <Select value={colaboradorId} onValueChange={setColaboradorId}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Selecionar colaborador..." /></SelectTrigger>
                    <SelectContent>
                      {colaboradores.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {movType === 'ajuste' && (
                <div>
                  <Label className="text-xs">Tipo de Ajuste *</Label>
                  <Select value={ajusteTipo} onValueChange={(v) => setAjusteTipo(v as 'AUMENTO' | 'REDUCAO')}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUMENTO">Aumento (adicionar)</SelectItem>
                      <SelectItem value="REDUCAO">Redução (remover)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Quantidade *</Label>
                <Input
                  type="number" min={1}
                  max={movType === 'saida' ? selected.saldo : (movType === 'ajuste' && ajusteTipo === 'REDUCAO' ? selected.saldo : undefined)}
                  value={qty} onChange={(e) => setQty(Number(e.target.value))}
                  className="mt-1 h-9"
                />
              </div>
              {movType === 'entrada' && (
                <div>
                  <Label className="text-xs">Referência NF</Label>
                  <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Nº da nota fiscal" className="mt-1 h-9" />
                </div>
              )}
              <div>
                <Label className="text-xs">Observação</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="mt-1" rows={2} />
              </div>
              {movType === 'saida' && (
                <div>
                  <Label className="text-xs">Assinatura do Colaborador {isAdmin ? '(opcional para admin)' : '*'}</Label>
                  <div className="mt-1">
                    <SignatureCanvas onSignatureChange={setAssinatura} />
                  </div>
                </div>
              )}
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

      {/* Product CRUD Modal */}
      <Dialog open={prodModalOpen} onOpenChange={setProdModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '✏️ Editar Produto' : '➕ Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código Interno *</Label>
                <Input value={prodForm.codigo_interno} onChange={(e) => setProdForm({ ...prodForm, codigo_interno: e.target.value })} className="mt-1 h-9" placeholder="EPI-001" />
              </div>
              <div>
                <Label className="text-xs">Tipo *</Label>
                <Select value={prodForm.tipo} onValueChange={(v) => setProdForm({ ...prodForm, tipo: v })}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EPI">EPI</SelectItem>
                    <SelectItem value="EPC">EPC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={prodForm.nome} onChange={(e) => setProdForm({ ...prodForm, nome: e.target.value })} className="mt-1 h-9" placeholder="Luva de Proteção Nitrílica" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">C.A.</Label>
                <Input value={prodForm.ca} onChange={(e) => setProdForm({ ...prodForm, ca: e.target.value })} className="mt-1 h-9" placeholder="12345" />
              </div>
              <div>
                <Label className="text-xs">Tamanho</Label>
                <Input value={prodForm.tamanho} onChange={(e) => setProdForm({ ...prodForm, tamanho: e.target.value })} className="mt-1 h-9" placeholder="M, G, 40..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Marca</Label>
                <Input value={prodForm.marca} onChange={(e) => setProdForm({ ...prodForm, marca: e.target.value })} className="mt-1 h-9" placeholder="3M, Vonder..." />
              </div>
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Input value={prodForm.fornecedor} onChange={(e) => setProdForm({ ...prodForm, fornecedor: e.target.value })} className="mt-1 h-9" placeholder="Distribuidor XYZ" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Estoque Mínimo</Label>
                <Input type="number" min={0} value={prodForm.estoque_minimo} onChange={(e) => setProdForm({ ...prodForm, estoque_minimo: Number(e.target.value) })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs">Custo Unitário</Label>
                <Input type="number" min={0} step={0.01} value={prodForm.custo_unitario} onChange={(e) => setProdForm({ ...prodForm, custo_unitario: Number(e.target.value) })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs">Validade</Label>
                <Input type="date" value={prodForm.data_validade} onChange={(e) => setProdForm({ ...prodForm, data_validade: e.target.value })} className="mt-1 h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Localização Física</Label>
              <Input value={prodForm.localizacao_fisica} onChange={(e) => setProdForm({ ...prodForm, localizacao_fisica: e.target.value })} className="mt-1 h-9" placeholder="Prateleira A3, Gaveta 2..." />
            </div>
            <Button className="w-full h-9 font-medium" onClick={handleSaveProduct} disabled={submitting}>
              {submitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} /> Histórico de Movimentações
            </DialogTitle>
            {historyProduct && (
              <p className="text-xs text-muted-foreground mt-1">
                {historyProduct.nome} — {historyProduct.codigo_interno} • Saldo atual: <span className="font-semibold">{historyProduct.saldo}</span>
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded skeleton-shimmer" />
                ))}
              </div>
            ) : movimentacoes.length === 0 ? (
              <div className="py-12 text-center">
                <History size={32} className="mx-auto text-muted-foreground/25 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Qtde</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Motivo</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">NF</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movimentacoes.map(m => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(m.data_hora)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("font-semibold", movTypeColor(m))}>{movTypeLabel(m)}</span>
                      </td>
                      <td className={cn("px-3 py-2.5 text-right font-bold tabular-nums", movTypeColor(m))}>
                        {m.tipo_movimentacao === 'ENTRADA' || (m.tipo_movimentacao === 'AJUSTE' && m.ajuste_tipo === 'AUMENTO') ? '+' : '−'}{m.quantidade}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[150px] truncate">{m.motivo || '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell font-mono">{m.referencia_nf || '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell max-w-[120px] truncate">{m.observacao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} /> Detalhes do Produto
            </DialogTitle>
          </DialogHeader>
          {detailProduct && (() => {
            const st = getStatus(detailProduct);
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                    detailProduct.tipo === 'EPI' ? 'bg-primary/10' : 'bg-status-warning/10'
                  )}>
                    <Package size={24} className={detailProduct.tipo === 'EPI' ? 'text-primary' : 'text-status-warning'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{detailProduct.nome}</h3>
                    <p className="text-xs text-muted-foreground">{detailProduct.codigo_interno} • {detailProduct.tipo}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['C.A.', detailProduct.ca || '—'],
                    ['Tamanho', detailProduct.tamanho || '—'],
                    ['Marca', detailProduct.marca || '—'],
                    ['Fornecedor', detailProduct.fornecedor || '—'],
                    ['Saldo', String(detailProduct.saldo)],
                    ['Estoque Mínimo', String(detailProduct.estoque_minimo)],
                    ['Custo Unitário', detailProduct.custo_unitario > 0 ? formatCurrency(detailProduct.custo_unitario) : '—'],
                    ['Valor Total', detailProduct.custo_unitario > 0 ? formatCurrency(detailProduct.saldo * detailProduct.custo_unitario) : '—'],
                    ['Validade', detailProduct.data_validade ? new Date(detailProduct.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'],
                    ['Localização', detailProduct.localizacao_fisica || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted/30 rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={st.status} label={st.label} />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setDetailOpen(false); openEditProduct(detailProduct); }}>
                    <Settings2 size={13} className="mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setDetailOpen(false); openHistory(detailProduct); }}>
                    <History size={13} className="mr-1" /> Histórico
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
