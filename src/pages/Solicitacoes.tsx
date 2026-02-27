import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, Package, Search, Loader2, ClipboardList, FileText, User, Calendar, Hash, Shield, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Solicitacao {
  id: string;
  colaborador_id: string;
  produto_id: string;
  empresa_id: string | null;
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
  const [statusFilter, setStatusFilter] = useState('ENVIADA');
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [observacaoAprovacao, setObservacaoAprovacao] = useState('');
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
      // 1. Update status to approved
      const { error } = await supabase
        .from('solicitacoes_epi')
        .update({ 
          status: 'APROVADA', 
          aprovado_por: user?.id, 
          aprovado_em: new Date().toISOString(),
          observacao_aprovacao: observacaoAprovacao.trim() || null,
        } as any)
        .eq('id', sol.id);
      if (error) throw error;

      // 2. Create stock movement (saida)
      const { error: movError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          produto_id: sol.produto_id,
          quantidade: sol.quantidade,
          tipo_movimentacao: 'SAIDA',
          colaborador_id: sol.colaborador_id,
          empresa_id: sol.empresa_id || null,
          usuario_id: user?.id,
          motivo: `Aprovação solicitação - ${sol.motivo}`,
          observacao: `Solicitação ${sol.id.slice(0, 8)}`,
        } as any);
      if (movError) throw movError;

      toast({ title: 'Solicitação aprovada!', description: 'Estoque atualizado automaticamente.' });
      setDetailOpen(false);
      setObservacaoAprovacao('');
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
        .update({ status: 'REPROVADA', aprovado_por: user?.id, aprovado_em: new Date().toISOString(), motivo_rejeicao: motivoRejeicao })
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

  const handleDeliver = async (sol: Solicitacao) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_epi')
        .update({ status: 'ENTREGUE' })
        .eq('id', sol.id);
      if (error) throw error;
      toast({ title: '✅ Entrega confirmada!' });
      setDetailOpen(false);
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

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; label: string; accent: string }> = {
    CRIADA: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Criada', accent: 'border-l-muted-foreground' },
    ENVIADA: { icon: Clock, color: 'text-[hsl(var(--status-warning))]', bg: 'bg-[hsl(var(--status-warning-bg))]', label: 'Enviada', accent: 'border-l-[hsl(var(--status-warning))]' },
    APROVADA: { icon: CheckCircle, color: 'text-[hsl(var(--status-ok))]', bg: 'bg-[hsl(var(--status-ok-bg))]', label: 'Aprovada', accent: 'border-l-[hsl(var(--status-ok))]' },
    REPROVADA: { icon: XCircle, color: 'text-[hsl(var(--status-danger))]', bg: 'bg-[hsl(var(--status-danger-bg))]', label: 'Reprovada', accent: 'border-l-[hsl(var(--status-danger))]' },
    EM_SEPARACAO: { icon: Package, color: 'text-[hsl(210,70%,55%)]', bg: 'bg-[hsl(210,70%,55%)]/10', label: 'Em Separação', accent: 'border-l-[hsl(210,70%,55%)]' },
    BAIXADA_NO_ESTOQUE: { icon: Package, color: 'text-[hsl(280,60%,55%)]', bg: 'bg-[hsl(280,60%,55%)]/10', label: 'Baixada no Estoque', accent: 'border-l-[hsl(280,60%,55%)]' },
    ENTREGUE: { icon: Package, color: 'text-primary', bg: 'bg-primary/10', label: 'Entregue', accent: 'border-l-primary' },
    CONFIRMADA: { icon: CheckCircle, color: 'text-[hsl(var(--status-ok))]', bg: 'bg-[hsl(var(--status-ok-bg))]', label: 'Confirmada', accent: 'border-l-[hsl(var(--status-ok))]' },
  };

  const counts: Record<string, number> = {
    ENVIADA: allSolicitacoes.filter(s => s.status === 'ENVIADA').length,
    APROVADA: allSolicitacoes.filter(s => s.status === 'APROVADA').length,
    REPROVADA: allSolicitacoes.filter(s => s.status === 'REPROVADA').length,
    EM_SEPARACAO: allSolicitacoes.filter(s => s.status === 'EM_SEPARACAO').length,
    ENTREGUE: allSolicitacoes.filter(s => s.status === 'ENTREGUE').length,
    CONFIRMADA: allSolicitacoes.filter(s => s.status === 'CONFIRMADA').length,
    todos: allSolicitacoes.length,
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd/MM/yyyy HH:mm'); } catch { return d; }
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <ClipboardList size={18} className="text-primary" />
            </div>
            Protocolos
          </h1>
          <p className="text-xs text-muted-foreground mt-1 ml-[34px]">Gerencie as solicitações de EPI feitas pelos colaboradores</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {(['ENVIADA', 'APROVADA', 'REPROVADA', 'EM_SEPARACAO', 'ENTREGUE', 'CONFIRMADA', 'todos'] as const).map(s => {
          const cfg = s === 'todos'
            ? { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Todos' }
            : statusConfig[s];
          const Icon = cfg.icon;
          const count = counts[s];
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "group relative rounded-xl border p-3.5 text-left transition-all duration-200",
                isActive
                  ? "border-primary bg-primary/[0.03] shadow-sm ring-1 ring-primary/10"
                  : "bg-card hover:bg-accent/50 hover:border-border"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {cfg.label}
                </span>
                <div className={cn("p-1.5 rounded-lg transition-colors", cfg.bg)}>
                  <Icon size={13} className={cfg.color} />
                </div>
              </div>
              <p className={cn(
                "text-2xl font-bold tracking-tight transition-colors",
                isActive ? "text-primary" : "text-foreground"
              )}>
                {loading ? '—' : count}
              </p>
              {s === 'ENVIADA' && count > 0 && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[hsl(var(--status-warning))] animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, matrícula ou produto..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-xl border p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-1/3" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <ClipboardList size={24} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma solicitação encontrada</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
            {statusFilter !== 'todos'
              ? `Não há solicitações com status "${statusConfig[statusFilter]?.label.toLowerCase() || statusFilter}" no momento.`
              : 'As solicitações feitas pelos colaboradores no portal aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const cfg = statusConfig[s.status] || statusConfig.ENVIADA;
            const Icon = cfg.icon;
            const initials = s.colaborador?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
            return (
              <div
                key={s.id}
                className={cn(
                  "bg-card rounded-xl border border-l-[3px] shadow-sm card-interactive cursor-pointer overflow-hidden",
                  cfg.accent
                )}
                onClick={() => { setSelected(s); setDetailOpen(true); setMotivoRejeicao(''); setObservacaoAprovacao(''); }}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {initials}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{s.colaborador?.nome || '—'}</p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{s.colaborador?.matricula}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package size={11} />
                        {s.produto?.nome || '—'}
                      </span>
                      {s.produto?.ca && (
                        <span className="flex items-center gap-1">
                          <Shield size={11} />
                          CA: {s.produto.ca}
                        </span>
                      )}
                      <span>Qtd: {s.quantidade}</span>
                      <span className="hidden sm:inline">• {s.motivo}</span>
                    </div>
                  </div>

                  {/* Right side: status + date */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1">
                      {['ENTREGUE', 'CONFIRMADA', 'EM_SEPARACAO', 'BAIXADA_NO_ESTOQUE'].includes(s.status) && (
                        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", statusConfig.APROVADA.bg, statusConfig.APROVADA.color)}>
                          <CheckCircle size={12} />
                          Aprovada
                        </div>
                      )}
                      <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", cfg.bg, cfg.color)}>
                        <Icon size={12} />
                        {cfg.label}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} />
                      {formatDate(s.created_at)}
                    </span>
                  </div>

                  <ArrowRight size={14} className="text-muted-foreground/30 shrink-0 hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <FileText size={16} className="text-primary" />
              </div>
              Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5 mt-1">
              {/* Status badges */}
              {(() => {
                const cfg = statusConfig[selected.status] || statusConfig.ENVIADA;
                const Icon = cfg.icon;
                return (
                  <div className="flex items-center gap-2">
                    {['ENTREGUE', 'CONFIRMADA', 'EM_SEPARACAO', 'BAIXADA_NO_ESTOQUE'].includes(selected.status) && (
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold", statusConfig.APROVADA.bg, statusConfig.APROVADA.color)}>
                        <CheckCircle size={14} /> Aprovada
                      </div>
                    )}
                    <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold", cfg.bg, cfg.color)}>
                      <Icon size={14} /> {cfg.label}
                    </div>
                  </div>
                );
              })()}

              {/* Colaborador info */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <User size={11} /> Colaborador
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Nome</span>
                    <p className="font-medium mt-0.5">{selected.colaborador?.nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">CPF</span>
                    <p className="font-medium font-mono mt-0.5">{selected.colaborador?.cpf || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Setor / Função</span>
                    <p className="font-medium mt-0.5">{selected.colaborador?.setor} / {selected.colaborador?.funcao}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Matrícula</span>
                    <p className="font-medium mt-0.5">{selected.colaborador?.matricula}</p>
                  </div>
                </div>
              </div>

              {/* Item info */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Package size={11} /> Item Solicitado
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Produto</span>
                    <p className="font-medium mt-0.5">{selected.produto?.nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">CA</span>
                    <p className="font-medium mt-0.5">{selected.produto?.ca || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Quantidade</span>
                    <p className="font-medium mt-0.5">{selected.quantidade}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Motivo</span>
                    <p className="font-medium mt-0.5">{selected.motivo}</p>
                  </div>
                </div>
                {selected.observacao && (
                  <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    <span className="font-medium text-foreground">Obs:</span> {selected.observacao}
                  </p>
                )}
              </div>

              {/* Selfie + Signature side by side */}
              {(selected.selfie_base64 || selected.assinatura_base64) && (
                <div className="grid grid-cols-2 gap-3">
                  {selected.selfie_base64 && (
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Selfie</p>
                      <img src={selected.selfie_base64} alt="Selfie" className="max-h-28 rounded-lg border object-cover" />
                    </div>
                  )}
                  {selected.assinatura_base64 && (
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Assinatura</p>
                      <img src={selected.assinatura_base64} alt="Assinatura" className="max-h-20 border rounded-lg bg-background p-1" />
                    </div>
                  )}
                </div>
              )}

              {/* Audit info */}
              <div className="rounded-xl border bg-muted/10 p-3 text-[10px] text-muted-foreground space-y-1">
                <p className="font-bold uppercase tracking-widest mb-1.5">Auditoria</p>
                <p>Solicitado em: <span className="font-medium text-foreground">{formatDate(selected.created_at)}</span></p>
                <p>IP: <span className="font-mono">{selected.ip_origem || '—'}</span></p>
                {selected.declaracao_aceita && (
                  <p className="text-[hsl(var(--status-ok))] font-medium">✓ Declaração aceita pelo colaborador</p>
                )}
                {selected.pdf_hash && (
                  <p className="font-mono break-all">Hash: {selected.pdf_hash}</p>
                )}
              </div>

              {/* Actions for ENVIADA (pending approval) */}
              {selected.status === 'ENVIADA' && (
                <div className="border-t pt-4 space-y-3">
                  <Textarea
                    value={observacaoAprovacao}
                    onChange={e => setObservacaoAprovacao(e.target.value)}
                    placeholder="Observação de aprovação (opcional)"
                    className="text-xs resize-none"
                    rows={2}
                  />
                  <Textarea
                    value={motivoRejeicao}
                    onChange={e => setMotivoRejeicao(e.target.value)}
                    placeholder="Motivo da rejeição (obrigatório para reprovar)"
                    className="text-xs resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-1.5" onClick={() => handleApprove(selected)} disabled={processing}>
                      {processing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Aprovar
                    </Button>
                    <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => handleReject(selected)} disabled={processing}>
                      {processing ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                      Reprovar
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions for APROVADA - move to EM_SEPARACAO */}
              {selected.status === 'APROVADA' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Aprovada. Inicie a separação do item.</p>
                  <Button className="w-full gap-1.5" onClick={async () => {
                    setProcessing(true);
                    await supabase.from('solicitacoes_epi').update({ status: 'EM_SEPARACAO' } as any).eq('id', selected.id);
                    toast({ title: 'Status atualizado para Em Separação' });
                    setDetailOpen(false); await load(); setProcessing(false);
                  }} disabled={processing}>
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
                    Iniciar Separação
                  </Button>
                </div>
              )}

              {/* Actions for EM_SEPARACAO - move to BAIXADA_NO_ESTOQUE */}
              {selected.status === 'EM_SEPARACAO' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Item em separação. Confirme a baixa no estoque.</p>
                  <Button className="w-full gap-1.5" onClick={async () => {
                    setProcessing(true);
                    await supabase.from('solicitacoes_epi').update({ status: 'BAIXADA_NO_ESTOQUE' } as any).eq('id', selected.id);
                    toast({ title: 'Baixa no estoque registrada' });
                    setDetailOpen(false); await load(); setProcessing(false);
                  }} disabled={processing}>
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
                    Confirmar Baixa no Estoque
                  </Button>
                </div>
              )}

              {/* Actions for BAIXADA_NO_ESTOQUE - confirm delivery */}
              {selected.status === 'BAIXADA_NO_ESTOQUE' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Estoque baixado. Confirme a entrega ao colaborador.</p>
                  <Button className="w-full gap-1.5" onClick={() => handleDeliver(selected)} disabled={processing}>
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
                    Confirmar Entrega
                  </Button>
                </div>
              )}

              {/* Actions for ENTREGUE - confirm receipt */}
              {selected.status === 'ENTREGUE' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Entrega realizada. Aguardando confirmação do colaborador.</p>
                  <Button className="w-full gap-1.5" onClick={async () => {
                    setProcessing(true);
                    await supabase.from('solicitacoes_epi').update({ status: 'CONFIRMADA' } as any).eq('id', selected.id);
                    toast({ title: '✅ Recebimento confirmado!' });
                    setDetailOpen(false); await load(); setProcessing(false);
                  }} disabled={processing}>
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    Confirmar Recebimento
                  </Button>
                </div>
              )}

              {selected.status !== 'ENVIADA' && selected.motivo_rejeicao && (
                <div className="border-t pt-3">
                  <div className="text-xs bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] rounded-xl px-4 py-3">
                    <p className="font-bold text-[10px] uppercase tracking-widest mb-1">Motivo da rejeição</p>
                    <p>{selected.motivo_rejeicao}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
