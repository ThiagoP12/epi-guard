import { useState, useEffect, useMemo } from 'react';
import { Search, ClipboardCheck, Plus, UserCheck, History, FileDown, Loader2, Users, Building2, UserX, Settings2, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { cn } from '@/lib/utils';

interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  setor: string;
  funcao: string;
  email: string | null;
  ativo: boolean;
  data_admissao: string;
  tamanho_uniforme: string | null;
  tamanho_bota: string | null;
  tamanho_luva: string | null;
}

interface EntregaHistorico {
  id: string;
  data_hora: string;
  motivo: string;
  assinatura_base64: string;
  observacao: string | null;
  itens: { nome_snapshot: string; ca_snapshot: string | null; quantidade: number; validade_snapshot: string | null }[];
}

const emptyForm = {
  nome: '', matricula: '', setor: '', funcao: '', email: '',
  data_admissao: new Date().toISOString().slice(0, 10),
  tamanho_uniforme: '', tamanho_bota: '', tamanho_luva: '',
};

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [search, setSearch] = useState('');
  const [setorFilter, setSetorFilter] = useState('todos');
  const [funcaoFilter, setFuncaoFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('ativos');

  // CRUD modal
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Histórico state
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoColab, setHistoricoColab] = useState<Colaborador | null>(null);
  const [entregas, setEntregas] = useState<EntregaHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailColab, setDetailColab] = useState<Colaborador | null>(null);
  const [detailEntregas, setDetailEntregas] = useState<EntregaHistorico[]>([]);
  const [loadingDetailEntregas, setLoadingDetailEntregas] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();

  const load = async () => {
    setLoading(true);
    let query = supabase.from('colaboradores').select('*').order('nome');
    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);
    const { data } = await query;
    if (data) setColaboradores(data as Colaborador[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEmpresa]);

  // Unique setores and funções for filters
  const setores = useMemo(() => [...new Set(colaboradores.map(c => c.setor))].sort(), [colaboradores]);
  const funcoes = useMemo(() => [...new Set(colaboradores.map(c => c.funcao))].sort(), [colaboradores]);

  const filtered = colaboradores.filter((c) => {
    const s = search.toLowerCase();
    if (s && !c.nome.toLowerCase().includes(s) && !c.matricula.toLowerCase().includes(s) && !c.setor.toLowerCase().includes(s) && !c.funcao.toLowerCase().includes(s)) return false;
    if (setorFilter !== 'todos' && c.setor !== setorFilter) return false;
    if (funcaoFilter !== 'todos' && c.funcao !== funcaoFilter) return false;
    if (statusFilter === 'ativos' && !c.ativo) return false;
    if (statusFilter === 'inativos' && c.ativo) return false;
    return true;
  });

  // Stats
  const stats = {
    total: colaboradores.filter(c => c.ativo).length,
    inativos: colaboradores.filter(c => !c.ativo).length,
    setores: new Set(colaboradores.filter(c => c.ativo).map(c => c.setor)).size,
  };

  // --- CRUD ---
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (c: Colaborador) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      matricula: c.matricula,
      setor: c.setor,
      funcao: c.funcao,
      email: c.email || '',
      data_admissao: c.data_admissao || '',
      tamanho_uniforme: c.tamanho_uniforme || '',
      tamanho_bota: c.tamanho_bota || '',
      tamanho_luva: c.tamanho_luva || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome || !form.matricula || !form.setor || !form.funcao) {
      toast({ title: 'Atenção', description: 'Preencha nome, matrícula, setor e função.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    const payload = {
      nome: form.nome,
      matricula: form.matricula,
      setor: form.setor,
      funcao: form.funcao,
      email: form.email || null,
      data_admissao: form.data_admissao || new Date().toISOString().slice(0, 10),
      tamanho_uniforme: form.tamanho_uniforme || null,
      tamanho_bota: form.tamanho_bota || null,
      tamanho_luva: form.tamanho_luva || null,
      empresa_id: selectedEmpresa?.id || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('colaboradores').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('colaboradores').insert(payload));
    }

    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: editingId ? 'Colaborador atualizado.' : 'Colaborador cadastrado.' });
      setFormOpen(false);
      load();
    }
  };

  const handleToggleAtivo = async (c: Colaborador) => {
    const { error } = await supabase.from('colaboradores').update({ ativo: !c.ativo }).eq('id', c.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: c.ativo ? 'Colaborador inativado.' : 'Colaborador reativado.' });
      load();
    }
  };

  // --- Histórico ---
  const loadDetailEntregas = async (colabId: string) => {
    setLoadingDetailEntregas(true);
    setDetailEntregas([]);
    const { data: entregasData } = await supabase
      .from('entregas_epi')
      .select('id, data_hora, motivo, assinatura_base64, observacao')
      .eq('colaborador_id', colabId)
      .order('data_hora', { ascending: false });
    if (entregasData && entregasData.length > 0) {
      const entregaIds = entregasData.map(e => e.id);
      const { data: itensData } = await supabase
        .from('entrega_epi_itens')
        .select('entrega_id, nome_snapshot, ca_snapshot, quantidade, validade_snapshot')
        .in('entrega_id', entregaIds);
      setDetailEntregas(entregasData.map(e => ({
        ...e,
        itens: (itensData || []).filter(i => i.entrega_id === e.id),
      })));
    }
    setLoadingDetailEntregas(false);
  };

  const openHistorico = async (colab: Colaborador) => {
    setHistoricoColab(colab);
    setHistoricoOpen(true);
    setLoadingHistorico(true);
    setEntregas([]);

    const { data: entregasData } = await supabase
      .from('entregas_epi')
      .select('id, data_hora, motivo, assinatura_base64, observacao')
      .eq('colaborador_id', colab.id)
      .order('data_hora', { ascending: false });

    if (entregasData && entregasData.length > 0) {
      const entregaIds = entregasData.map(e => e.id);
      const { data: itensData } = await supabase
        .from('entrega_epi_itens')
        .select('entrega_id, nome_snapshot, ca_snapshot, quantidade, validade_snapshot')
        .in('entrega_id', entregaIds);

      const result: EntregaHistorico[] = entregasData.map(e => ({
        ...e,
        itens: (itensData || []).filter(i => i.entrega_id === e.id),
      }));
      setEntregas(result);
    }

    setLoadingHistorico(false);
  };

  const handleDownloadPdf = async (entregaId: string) => {
    setDownloadingPdf(entregaId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-nr06-pdf', {
        body: { entregaId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    }
    setDownloadingPdf(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatDateShort = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Colaboradores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedEmpresa ? selectedEmpresa.nome : 'Todas as empresas'} • {stats.total} ativos
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus size={15} /> Novo Colaborador
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ativos</p>
            <Users size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : stats.total}</p>
          <p className="text-[10px] text-status-ok mt-0.5">colaboradores em atividade</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Setores</p>
            <Building2 size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : stats.setores}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">setores distintos</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-warning">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Inativos</p>
            <UserX size={14} className="text-status-warning" />
          </div>
          <p className="text-xl font-bold text-status-warning">{loading ? '—' : stats.inativos}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">colaboradores inativos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, matrícula, setor ou função..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9"><Filter size={13} className="mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos setores</SelectItem>
              {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas funções</SelectItem>
              {funcoes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Matrícula</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Setor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Função</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden xl:table-cell">Admissão</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden xl:table-cell">Tamanhos</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-16 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-20 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-24 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 w-20 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 w-24 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded skeleton-shimmer ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.map((c) => (
                <tr key={c.id} className={cn("table-row-hover group", !c.ativo && "opacity-50")}>
                  <td className="px-4 py-3">
                    <button onClick={() => { setDetailColab(c); setDetailOpen(true); loadDetailEntregas(c.id); }} className="flex items-center gap-2.5 text-left hover:underline">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        c.ativo ? "bg-primary/10" : "bg-muted"
                      )}>
                        <span className={cn("text-[10px] font-bold", c.ativo ? "text-primary" : "text-muted-foreground")}>{c.nome.charAt(0)}</span>
                      </div>
                      <div>
                        <span className="font-medium">{c.nome}</span>
                        {!c.ativo && <span className="ml-2 text-[10px] text-status-warning font-medium">INATIVO</span>}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">{c.matricula}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{c.setor}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{c.funcao}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                    {c.data_admissao ? formatDateShort(c.data_admissao) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-[10px]">
                    {[c.tamanho_uniforme && `U:${c.tamanho_uniforme}`, c.tamanho_bota && `B:${c.tamanho_bota}`, c.tamanho_luva && `L:${c.tamanho_luva}`].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openHistorico(c)}>
                        <History size={13} className="mr-1" /> Histórico
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => navigate(`/entrega-epi?colaborador=${c.id}`)}>
                        <ClipboardCheck size={13} className="mr-1" /> Entrega
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => openEdit(c)} title="Editar">
                        <Settings2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <UserCheck size={36} className="mx-auto text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros ou adicione um novo.</p>
          </div>
        )}
      </div>

      {/* Form Modal (Add/Edit) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '✏️ Editar Colaborador' : '➕ Novo Colaborador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs">Nome Completo *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 h-9" placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Matrícula *</Label>
                <Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} className="mt-1 h-9" placeholder="MAT-001" />
              </div>
              <div>
                <Label className="text-xs">Data de Admissão</Label>
                <Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} className="mt-1 h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Setor *</Label>
                <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className="mt-1 h-9" placeholder="Produção" />
              </div>
              <div>
                <Label className="text-xs">Função *</Label>
                <Input value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="mt-1 h-9" placeholder="Operador" />
              </div>
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9" placeholder="email@empresa.com" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Tam. Uniforme</Label>
                <Input value={form.tamanho_uniforme} onChange={(e) => setForm({ ...form, tamanho_uniforme: e.target.value })} className="mt-1 h-9" placeholder="M, G, GG..." />
              </div>
              <div>
                <Label className="text-xs">Tam. Bota</Label>
                <Input value={form.tamanho_bota} onChange={(e) => setForm({ ...form, tamanho_bota: e.target.value })} className="mt-1 h-9" placeholder="38, 40, 42..." />
              </div>
              <div>
                <Label className="text-xs">Tam. Luva</Label>
                <Input value={form.tamanho_luva} onChange={(e) => setForm({ ...form, tamanho_luva: e.target.value })} className="mt-1 h-9" placeholder="P, M, G..." />
              </div>
            </div>

            {editingId && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs text-status-warning hover:text-status-warning"
                  onClick={() => {
                    const c = colaboradores.find(c => c.id === editingId);
                    if (c) { handleToggleAtivo(c); setFormOpen(false); }
                  }}
                >
                  <UserX size={13} className="mr-1" />
                  {colaboradores.find(c => c.id === editingId)?.ativo ? 'Inativar Colaborador' : 'Reativar Colaborador'}
                </Button>
              </div>
            )}

            <Button className="w-full h-9 font-medium" onClick={handleSave} disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : editingId ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck size={18} /> Detalhes do Colaborador
            </DialogTitle>
          </DialogHeader>
          {detailColab && (
            <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="flex-1 text-xs">Dados</TabsTrigger>
                <TabsTrigger value="historico" className="flex-1 text-xs gap-1">
                  <History size={13} /> Histórico de Entregas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="flex-1 overflow-y-auto space-y-4 mt-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    detailColab.ativo ? "bg-primary/10" : "bg-muted"
                  )}>
                    <span className={cn("text-lg font-bold", detailColab.ativo ? "text-primary" : "text-muted-foreground")}>{detailColab.nome.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{detailColab.nome}</h3>
                    <p className="text-xs text-muted-foreground">{detailColab.matricula} • {detailColab.setor}</p>
                    {!detailColab.ativo && <span className="text-[10px] text-status-warning font-medium">INATIVO</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Função', detailColab.funcao],
                    ['E-mail', detailColab.email || '—'],
                    ['Admissão', detailColab.data_admissao ? formatDateShort(detailColab.data_admissao) : '—'],
                    ['Setor', detailColab.setor],
                    ['Uniforme', detailColab.tamanho_uniforme || '—'],
                    ['Bota', detailColab.tamanho_bota || '—'],
                    ['Luva', detailColab.tamanho_luva || '—'],
                    ['Status', detailColab.ativo ? 'Ativo' : 'Inativo'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted/30 rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setDetailOpen(false); openEdit(detailColab); }}>
                    <Settings2 size={13} className="mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setDetailOpen(false); navigate(`/entrega-epi?colaborador=${detailColab.id}`); }}>
                    <ClipboardCheck size={13} className="mr-1" /> Nova Entrega
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="historico" className="flex-1 overflow-y-auto space-y-3 mt-3">
                {loadingDetailEntregas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : detailEntregas.length === 0 ? (
                  <div className="py-12 text-center">
                    <ClipboardCheck size={32} className="mx-auto text-muted-foreground/25 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma entrega registrada.</p>
                  </div>
                ) : (
                  detailEntregas.map((entrega) => (
                    <div key={entrega.id} className="rounded-lg border bg-card p-3 space-y-2 animate-fade-in">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{formatDate(entrega.data_hora)}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Motivo: <span className="font-medium">{entrega.motivo}</span>
                            {entrega.observacao && <span> — {entrega.observacao}</span>}
                          </p>
                        </div>
                        <Button
                          variant="outline" size="sm" className="h-7 text-[10px] gap-1 shrink-0"
                          onClick={() => handleDownloadPdf(entrega.id)}
                          disabled={downloadingPdf === entrega.id}
                        >
                          {downloadingPdf === entrega.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                          NR-06
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">EPI/EPC</th>
                              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">C.A.</th>
                              <th className="text-center px-2 py-1.5 font-medium text-muted-foreground">Qtde</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {entrega.itens.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-2 py-1.5 font-medium">{item.nome_snapshot}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{item.ca_snapshot || '—'}</td>
                                <td className="px-2 py-1.5 text-center font-semibold">{item.quantidade}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Histórico de Entregas */}
      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} />
              Histórico de Entregas
            </DialogTitle>
            {historicoColab && (
              <p className="text-xs text-muted-foreground mt-1">
                {historicoColab.nome} — {historicoColab.matricula} • {historicoColab.setor}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
            {loadingHistorico ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2">
                    <div className="h-4 w-40 rounded skeleton-shimmer" />
                    <div className="h-3 w-60 rounded skeleton-shimmer" />
                    <div className="h-16 w-32 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : entregas.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardCheck size={32} className="mx-auto text-muted-foreground/25 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma entrega registrada.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">As entregas de EPI/EPC aparecerão aqui.</p>
              </div>
            ) : (
              entregas.map((entrega) => (
                <div key={entrega.id} className="rounded-lg border bg-card p-4 space-y-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatDate(entrega.data_hora)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Motivo: <span className="font-medium">{entrega.motivo}</span>
                        {entrega.observacao && <span> — {entrega.observacao}</span>}
                      </p>
                    </div>
                    <Button
                      variant="outline" size="sm" className="h-7 text-[10px] gap-1 shrink-0"
                      onClick={() => handleDownloadPdf(entrega.id)}
                      disabled={downloadingPdf === entrega.id}
                    >
                      {downloadingPdf === entrega.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                      NR-06
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider">EPI/EPC</th>
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider">C.A.</th>
                          <th className="text-center px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider">Qtde</th>
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Validade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {entrega.itens.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1.5 font-medium">{item.nome_snapshot}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{item.ca_snapshot || '—'}</td>
                            <td className="px-2 py-1.5 text-center font-semibold">{item.quantidade}</td>
                            <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">
                              {item.validade_snapshot ? new Date(item.validade_snapshot + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">Assinatura Digital</p>
                    {entrega.assinatura_base64 ? (
                      <div className="bg-muted/30 rounded-lg p-2 inline-block border border-dashed">
                        <img src={entrega.assinatura_base64} alt="Assinatura digital" className="max-w-[200px] max-h-[60px] object-contain" />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">Sem assinatura</p>
                    )}
                  </div>

                  <p className="text-[9px] text-muted-foreground/40 font-mono">
                    ID: {entrega.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
