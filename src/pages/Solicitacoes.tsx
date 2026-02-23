import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, Package, Search, Loader2, ClipboardList, FileText, User, Calendar, Hash, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Solicitacao {
  id: string;
  colaborador_id: string;
  produto_id: string;
  quantidade: number;
  motivo: string;
  observacao: string | null;
  status: string;
  created_at: string;
  motivo_rejeicao: string | null;
  assinatura_base64: string | null;
  selfie_base64: string | null;
  ip_origem: string | null;
  user_agent: string | null;
  pdf_hash: string | null;
  declaracao_aceita: boolean;
  colaborador?: { nome: string; matricula: string; cpf: string | null; setor: string; funcao: string };
  produto?: { nome: string; ca: string | null };
}

export default function Solicitacoes() {
  const { user } = useAuth();
  const { selectedEmpresa } = useEmpresa();
  const { toast } = useToast();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [allSolicitacoes, setAllSolicitacoes] = useState<Solicitacao[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('solicitacoes_epi')
      .select('*')
      .order('created_at', { ascending: false });

    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);

    const { data } = await query;
    if (data) {
      const colabIds = [...new Set(data.map(s => s.colaborador_id))];
      const prodIds = [...new Set(data.map(s => s.produto_id))];

      const [colabRes, prodRes] = await Promise.all([
        colabIds.length > 0 ? supabase.from('colaboradores').select('id, nome, matricula, cpf, setor, funcao').in('id', colabIds) : { data: [] },
        prodIds.length > 0 ? supabase.from('produtos').select('id, nome, ca').in('id', prodIds) : { data: [] },
      ]);

      const enriched = data.map(s => ({
        ...s,
        colaborador: colabRes.data?.find(c => c.id === s.colaborador_id) || undefined,
        produto: prodRes.data?.find(p => p.id === s.produto_id) || undefined,
      }));
      setAllSolicitacoes(enriched as Solicitacao[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEmpresa]);

  // Filter by status
  useEffect(() => {
    let filtered = allSolicitacoes;
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }
    setSolicitacoes(filtered);
  }, [allSolicitacoes, statusFilter]);

  const handleApprove = async (sol: Solicitacao) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_epi')
        .update({ status: 'aprovado', aprovado_por: user?.id, aprovado_em: new Date().toISOString() })
        .eq('id', sol.id);
      if (error) throw error;
      toast({ title: 'Solicitação aprovada!' });
      setDetailOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleReject = async (sol: Solicitacao) => {
    if (!motivoRejeicao.trim()) {
      toast({ title: 'Informe o motivo da rejeição', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_epi')
        .update({ status: 'rejeitado', aprovado_por: user?.id, aprovado_em: new Date().toISOString(), motivo_rejeicao: motivoRejeicao })
        .eq('id', sol.id);
      if (error) throw error;
      toast({ title: 'Solicitação rejeitada' });
      setDetailOpen(false);
      setMotivoRejeicao('');
      await load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const filtered = solicitacoes.filter(s =>
    !search || s.colaborador?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    s.produto?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    s.colaborador?.matricula?.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
    pendente: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Pendente' },
    aprovado: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Aprovado' },
    rejeitado: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Rejeitado' },
    entregue: { icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Entregue' },
  };

  // Counts from all data (unfiltered)
  const counts = {
    pendente: allSolicitacoes.filter(s => s.status === 'pendente').length,
    aprovado: allSolicitacoes.filter(s => s.status === 'aprovado').length,
    rejeitado: allSolicitacoes.filter(s => s.status === 'rejeitado').length,
    entregue: allSolicitacoes.filter(s => s.status === 'entregue').length,
    todos: allSolicitacoes.length,
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd/MM/yyyy HH:mm'); } catch { return d; }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ClipboardList size={22} /> Protocolos — Solicitações de EPI
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie as solicitações feitas pelos colaboradores no portal</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['pendente', 'aprovado', 'rejeitado', 'entregue', 'todos'] as const).map(s => {
          const cfg = s === 'todos'
            ? { icon: FileText, color: 'text-foreground', bg: 'bg-muted', label: 'Todos' }
            : statusConfig[s];
          const Icon = cfg.icon;
          const count = counts[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "relative rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                statusFilter === s ? "border-primary ring-1 ring-primary/20 bg-card" : "bg-card/60 hover:bg-card"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{cfg.label}</span>
                <div className={cn("p-1 rounded-md", cfg.bg)}>
                  <Icon size={14} className={cfg.color} />
                </div>
              </div>
              <p className="text-xl font-bold text-foreground">{loading ? '—' : count}</p>
              {s === 'pendente' && count > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, matrícula ou produto..." className="pl-9 h-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-10 text-center">
          <ClipboardList size={36} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma solicitação {statusFilter !== 'todos' ? statusConfig[statusFilter]?.label.toLowerCase() : ''} encontrada</p>
          <p className="text-xs text-muted-foreground mt-1">As solicitações feitas pelos colaboradores no portal aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const cfg = statusConfig[s.status] || statusConfig.pendente;
            const Icon = cfg.icon;
            return (
              <div key={s.id}
                className="bg-card rounded-lg border shadow-sm hover:border-primary/30 transition-colors cursor-pointer overflow-hidden"
                onClick={() => { setSelected(s); setDetailOpen(true); setMotivoRejeicao(''); }}
              >
                <div className="flex items-stretch">
                  {/* Status bar */}
                  <div className={cn("w-1 shrink-0", s.status === 'pendente' && 'bg-amber-500', s.status === 'aprovado' && 'bg-emerald-500', s.status === 'rejeitado' && 'bg-red-500', s.status === 'entregue' && 'bg-blue-500')} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-muted-foreground shrink-0" />
                          <p className="text-sm font-semibold text-foreground truncate">{s.colaborador?.nome || '—'}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
                          {s.colaborador?.setor} • {s.colaborador?.funcao} • Mat: {s.colaborador?.matricula}
                        </p>
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium shrink-0", cfg.bg, cfg.color)}>
                        <Icon size={13} />
                        {cfg.label}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs">
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        <Package size={12} className="text-muted-foreground" />
                        {s.produto?.nome || '—'}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Shield size={12} /> CA: {s.produto?.ca || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Hash size={12} /> Qtde: {s.quantidade}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {s.motivo}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                        <Calendar size={12} /> {formatDate(s.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / Approve-Reject Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText size={18} /> Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Status badge */}
              {(() => {
                const cfg = statusConfig[selected.status] || statusConfig.pendente;
                const Icon = cfg.icon;
                return (
                  <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold", cfg.bg, cfg.color)}>
                    <Icon size={14} /> {cfg.label}
                  </div>
                );
              })()}

              {/* Colaborador info */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Colaborador</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Nome:</span><p className="font-medium">{selected.colaborador?.nome}</p></div>
                  <div><span className="text-muted-foreground">CPF:</span><p className="font-medium font-mono">{selected.colaborador?.cpf || '—'}</p></div>
                  <div><span className="text-muted-foreground">Setor / Função:</span><p className="font-medium">{selected.colaborador?.setor} / {selected.colaborador?.funcao}</p></div>
                  <div><span className="text-muted-foreground">Matrícula:</span><p className="font-medium">{selected.colaborador?.matricula}</p></div>
                </div>
              </div>

              {/* Item info */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Item Solicitado</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Produto:</span><p className="font-medium">{selected.produto?.nome}</p></div>
                  <div><span className="text-muted-foreground">CA:</span><p className="font-medium">{selected.produto?.ca || 'N/A'}</p></div>
                  <div><span className="text-muted-foreground">Quantidade:</span><p className="font-medium">{selected.quantidade}</p></div>
                  <div><span className="text-muted-foreground">Motivo:</span><p className="font-medium">{selected.motivo}</p></div>
                </div>
                {selected.observacao && <p className="text-xs mt-1"><span className="text-muted-foreground">Obs:</span> {selected.observacao}</p>}
              </div>

              {/* Selfie */}
              {selected.selfie_base64 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Selfie</p>
                  <img src={selected.selfie_base64} alt="Selfie" className="max-h-28 rounded-lg border" />
                </div>
              )}

              {/* Signature */}
              {selected.assinatura_base64 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Assinatura Digital</p>
                  <img src={selected.assinatura_base64} alt="Assinatura" className="max-h-20 border rounded-lg bg-white p-1" />
                </div>
              )}

              {/* Audit info */}
              <div className="border-t pt-3 text-[10px] text-muted-foreground space-y-0.5">
                <p>Solicitado em: {formatDate(selected.created_at)}</p>
                <p>IP: {selected.ip_origem || '—'}</p>
                {selected.declaracao_aceita && <p className="text-emerald-600">✓ Declaração aceita pelo colaborador</p>}
                {selected.pdf_hash && <p className="font-mono break-all">Hash: {selected.pdf_hash}</p>}
              </div>

              {/* Actions for pending */}
              {selected.status === 'pendente' && (
                <div className="border-t pt-4 space-y-3">
                  <Textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo da rejeição (obrigatório para rejeitar)" className="text-xs" rows={2} />
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-1.5" onClick={() => handleApprove(selected)} disabled={processing}>
                      <CheckCircle size={15} /> Aprovar
                    </Button>
                    <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => handleReject(selected)} disabled={processing}>
                      <XCircle size={15} /> Rejeitar
                    </Button>
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {selected.status !== 'pendente' && selected.motivo_rejeicao && (
                <div className="border-t pt-3">
                  <p className="text-xs text-red-600 bg-red-500/10 rounded-lg px-3 py-2">
                    <strong>Motivo da rejeição:</strong> {selected.motivo_rejeicao}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
