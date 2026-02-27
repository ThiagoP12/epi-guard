import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, Package, Search, Loader2, ClipboardList, FileText, User, Calendar, Hash, Shield, ArrowRight, Building2 } from 'lucide-react';
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
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao_aprovacao: string | null;
  colaborador?: { nome: string; matricula: string; cpf: string | null; setor: string; funcao: string; email?: string | null };
  produto?: { nome: string; ca: string | null };
  empresa_nome?: string;
  aprovador_nome?: string;
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

  const insertAuditLog = async (evento: string, solicitacaoId: string, empresaId: string | null) => {
    try {
      await supabase.from('audit_logs').insert({
        evento,
        solicitacao_id: solicitacaoId,
        usuario_id: user?.id,
        unidade_id: empresaId,
        empresa_id: empresaId,
      } as any);
    } catch (e) {
      console.error('Audit log error:', e);
    }
  };

  const sendNotificationEmail = async (colaborador: Solicitacao['colaborador'], solicitacaoId: string, assunto: string, corpo: string) => {
    if (!colaborador?.email) return;
    try {
      await supabase.functions.invoke('notify-colaborador', {
        body: {
          colaborador_email: colaborador.email,
          colaborador_nome: colaborador.nome,
          assunto,
          corpo,
          solicitacao_id: solicitacaoId,
        },
      });
    } catch (e) {
      console.error('Email notification error:', e);
    }
  };

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
      const empresaIds = [...new Set(data.map(s => s.empresa_id).filter(Boolean))] as string[];
      const aprovadorIds = [...new Set(data.map(s => s.aprovado_por).filter(Boolean))] as string[];

      const [colabRes, prodRes, empresaRes, aprovadorRes] = await Promise.all([
        colabIds.length > 0 ? supabase.from('colaboradores').select('id, nome, matricula, cpf, setor, funcao, email').in('id', colabIds) : { data: [] },
        prodIds.length > 0 ? supabase.from('produtos').select('id, nome, ca').in('id', prodIds) : { data: [] },
        empresaIds.length > 0 ? supabase.from('empresas').select('id, nome').in('id', empresaIds) : { data: [] },
        aprovadorIds.length > 0 ? supabase.from('profiles').select('id, nome').in('id', aprovadorIds) : { data: [] },
      ]);

      const empresaMap = new Map((empresaRes.data || []).map(e => [e.id, e.nome]));
      const aprovadorMap = new Map((aprovadorRes.data || []).map(p => [p.id, p.nome]));

      const enriched = data.map(s => ({
        ...s,
        colaborador: colabRes.data?.find(c => c.id === s.colaborador_id) || undefined,
        produto: prodRes.data?.find(p => p.id === s.produto_id) || undefined,
        empresa_nome: s.empresa_id ? empresaMap.get(s.empresa_id) || '—' : '—',
        aprovador_nome: s.aprovado_por ? aprovadorMap.get(s.aprovado_por) || '—' : undefined,
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

  // Approve: only sets APROVADA, NO stock exit
  const handleApprove = async (sol: Solicitacao) => {
    setProcessing(true);
    try {
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

      await insertAuditLog('SOLICITACAO_APROVADA', sol.id, sol.empresa_id);

      // Send email notification
      await sendNotificationEmail(
        sol.colaborador,
        sol.id,
        'Solicitação de EPI aprovada',
        `<p>Sua solicitação de <strong>${sol.produto?.nome || 'EPI'}</strong> (Qtde: ${sol.quantidade}) foi <strong>aprovada</strong> e será separada pelo estoque.</p><p>Próximo passo: aguarde a separação e disponibilização do item.</p>`
      );

      toast({ title: 'Solicitação aprovada!', description: 'O colaborador será notificado.' });
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

      await insertAuditLog('SOLICITACAO_REPROVADA', sol.id, sol.empresa_id);

      toast({ title: 'Solicitação rejeitada' });
      setDetailOpen(false);
      setMotivoRejeicao('');
      await load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  // Separar: creates SAIDA + sets SEPARADO
  const handleSeparar = async (sol: Solicitacao) => {
    setProcessing(true);
    try {
      // Create stock exit
      const { error: movError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          produto_id: sol.produto_id,
          quantidade: sol.quantidade,
          tipo_movimentacao: 'SAIDA',
          colaborador_id: sol.colaborador_id,
          empresa_id: sol.empresa_id || null,
          usuario_id: user?.id,
          solicitacao_id: sol.id,
          motivo: `Separação - ${sol.produto?.nome || 'EPI'}`,
          observacao: `Solicitação #${sol.id.slice(0, 8)}`,
        } as any);
      if (movError) throw movError;

      // Update status to SEPARADO
      const { error } = await supabase
        .from('solicitacoes_epi')
        .update({ status: 'SEPARADO' } as any)
        .eq('id', sol.id);
      if (error) throw error;

      await insertAuditLog('SOLICITACAO_SEPARADO', sol.id, sol.empresa_id);

      // Send email notification
      await sendNotificationEmail(
        sol.colaborador,
        sol.id,
        'Atualização da sua solicitação de EPI',
        `<p>O item <strong>${sol.produto?.nome || 'EPI'}</strong> da sua solicitação já foi <strong>separado do estoque</strong> e está disponível para retirada.</p><p>Aguarde a entrega e a confirmação de recebimento.</p>`
      );

      toast({ title: '✅ Item separado!', description: 'Baixa no estoque registrada. Colaborador notificado.' });
      setDetailOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleStatusTransition = async (sol: Solicitacao, newStatus: string, evento: string, successMsg: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase.from('solicitacoes_epi').update({ status: newStatus } as any).eq('id', sol.id);
      if (error) throw error;
      await insertAuditLog(evento, sol.id, sol.empresa_id);
      toast({ title: successMsg });
      setDetailOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleDeliver = async (sol: Solicitacao) => {
    await handleStatusTransition(sol, 'ENTREGUE', 'SOLICITACAO_ENTREGUE', '✅ Entrega confirmada!');
  };

  const filtered = solicitacoes.filter(s =>
    !search || s.colaborador?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    s.produto?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    s.colaborador?.matricula?.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; label: string; accent: string }> = {
    CRIADA: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Criada', accent: 'border-l-muted-foreground' },
    ENVIADA: { icon: Clock, color: 'text-[hsl(var(--status-warning))]', bg: 'bg-[hsl(var(--status-warning-bg))]', label: 'Enviada', accent: 'border-l-[hsl(var(--status-warning))]' },
    APROVADA: { icon: CheckCircle, color: 'text-[hsl(var(--status-ok))]', bg: 'bg-[hsl(var(--status-ok-bg))]', label: 'Aprovada', accent: 'border-l-[hsl(var(--status-ok))]' },
    REPROVADA: { icon: XCircle, color: 'text-[hsl(var(--status-danger))]', bg: 'bg-[hsl(var(--status-danger-bg))]', label: 'Reprovada', accent: 'border-l-[hsl(var(--status-danger))]' },
    SEPARADO: { icon: Package, color: 'text-[hsl(280,60%,55%)]', bg: 'bg-[hsl(280,60%,55%)]/10', label: 'Separado', accent: 'border-l-[hsl(280,60%,55%)]' },
    ENTREGUE: { icon: Package, color: 'text-primary', bg: 'bg-primary/10', label: 'Entregue', accent: 'border-l-primary' },
    CONFIRMADA: { icon: CheckCircle, color: 'text-[hsl(var(--status-ok))]', bg: 'bg-[hsl(var(--status-ok-bg))]', label: 'Confirmada', accent: 'border-l-[hsl(var(--status-ok))]' },
  };

  const counts: Record<string, number> = {
    ENVIADA: allSolicitacoes.filter(s => s.status === 'ENVIADA').length,
    APROVADA: allSolicitacoes.filter(s => s.status === 'APROVADA').length,
    REPROVADA: allSolicitacoes.filter(s => s.status === 'REPROVADA').length,
    SEPARADO: allSolicitacoes.filter(s => s.status === 'SEPARADO').length,
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
        {(['ENVIADA', 'APROVADA', 'REPROVADA', 'SEPARADO', 'ENTREGUE', 'CONFIRMADA', 'todos'] as const).map(s => {
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
          placeholder="Buscar por nome, matrícula, produto ou ID..."
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
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{s.id.slice(0, 8).toUpperCase()}</span>
                      <p className="text-sm font-semibold text-foreground truncate">{s.colaborador?.nome || '—'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Package size={11} />{s.produto?.nome || '—'}</span>
                      <span className="flex items-center gap-1"><Building2 size={11} />{s.empresa_nome || '—'}</span>
                      <span>Qtd: {s.quantidade}</span>
                      {s.aprovador_nome && (
                        <span className="hidden sm:flex items-center gap-1"><User size={11} />Aprovado por: {s.aprovador_nome}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1">
                      {['SEPARADO', 'ENTREGUE', 'CONFIRMADA'].includes(s.status) && (
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
              {selected && <span className="text-xs text-muted-foreground font-mono ml-1">#{selected.id.slice(0, 8).toUpperCase()}</span>}
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
                    {['SEPARADO', 'ENTREGUE', 'CONFIRMADA'].includes(selected.status) && (
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

              {/* Timeline */}
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Linha do tempo</p>
                <SolicitacaoTimeline status={selected.status} />
              </div>

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
                  <div>
                    <span className="text-muted-foreground text-[10px]">Unidade</span>
                    <p className="font-medium mt-0.5">{selected.empresa_nome || '—'}</p>
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

              {/* Aprovação block */}
              {(selected.aprovado_por || ['APROVADA', 'REPROVADA', 'SEPARADO', 'ENTREGUE', 'CONFIRMADA'].includes(selected.status)) && (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Shield size={11} /> Aprovação
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Status</span>
                      <p className="font-medium mt-0.5">
                        {selected.status === 'REPROVADA' ? 'Reprovada' : 'Aprovada'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Aprovado por</span>
                      <p className="font-medium mt-0.5">{selected.aprovador_nome || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Data/Hora</span>
                      <p className="font-medium mt-0.5">{selected.aprovado_em ? formatDate(selected.aprovado_em) : '—'}</p>
                    </div>
                    {selected.observacao_aprovacao && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-[10px]">Observação do aprovador</span>
                        <p className="font-medium mt-0.5">{selected.observacao_aprovacao}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selfie + Signature */}
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

              {/* Actions for ENVIADA */}
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

              {/* Actions for APROVADA - separate stock */}
              {selected.status === 'APROVADA' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Aprovada. Separe o item e registre a baixa no estoque.</p>
                  <Button className="w-full gap-1.5" onClick={() => handleSeparar(selected)} disabled={processing}>
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
                    Separar e Dar Baixa no Estoque
                  </Button>
                </div>
              )}

              {/* Actions for SEPARADO - confirm delivery */}
              {selected.status === 'SEPARADO' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Item separado. Confirme a entrega ao colaborador.</p>
                  <Button className="w-full gap-1.5" onClick={() => handleDeliver(selected)} disabled={processing}>
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
                    Confirmar Entrega
                  </Button>
                </div>
              )}

              {/* Actions for ENTREGUE - confirm receipt */}
              {selected.status === 'ENTREGUE' && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Entrega realizada. Aguardando confirmação do colaborador (assinatura digital).</p>
                  <Button className="w-full gap-1.5" onClick={() => handleStatusTransition(selected, 'CONFIRMADA', 'SOLICITACAO_CONFIRMADA', '✅ Recebimento confirmado!')} disabled={processing}>
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

/* ── Timeline Component ── */
const TIMELINE_STEPS = [
  { key: 'ENVIADA', label: 'Enviada' },
  { key: 'APROVADA', label: 'Aprovada' },
  { key: 'SEPARADO', label: 'Separado' },
  { key: 'ENTREGUE', label: 'Entregue' },
  { key: 'CONFIRMADA', label: 'Confirmada' },
];

function SolicitacaoTimeline({ status }: { status: string }) {
  if (status === 'REPROVADA') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[hsl(var(--status-ok-bg))] flex items-center justify-center">
            <CheckCircle size={12} className="text-[hsl(var(--status-ok))]" />
          </div>
          <span className="text-[11px] font-medium text-foreground">Enviada</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[hsl(var(--status-danger-bg))] flex items-center justify-center">
            <XCircle size={12} className="text-[hsl(var(--status-danger))]" />
          </div>
          <span className="text-[11px] font-medium text-[hsl(var(--status-danger))]">Reprovada</span>
        </div>
      </div>
    );
  }

  const currentIndex = TIMELINE_STEPS.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-1">
      {TIMELINE_STEPS.map((step, i) => {
        const isCompleted = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0",
                isCompleted
                  ? "bg-[hsl(var(--status-ok-bg))]"
                  : "bg-muted"
              )}>
                {isCompleted ? (
                  <CheckCircle size={12} className="text-[hsl(var(--status-ok))]" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span className={cn(
                "text-[9px] font-medium text-center leading-tight",
                isCurrent ? "text-foreground font-bold" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/50"
              )}>
                {step.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={cn(
                "h-px flex-1 min-w-2 mt-[-12px]",
                i < currentIndex ? "bg-[hsl(var(--status-ok))]" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
