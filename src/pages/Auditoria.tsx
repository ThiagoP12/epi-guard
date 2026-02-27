import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, ArrowUpDown, TrendingUp, TrendingDown, Settings2, Package, Users, Calendar, Eye, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  tipo_movimentacao: string;
  quantidade: number;
  motivo: string | null;
  observacao: string | null;
  referencia_nf: string | null;
  data_hora: string;
  ajuste_tipo: string | null;
  usuario_id: string | null;
  colaborador_id: string | null;
  produto_id: string;
  assinatura_base64: string | null;
  selfie_base64: string | null;
  usuario_nome?: string;
  colaborador_nome?: string;
  produto_nome?: string;
  produto_ca?: string | null;
}

interface AuditLogEntry {
  id: string;
  evento: string;
  solicitacao_id: string | null;
  usuario_id: string | null;
  unidade_id: string | null;
  empresa_id: string | null;
  data_hora: string;
  detalhes: any;
  usuario_nome?: string;
  empresa_nome?: string;
}

const PAGE_SIZE = 50;

export default function Auditoria() {
  const { selectedEmpresa } = useEmpresa();
  const [activeTab, setActiveTab] = useState('movimentacoes');

  // Movimentações state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

  const loadLogs = async (pageNum = 0) => {
    setLoading(true);
    let query = supabase
      .from('movimentacoes_estoque')
      .select('id, tipo_movimentacao, quantidade, motivo, observacao, referencia_nf, data_hora, ajuste_tipo, usuario_id, colaborador_id, produto_id, assinatura_base64, selfie_base64')
      .order('data_hora', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);

    const { data, error } = await query;
    if (error || !data) { setLoading(false); return; }

    setHasMore(data.length === PAGE_SIZE);

    const userIds = [...new Set(data.map(d => d.usuario_id).filter(Boolean))] as string[];
    const colabIds = [...new Set(data.map(d => d.colaborador_id).filter(Boolean))] as string[];
    const prodIds = [...new Set(data.map(d => d.produto_id))];

    const [profilesRes, colabsRes, prodsRes] = await Promise.all([
      userIds.length > 0 ? supabase.from('profiles').select('id, nome').in('id', userIds) : { data: [] },
      colabIds.length > 0 ? supabase.from('colaboradores').select('id, nome').in('id', colabIds) : { data: [] },
      supabase.from('produtos').select('id, nome, ca').in('id', prodIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.nome]));
    const colabMap = new Map((colabsRes.data || []).map(c => [c.id, c.nome]));
    const prodMap = new Map((prodsRes.data || []).map(p => [p.id, { nome: p.nome, ca: p.ca }]));

    const enriched: LogEntry[] = data.map(d => ({
      ...d,
      usuario_nome: d.usuario_id ? profileMap.get(d.usuario_id) || 'Usuário desconhecido' : undefined,
      colaborador_nome: d.colaborador_id ? colabMap.get(d.colaborador_id) || 'Colaborador desconhecido' : undefined,
      produto_nome: prodMap.get(d.produto_id)?.nome || 'Produto desconhecido',
      produto_ca: prodMap.get(d.produto_id)?.ca,
    }));

    setLogs(enriched);
    setPage(pageNum);
    setLoading(false);
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(200);

    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);

    const { data } = await query;
    if (data) {
      const userIds = [...new Set(data.map(d => d.usuario_id).filter(Boolean))] as string[];
      const empresaIds = [...new Set([...data.map(d => d.empresa_id), ...data.map(d => d.unidade_id)].filter(Boolean))] as string[];

      const [profilesRes, empresasRes] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('id, nome').in('id', userIds) : { data: [] },
        empresaIds.length > 0 ? supabase.from('empresas').select('id, nome').in('id', empresaIds) : { data: [] },
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.nome]));
      const empresaMap = new Map((empresasRes.data || []).map(e => [e.id, e.nome]));

      setAuditLogs(data.map(d => ({
        ...d,
        usuario_nome: d.usuario_id ? profileMap.get(d.usuario_id) || '—' : '—',
        empresa_nome: d.empresa_id ? empresaMap.get(d.empresa_id) || '—' : '—',
      })) as AuditLogEntry[]);
    }
    setAuditLoading(false);
  };

  useEffect(() => { loadLogs(0); loadAuditLogs(); }, [selectedEmpresa]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (tipoFilter !== 'todos') {
        if (tipoFilter === 'ENTRADA' && l.tipo_movimentacao !== 'ENTRADA') return false;
        if (tipoFilter === 'SAIDA' && l.tipo_movimentacao !== 'SAIDA') return false;
        if (tipoFilter === 'AJUSTE' && l.tipo_movimentacao !== 'AJUSTE') return false;
      }
      if (dateFilter && !l.data_hora.startsWith(dateFilter)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !(l.produto_nome || '').toLowerCase().includes(s) &&
          !(l.usuario_nome || '').toLowerCase().includes(s) &&
          !(l.colaborador_nome || '').toLowerCase().includes(s) &&
          !(l.motivo || '').toLowerCase().includes(s) &&
          !(l.referencia_nf || '').toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [logs, search, tipoFilter, dateFilter]);

  const filteredAudit = useMemo(() => {
    if (!auditSearch) return auditLogs;
    const s = auditSearch.toLowerCase();
    return auditLogs.filter(a =>
      a.evento.toLowerCase().includes(s) ||
      (a.usuario_nome || '').toLowerCase().includes(s) ||
      (a.empresa_nome || '').toLowerCase().includes(s) ||
      (a.solicitacao_id || '').toLowerCase().includes(s)
    );
  }, [auditLogs, auditSearch]);

  const stats = useMemo(() => {
    const entradas = filtered.filter(l => l.tipo_movimentacao === 'ENTRADA' || (l.tipo_movimentacao === 'AJUSTE' && l.ajuste_tipo === 'AUMENTO'));
    const saidas = filtered.filter(l => l.tipo_movimentacao === 'SAIDA' || (l.tipo_movimentacao === 'AJUSTE' && l.ajuste_tipo === 'REDUCAO'));
    return {
      totalEntradas: entradas.reduce((s, l) => s + l.quantidade, 0),
      totalSaidas: saidas.reduce((s, l) => s + l.quantidade, 0),
      countEntradas: entradas.length,
      countSaidas: saidas.length,
      uniqueUsers: new Set(filtered.map(l => l.usuario_id).filter(Boolean)).size,
    };
  }, [filtered]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const typeConfig = (l: LogEntry) => {
    if (l.tipo_movimentacao === 'ENTRADA') return { label: 'Entrada', color: 'text-status-ok', bg: 'bg-status-ok/10', icon: TrendingUp };
    if (l.tipo_movimentacao === 'SAIDA') return { label: 'Saída', color: 'text-status-danger', bg: 'bg-status-danger/10', icon: TrendingDown };
    if (l.ajuste_tipo === 'AUMENTO') return { label: 'Ajuste +', color: 'text-status-ok', bg: 'bg-status-ok/10', icon: TrendingUp };
    return { label: 'Ajuste −', color: 'text-status-danger', bg: 'bg-status-danger/10', icon: TrendingDown };
  };

  const clearFilters = () => { setSearch(''); setTipoFilter('todos'); setDateFilter(''); };
  const hasFilters = search || tipoFilter !== 'todos' || dateFilter;

  const eventoLabel = (evento: string) => {
    const map: Record<string, string> = {
      SOLICITACAO_APROVADA: '✅ Solicitação Aprovada',
      SOLICITACAO_REPROVADA: '❌ Solicitação Reprovada',
      SOLICITACAO_EM_SEPARACAO: '📦 Em Separação',
      SOLICITACAO_BAIXADA_ESTOQUE: '📋 Baixa no Estoque',
      SOLICITACAO_ENTREGUE: '🚚 Entregue',
      SOLICITACAO_CONFIRMADA: '✔️ Confirmada',
    };
    return map[evento] || evento;
  };

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ArrowUpDown size={18} className="text-primary" />
          </div>
          Auditoria & Logs
        </h1>
        <p className="text-xs text-muted-foreground mt-1 ml-[34px]">
          {selectedEmpresa?.nome || 'Todas as empresas'} • Rastreabilidade completa de movimentações
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="movimentacoes" className="gap-1.5 text-xs">
            <Package size={13} /> Movimentações
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="gap-1.5 text-xs">
            <ClipboardList size={13} /> Solicitações
            {auditLogs.length > 0 && <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{auditLogs.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimentacoes" className="space-y-5 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Entradas', value: stats.totalEntradas, sub: `${stats.countEntradas} movimentações`, icon: TrendingUp, color: 'text-[hsl(var(--status-ok))]', bg: 'bg-[hsl(var(--status-ok))]/10', borderColor: 'border-l-[hsl(var(--status-ok))]' },
              { label: 'Saídas', value: stats.totalSaidas, sub: `${stats.countSaidas} movimentações`, icon: TrendingDown, color: 'text-[hsl(var(--status-danger))]', bg: 'bg-[hsl(var(--status-danger))]/10', borderColor: 'border-l-[hsl(var(--status-danger))]' },
              { label: 'Operadores', value: stats.uniqueUsers, sub: 'usuários distintos', icon: Users, color: 'text-primary', bg: 'bg-primary/10', borderColor: 'border-l-primary' },
              { label: 'Registros', value: filtered.length, sub: 'nesta página', icon: Package, color: 'text-muted-foreground', bg: 'bg-muted', borderColor: 'border-l-muted-foreground' },
            ].map(kpi => (
              <div key={kpi.label} className={cn("bg-card rounded-xl border border-l-[3px] p-4", kpi.borderColor)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                  <div className={cn("p-1.5 rounded-lg", kpi.bg)}>
                    <kpi.icon size={14} className={kpi.color} />
                  </div>
                </div>
                <p className={cn("text-2xl font-bold tracking-tight", kpi.color)}>{loading ? '—' : kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-card rounded-xl border shadow-sm p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar produto, usuário, colaborador, motivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full sm:w-36 h-9 text-xs">
                  <Filter size={12} className="mr-1 shrink-0 text-muted-foreground" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  <SelectItem value="ENTRADA">Entradas</SelectItem>
                  <SelectItem value="SAIDA">Saídas</SelectItem>
                  <SelectItem value="AJUSTE">Ajustes</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full sm:w-40 h-9 text-xs" />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1 text-muted-foreground">
                  <X size={13} /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Log List */}
          <div className="space-y-1.5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded w-1/3" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="bg-card rounded-xl border p-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Package size={24} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhum registro encontrado</p>
                <p className="text-xs text-muted-foreground mt-1.5">Tente ajustar os filtros de busca.</p>
              </div>
            ) : filtered.map(log => {
              const tc = typeConfig(log);
              const Icon = tc.icon;
              return (
                <div
                  key={log.id}
                  className="bg-card rounded-xl border shadow-sm card-interactive cursor-pointer overflow-hidden transition-all duration-150 hover:bg-accent/30"
                  onClick={() => { setSelectedLog(log); setDetailOpen(true); }}
                >
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", tc.bg)}>
                      <Icon size={16} className={tc.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{log.produto_nome}</p>
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", tc.bg, tc.color)}>
                          {tc.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span className="font-mono flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(log.data_hora)}
                        </span>
                        {log.usuario_nome && <span className="flex items-center gap-1"><Users size={10} /> {log.usuario_nome}</span>}
                        {log.colaborador_nome && <span className="hidden sm:inline">{log.colaborador_nome}</span>}
                        {log.produto_ca && <span className="hidden sm:inline font-mono">CA: {log.produto_ca}</span>}
                        {log.motivo && <span className="hidden lg:inline truncate max-w-[200px]">{log.motivo}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn("text-lg font-bold", tc.color)}>
                        {(log.tipo_movimentacao === 'SAIDA' || (log.tipo_movimentacao === 'AJUSTE' && log.ajuste_tipo === 'REDUCAO')) ? '−' : '+'}{log.quantidade}
                      </span>
                      <p className="text-[10px] text-muted-foreground">un.</p>
                    </div>
                    <Eye size={14} className="text-muted-foreground/40 shrink-0 hidden sm:block" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between bg-card rounded-xl border shadow-sm px-4 py-3">
              <p className="text-[11px] text-muted-foreground">Página {page + 1}</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={page === 0} onClick={() => loadLogs(page - 1)}>
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={!hasMore} onClick={() => loadLogs(page + 1)}>
                  Próxima <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4 mt-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar evento, usuário, empresa..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>

          {/* Audit log list */}
          <div className="space-y-1.5">
            {auditLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded w-1/3" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredAudit.length === 0 ? (
              <div className="bg-card rounded-xl border p-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                  <ClipboardList size={24} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhum evento de auditoria</p>
                <p className="text-xs text-muted-foreground mt-1.5">Eventos de aprovação/rejeição de solicitações aparecerão aqui.</p>
              </div>
            ) : filteredAudit.map(a => (
              <div key={a.id} className="bg-card rounded-xl border shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{eventoLabel(a.evento)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="font-mono flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDate(a.data_hora)}
                      </span>
                      {a.usuario_nome && <span className="flex items-center gap-1"><Users size={10} /> {a.usuario_nome}</span>}
                      {a.empresa_nome && <span>{a.empresa_nome}</span>}
                      {a.solicitacao_id && <span className="font-mono text-[10px]">#{a.solicitacao_id.slice(0, 8).toUpperCase()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 size={16} /> Detalhes da Movimentação
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (() => {
            const tc = typeConfig(selectedLog);
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full", tc.bg, tc.color)}>
                    <tc.icon size={14} /> {tc.label}
                  </span>
                  <span className={cn("text-lg font-bold", tc.color)}>
                    {(selectedLog.tipo_movimentacao === 'SAIDA' || (selectedLog.tipo_movimentacao === 'AJUSTE' && selectedLog.ajuste_tipo === 'REDUCAO')) ? '−' : '+'}{selectedLog.quantidade} un.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ['Data/Hora', formatDate(selectedLog.data_hora)],
                    ['Produto', selectedLog.produto_nome],
                    ['CA', selectedLog.produto_ca || '—'],
                    ['Operador', selectedLog.usuario_nome || '—'],
                    ['Colaborador', selectedLog.colaborador_nome || '—'],
                    ['Motivo', selectedLog.motivo || '—'],
                    ['NF/Ref.', selectedLog.referencia_nf || '—'],
                    ['Observação', selectedLog.observacao || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</p>
                    </div>
                  ))}
                </div>

                {(selectedLog.selfie_base64 || selectedLog.assinatura_base64) && (
                  <div className="border rounded-xl p-3.5 space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Evidências</p>
                    <div className="flex gap-4 items-start">
                      {selectedLog.selfie_base64 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">📸 Selfie</p>
                          <img src={selectedLog.selfie_base64} alt="Selfie" className="w-24 h-24 rounded-lg object-cover border" />
                        </div>
                      )}
                      {selectedLog.assinatura_base64 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">✍️ Assinatura</p>
                          <div className="bg-muted/30 rounded-lg p-2 border border-dashed">
                            <img src={selectedLog.assinatura_base64} alt="Assinatura" className="max-w-[180px] max-h-[60px] object-contain" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-[9px] text-muted-foreground/40 font-mono">ID: {selectedLog.id.toUpperCase()}</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
