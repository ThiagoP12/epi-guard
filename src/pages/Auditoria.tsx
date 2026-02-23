import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, ArrowUpDown, TrendingUp, TrendingDown, Settings2, Package, Users, Calendar, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  // enriched
  usuario_nome?: string;
  colaborador_nome?: string;
  produto_nome?: string;
  produto_ca?: string | null;
}

const PAGE_SIZE = 50;

export default function Auditoria() {
  const { selectedEmpresa } = useEmpresa();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('');

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

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

    // Enrich with user/colaborador/produto names
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

  useEffect(() => { loadLogs(0); }, [selectedEmpresa]);

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

  // Stats from current page
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Auditoria & Logs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {selectedEmpresa?.nome || 'Todas as empresas'} • Rastreabilidade completa de movimentações
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-ok">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Entradas</p>
            <TrendingUp size={14} className="text-status-ok" />
          </div>
          <p className="text-xl font-bold text-status-ok">{loading ? '—' : stats.totalEntradas}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stats.countEntradas} movimentações</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-danger">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Saídas</p>
            <TrendingDown size={14} className="text-status-danger" />
          </div>
          <p className="text-xl font-bold text-status-danger">{loading ? '—' : stats.totalSaidas}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stats.countSaidas} movimentações</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Operadores</p>
            <Users size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : stats.uniqueUsers}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">usuários distintos</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Registros</p>
            <Package size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : filtered.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">nesta página</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar produto, usuário, colaborador, motivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9">
              <Filter size={13} className="mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ENTRADA">Entradas</SelectItem>
              <SelectItem value="SAIDA">Saídas</SelectItem>
              <SelectItem value="AJUSTE">Ajustes</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full sm:w-40 h-9" />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1 text-muted-foreground">
              <X size={13} /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Data/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Produto</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Qtde</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Operador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Colaborador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden xl:table-cell">Motivo</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-16">Info</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded skeleton-shimmer" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : filtered.map(log => {
                const tc = typeConfig(log);
                const Icon = tc.icon;
                return (
                  <tr key={log.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap font-mono">{formatDate(log.data_hora)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", tc.bg, tc.color)}>
                        <Icon size={11} /> {tc.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium truncate max-w-[180px]">{log.produto_nome}</p>
                      {log.produto_ca && <p className="text-[10px] text-muted-foreground">CA: {log.produto_ca}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn("text-sm font-bold", tc.color)}>
                        {(log.tipo_movimentacao === 'SAIDA' || (log.tipo_movimentacao === 'AJUSTE' && log.ajuste_tipo === 'REDUCAO')) ? '−' : '+'}{log.quantidade}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <p className="text-xs truncate max-w-[140px]">{log.usuario_nome || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{log.colaborador_nome || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden xl:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{log.motivo || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 opacity-60 group-hover:opacity-100"
                        onClick={() => { setSelectedLog(log); setDetailOpen(true); }}
                      >
                        <Eye size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <p className="text-[11px] text-muted-foreground">Página {page + 1}</p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => loadLogs(page - 1)}>
              <ChevronLeft size={14} /> Anterior
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!hasMore} onClick={() => loadLogs(page + 1)}>
              Próxima <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

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

                <div className="grid grid-cols-2 gap-3">
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
                    <div key={label} className="bg-muted/30 rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Selfie + Signature */}
                {(selectedLog.selfie_base64 || selectedLog.assinatura_base64) && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Evidências</p>
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
