import { useState, useEffect } from 'react';
import { Search, Plus, Shield, AlertTriangle, CheckCircle, XCircle, Wrench, History, Eye, Filter, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EPCItem {
  id: string;
  codigo_interno: string;
  nome: string;
  ca: string | null;
  marca: string | null;
  localizacao_fisica: string | null;
  data_validade: string | null;
  saldo: number;
}

interface Inspecao {
  id: string;
  produto_id: string;
  data_inspecao: string;
  proxima_inspecao: string | null;
  status: string;
  responsavel_id: string;
  observacao: string | null;
  acoes_corretivas: string | null;
}

const statusConfig: Record<string, { label: string; badge: 'ok' | 'warning' | 'danger'; icon: typeof CheckCircle }> = {
  conforme: { label: 'Conforme', badge: 'ok', icon: CheckCircle },
  nao_conforme: { label: 'Não Conforme', badge: 'danger', icon: XCircle },
  manutencao: { label: 'Em Manutenção', badge: 'warning', icon: Wrench },
  reprovado: { label: 'Reprovado', badge: 'danger', icon: AlertTriangle },
};

export default function ControleEPC() {
  const [epcs, setEpcs] = useState<EPCItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Inspection modal
  const [inspModalOpen, setInspModalOpen] = useState(false);
  const [selectedEPC, setSelectedEPC] = useState<EPCItem | null>(null);
  const [inspForm, setInspForm] = useState({
    status: 'conforme',
    observacao: '',
    acoes_corretivas: '',
    proxima_inspecao: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEPC, setHistoryEPC] = useState<EPCItem | null>(null);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEPC, setDetailEPC] = useState<EPCItem | null>(null);
  const [lastInspecao, setLastInspecao] = useState<Inspecao | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();

  const loadEPCs = async () => {
    setLoading(true);
    let query = supabase.from('produtos').select('*').eq('tipo', 'EPC').eq('ativo', true).order('codigo_interno');
    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);
    const { data } = await query;
    if (!data) { setLoading(false); return; }

    const items: EPCItem[] = [];
    for (const p of data) {
      const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
      items.push({
        id: p.id,
        codigo_interno: p.codigo_interno,
        nome: p.nome,
        ca: p.ca,
        marca: p.marca,
        localizacao_fisica: p.localizacao_fisica,
        data_validade: p.data_validade,
        saldo: typeof saldo === 'number' ? saldo : 0,
      });
    }
    setEpcs(items);
    setLoading(false);
  };

  useEffect(() => { loadEPCs(); }, [selectedEmpresa]);

  const filtered = epcs.filter(e => {
    const s = search.toLowerCase();
    return !s || e.nome.toLowerCase().includes(s) || e.codigo_interno.toLowerCase().includes(s) || (e.localizacao_fisica || '').toLowerCase().includes(s);
  });

  // --- Inspection ---
  const openInspection = (epc: EPCItem) => {
    setSelectedEPC(epc);
    setInspForm({ status: 'conforme', observacao: '', acoes_corretivas: '', proxima_inspecao: '' });
    setInspModalOpen(true);
  };

  const handleInspection = async () => {
    if (!selectedEPC || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('inspecoes_epc').insert({
      produto_id: selectedEPC.id,
      empresa_id: selectedEmpresa?.id || null,
      status: inspForm.status,
      observacao: inspForm.observacao || null,
      acoes_corretivas: inspForm.acoes_corretivas || null,
      proxima_inspecao: inspForm.proxima_inspecao || null,
      responsavel_id: user.id,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Inspeção registrada.' });
      setInspModalOpen(false);
    }
  };

  // --- History ---
  const openHistory = async (epc: EPCItem) => {
    setHistoryEPC(epc);
    setHistoryOpen(true);
    setLoadingHistory(true);
    const { data } = await supabase.from('inspecoes_epc')
      .select('*')
      .eq('produto_id', epc.id)
      .order('data_inspecao', { ascending: false })
      .limit(50);
    setInspecoes((data || []) as Inspecao[]);
    setLoadingHistory(false);
  };

  // --- Detail ---
  const openDetail = async (epc: EPCItem) => {
    setDetailEPC(epc);
    setDetailOpen(true);
    const { data } = await supabase.from('inspecoes_epc')
      .select('*')
      .eq('produto_id', epc.id)
      .order('data_inspecao', { ascending: false })
      .limit(1);
    setLastInspecao(data && data.length > 0 ? (data[0] as Inspecao) : null);
  };

  // --- Stats ---
  const stats = {
    total: epcs.length,
    pendentes: 0, // Will be computed once we have inspection data
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
          <h1 className="text-xl font-semibold text-foreground">Controle de EPC</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedEmpresa ? selectedEmpresa.nome : 'Todas as empresas'} • {stats.total} equipamentos
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total EPCs</p>
            <Shield size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">{loading ? '—' : stats.total}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">equipamentos cadastrados</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-ok">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Conformes</p>
            <CheckCircle size={14} className="text-status-ok" />
          </div>
          <p className="text-xl font-bold text-status-ok">{loading ? '—' : '—'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">última inspeção OK</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-warning">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Manutenção</p>
            <Wrench size={14} className="text-status-warning" />
          </div>
          <p className="text-xl font-bold text-status-warning">{loading ? '—' : '—'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">em manutenção</p>
        </div>
        <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-danger">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Reprovados</p>
            <XCircle size={14} className="text-status-danger" />
          </div>
          <p className="text-xl font-bold text-status-danger">{loading ? '—' : '—'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">necessitam ação</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-lg border p-3">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar EPC por nome, código ou localização..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Equipamento</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Localização</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Marca</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Qtde</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Validade</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><div className={`h-4 rounded skeleton-shimmer ${j === 1 ? 'w-28' : 'w-16'}`} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.map(epc => {
                const vencido = epc.data_validade && new Date(epc.data_validade).getTime() < Date.now();
                return (
                  <tr key={epc.id} className="table-row-hover group">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{epc.codigo_interno}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(epc)} className="text-left hover:underline">
                        <p className="font-medium text-foreground">{epc.nome}</p>
                        {epc.ca && <p className="text-[10px] text-muted-foreground">CA: {epc.ca}</p>}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{epc.localizacao_fisica || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{epc.marca || '—'}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell font-bold tabular-nums">{epc.saldo}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {epc.data_validade ? (
                        <span className={cn("text-xs", vencido ? "text-status-danger font-semibold" : "text-muted-foreground")}>
                          {formatDateShort(epc.data_validade)}
                          {vencido && ' (VENCIDO)'}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-status-ok hover:text-status-ok" onClick={() => openInspection(epc)} title="Nova Inspeção">
                          <CheckCircle size={13} className="mr-1" /> Inspecionar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => openHistory(epc)} title="Histórico">
                          <History size={13} />
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
            <Shield size={36} className="mx-auto text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum EPC encontrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Cadastre produtos do tipo EPC na aba Estoque.</p>
          </div>
        )}
      </div>

      {/* Inspection Modal */}
      <Dialog open={inspModalOpen} onOpenChange={setInspModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={18} /> Nova Inspeção
            </DialogTitle>
          </DialogHeader>
          {selectedEPC && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{selectedEPC.nome}</p>
                  <p className="text-xs text-muted-foreground">{selectedEPC.codigo_interno} {selectedEPC.localizacao_fisica ? `• ${selectedEPC.localizacao_fisica}` : ''}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs">Resultado da Inspeção *</Label>
                <Select value={inspForm.status} onValueChange={(v) => setInspForm({ ...inspForm, status: v })}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conforme">✅ Conforme</SelectItem>
                    <SelectItem value="nao_conforme">❌ Não Conforme</SelectItem>
                    <SelectItem value="manutencao">🔧 Necessita Manutenção</SelectItem>
                    <SelectItem value="reprovado">⛔ Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Próxima Inspeção</Label>
                <Input type="date" value={inspForm.proxima_inspecao} onChange={(e) => setInspForm({ ...inspForm, proxima_inspecao: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={inspForm.observacao} onChange={(e) => setInspForm({ ...inspForm, observacao: e.target.value })} placeholder="Detalhes da inspeção..." className="mt-1" rows={2} />
              </div>
              {(inspForm.status === 'nao_conforme' || inspForm.status === 'manutencao' || inspForm.status === 'reprovado') && (
                <div>
                  <Label className="text-xs">Ações Corretivas</Label>
                  <Textarea value={inspForm.acoes_corretivas} onChange={(e) => setInspForm({ ...inspForm, acoes_corretivas: e.target.value })} placeholder="Descreva as ações necessárias..." className="mt-1" rows={2} />
                </div>
              )}
              <Button className="w-full h-9 font-medium" onClick={handleInspection} disabled={submitting}>
                {submitting ? 'Registrando...' : 'Registrar Inspeção'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} /> Histórico de Inspeções
            </DialogTitle>
            {historyEPC && (
              <p className="text-xs text-muted-foreground mt-1">
                {historyEPC.nome} — {historyEPC.codigo_interno}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded skeleton-shimmer" />)}
              </div>
            ) : inspecoes.length === 0 ? (
              <div className="py-12 text-center">
                <History size={32} className="mx-auto text-muted-foreground/25 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma inspeção registrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inspecoes.map(insp => {
                  const cfg = statusConfig[insp.status] || statusConfig.conforme;
                  return (
                    <div key={insp.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={cfg.badge} label={cfg.label} />
                          <span className="text-xs text-muted-foreground">{formatDate(insp.data_inspecao)}</span>
                        </div>
                        {insp.proxima_inspecao && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock size={10} /> Próx: {formatDateShort(insp.proxima_inspecao)}
                          </span>
                        )}
                      </div>
                      {insp.observacao && <p className="text-xs text-muted-foreground">{insp.observacao}</p>}
                      {insp.acoes_corretivas && (
                        <p className="text-xs text-status-warning">
                          <strong>Ações:</strong> {insp.acoes_corretivas}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} /> Detalhes do EPC
            </DialogTitle>
          </DialogHeader>
          {detailEPC && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-status-warning/10 flex items-center justify-center shrink-0">
                  <Shield size={24} className="text-status-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{detailEPC.nome}</h3>
                  <p className="text-xs text-muted-foreground">{detailEPC.codigo_interno} • EPC</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['C.A.', detailEPC.ca || '—'],
                  ['Marca', detailEPC.marca || '—'],
                  ['Localização', detailEPC.localizacao_fisica || '—'],
                  ['Quantidade', String(detailEPC.saldo)],
                  ['Validade', detailEPC.data_validade ? formatDateShort(detailEPC.data_validade) : '—'],
                  ['Última Inspeção', lastInspecao ? formatDate(lastInspecao.data_inspecao) : 'Nenhuma'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-muted/30 rounded-md px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {lastInspecao && (
                <div className="p-3 rounded-lg border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Último Status</p>
                  <StatusBadge status={statusConfig[lastInspecao.status]?.badge || 'ok'} label={statusConfig[lastInspecao.status]?.label || lastInspecao.status} />
                  {lastInspecao.observacao && <p className="text-xs text-muted-foreground mt-1">{lastInspecao.observacao}</p>}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setDetailOpen(false); openInspection(detailEPC); }}>
                  <CheckCircle size={13} className="mr-1" /> Inspecionar
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setDetailOpen(false); openHistory(detailEPC); }}>
                  <History size={13} className="mr-1" /> Histórico
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
