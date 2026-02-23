import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import SignatureCanvas from '@/components/SignatureCanvas';
import SelfieCapture from '@/components/SelfieCapture';
import {
  LogOut, Package, History, ClipboardCheck, CheckCircle, Clock, XCircle,
  Loader2, Shield, FileText, User, Building2, Hash, Briefcase, MapPin,
  Camera, PenTool, Send, ChevronRight, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Colaborador {
  id: string; nome: string; matricula: string; cpf: string | null; email: string | null;
  setor: string; funcao: string; empresa_id: string | null;
  empresa?: { nome: string } | null;
}
interface Produto { id: string; nome: string; ca: string | null; tipo: string; saldo: number; }
interface Solicitacao {
  id: string; produto_id: string; quantidade: number; motivo: string; observacao: string | null;
  status: string; created_at: string; motivo_rejeicao: string | null;
  produto?: { nome: string; ca: string | null };
}
interface EntregaItem { nome_snapshot: string; ca_snapshot: string | null; quantidade: number; }
interface Entrega {
  id: string; data_hora: string; motivo: string; observacao: string | null;
  itens: EntregaItem[];
}

export default function PortalColaborador() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'solicitar' | 'historico' | 'recebimentos'>('solicitar');
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('Solicitação');
  const [observacao, setObservacao] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [declaracao, setDeclaracao] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: colab } = await supabase
        .from('colaboradores')
        .select('id, nome, matricula, cpf, email, setor, funcao, empresa_id, empresas:empresa_id(nome)')
        .eq('user_id', user.id)
        .single();

      if (!colab) { setLoading(false); return; }
      const colabData = { ...colab, empresa: (colab as any).empresas } as Colaborador;
      setColaborador(colabData);

      let prodQuery = supabase.from('produtos').select('*').eq('ativo', true).order('nome');
      if (colabData.empresa_id) prodQuery = prodQuery.eq('empresa_id', colabData.empresa_id);
      const { data: prods } = await prodQuery;
      if (prods) {
        const withSaldo: Produto[] = [];
        for (const p of prods) {
          const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
          if (typeof saldo === 'number' && saldo > 0) {
            withSaldo.push({ id: p.id, nome: p.nome, ca: p.ca, tipo: p.tipo, saldo });
          }
        }
        setProdutos(withSaldo);
      }

      await loadSolicitacoes(colabData.id);
      await loadEntregas(colabData.id);
      setLoading(false);
    };
    load();
  }, [user]);

  const loadEntregas = async (colabId: string) => {
    const { data } = await supabase
      .from('entregas_epi')
      .select('id, data_hora, motivo, observacao')
      .eq('colaborador_id', colabId)
      .order('data_hora', { ascending: false });

    if (data && data.length > 0) {
      const entregaIds = data.map(e => e.id);
      const { data: itens } = await supabase
        .from('entrega_epi_itens')
        .select('entrega_id, nome_snapshot, ca_snapshot, quantidade')
        .in('entrega_id', entregaIds);

      const enriched: Entrega[] = data.map(e => ({
        ...e,
        itens: (itens?.filter(i => i.entrega_id === e.id) || []) as EntregaItem[],
      }));
      setEntregas(enriched);
    } else {
      setEntregas([]);
    }
  };

  const loadSolicitacoes = async (colabId: string) => {
    const { data } = await supabase
      .from('solicitacoes_epi')
      .select('id, produto_id, quantidade, motivo, observacao, status, created_at, motivo_rejeicao')
      .eq('colaborador_id', colabId)
      .order('created_at', { ascending: false });

    if (data) {
      const prodIds = [...new Set(data.map(s => s.produto_id))];
      const { data: prodsInfo } = await supabase
        .from('produtos')
        .select('id, nome, ca')
        .in('id', prodIds);

      const enriched = data.map(s => ({
        ...s,
        produto: prodsInfo?.find(p => p.id === s.produto_id) || undefined,
      }));
      setSolicitacoes(enriched);
    }
  };

  const handleSubmit = async () => {
    if (!produtoId || !assinatura || !selfie || !declaracao || !colaborador) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let ipOrigem = 'browser';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipOrigem = ipData.ip || 'browser';
      } catch { /* fallback */ }

      const timestamp = new Date().toISOString();
      const hashInput = `${assinatura}|${colaborador.id}|${produtoId}|${quantidade}|${motivo}|${timestamp}|${ipOrigem}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pdfHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('solicitacoes_epi').insert({
        colaborador_id: colaborador.id,
        empresa_id: colaborador.empresa_id,
        produto_id: produtoId,
        quantidade,
        motivo,
        observacao: observacao || null,
        assinatura_base64: assinatura,
        selfie_base64: selfie,
        declaracao_aceita: true,
        ip_origem: ipOrigem,
        user_agent: navigator.userAgent,
        pdf_hash: pdfHash,
      } as any);

      if (error) throw error;

      toast({ title: '✅ Solicitação enviada!', description: 'Aguarde a aprovação do gestor.' });
      setProdutoId('');
      setQuantidade(1);
      setMotivo('Solicitação');
      setObservacao('');
      setAssinatura(null);
      setSelfie(null);
      setDeclaracao(false);
      await loadSolicitacoes(colaborador.id);
      setActiveSection('historico');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const selectedProduct = produtos.find(p => p.id === produtoId);
  const pendingCount = solicitacoes.filter(s => s.status === 'pendente').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="h-10 w-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="text-center max-w-sm bg-card rounded-2xl border shadow-lg p-8">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Conta não vinculada</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Sua conta ainda não está vinculada a um cadastro de colaborador. Entre em contato com o administrador.</p>
          <Button variant="outline" className="mt-5 gap-2" onClick={signOut}>
            <LogOut size={15} /> Sair
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    pendente: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', label: 'Pendente' },
    aprovado: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', label: 'Aprovado' },
    rejeitado: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: 'Rejeitado' },
    entregue: { icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', label: 'Entregue' },
  };

  const navItems = [
    { key: 'solicitar' as const, label: 'Solicitar', icon: ClipboardCheck, badge: 0 },
    { key: 'historico' as const, label: 'Solicitações', icon: History, badge: pendingCount },
    { key: 'recebimentos' as const, label: 'Recebimentos', icon: Package, badge: entregas.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="bg-primary shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-primary-foreground/20">
                <Shield size={20} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-primary-foreground font-bold text-base leading-none">Portal do Colaborador</h1>
                <p className="text-primary-foreground/50 text-[11px] mt-0.5">{colaborador.empresa?.nome || 'Gestão EPI & EPC'}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-primary-foreground/60 hover:text-primary-foreground text-xs transition-colors px-3 py-2 rounded-lg hover:bg-primary-foreground/10"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 -mt-4 relative z-10">
        {/* Profile Card */}
        <div className="bg-card rounded-2xl border shadow-md p-5 mb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <User size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{colaborador.nome}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{colaborador.funcao} • {colaborador.setor}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoChip icon={Hash} label="Matrícula" value={colaborador.matricula} />
            <InfoChip icon={Shield} label="CPF" value={colaborador.cpf ? formatCpf(colaborador.cpf) : '—'} mono />
            <InfoChip icon={MapPin} label="Setor" value={colaborador.setor} />
            <InfoChip icon={Building2} label="Revenda" value={colaborador.empresa?.nome || '—'} />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 mb-5">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-medium transition-all duration-200 relative border',
                activeSection === item.key
                  ? 'bg-primary text-primary-foreground shadow-md border-primary'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent border-border hover:border-primary/30'
              )}
            >
              <item.icon size={17} />
              <span className="hidden sm:inline">{item.label}</span>
              {item.badge > 0 && (
                <span className={cn(
                  'absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center',
                  activeSection === item.key
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary text-primary-foreground'
                )}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="pb-8">
          {/* SOLICITAR */}
          {activeSection === 'solicitar' && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-primary/5 border-b px-5 py-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ClipboardCheck size={16} className="text-primary" />
                    Nova Solicitação de EPI
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Preencha os campos abaixo para solicitar um equipamento</p>
                </div>

                <div className="p-5 space-y-5">
                  {/* Product selection */}
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Item do Estoque *</Label>
                    <Select value={produtoId} onValueChange={setProdutoId}>
                      <SelectTrigger className="mt-1.5 h-11">
                        <SelectValue placeholder="Selecionar equipamento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <Package size={13} className="text-muted-foreground shrink-0" />
                              <span>{p.nome}</span>
                              {p.ca && <span className="text-muted-foreground text-[10px]">CA: {p.ca}</span>}
                              <span className="text-primary text-[10px] font-semibold ml-auto">({p.saldo} disp.)</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProduct && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border">
                        <Package size={13} className="text-primary shrink-0" />
                        <span><strong>{selectedProduct.nome}</strong> — Estoque disponível: <strong className="text-primary">{selectedProduct.saldo}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Quantidade *</Label>
                      <Input
                        type="number" min={1} max={selectedProduct?.saldo || 999}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Number(e.target.value))}
                        className="mt-1.5 h-11"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Motivo</Label>
                      <Select value={motivo} onValueChange={setMotivo}>
                        <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Solicitação', 'Troca por desgaste', 'Perda', 'Danificado'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground">Observação</Label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Descreva o motivo detalhado (opcional)"
                      className="mt-1.5 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Selfie */}
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-primary/5 border-b px-5 py-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Camera size={16} className="text-primary" />
                    Selfie do Colaborador *
                  </h3>
                </div>
                <div className="p-5">
                  <SelfieCapture onCaptureChange={setSelfie} />
                </div>
              </div>

              {/* Signature */}
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-primary/5 border-b px-5 py-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <PenTool size={16} className="text-primary" />
                    Assinatura Digital *
                  </h3>
                </div>
                <div className="p-5">
                  <SignatureCanvas onSignatureChange={setAssinatura} />
                </div>
              </div>

              {/* Declaration + Submit */}
              <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <Checkbox
                    id="declaracao"
                    checked={declaracao}
                    onCheckedChange={(v) => setDeclaracao(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="declaracao" className="text-[11px] text-foreground/80 leading-relaxed cursor-pointer">
                    <strong className="text-foreground">DECLARO</strong> que as informações prestadas são verdadeiras e que necessito do EPI solicitado para execução segura das minhas atividades.
                    Estou ciente de que a assinatura digital aqui aposta possui validade jurídica conforme a MP 2.200-2/2001 e que este documento é protegido por hash criptográfico SHA-256.
                  </label>
                </div>

                <Button
                  className="w-full h-12 text-sm font-bold rounded-xl gap-2"
                  onClick={handleSubmit}
                  disabled={submitting || !produtoId || !assinatura || !selfie || !declaracao}
                >
                  {submitting ? (
                    <><Loader2 size={17} className="animate-spin" /> Enviando solicitação...</>
                  ) : (
                    <><Send size={17} /> Enviar Solicitação</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* HISTÓRICO */}
          {activeSection === 'historico' && (
            <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {solicitacoes.length === 0 ? (
                <EmptyState icon={History} message="Nenhuma solicitação realizada ainda." />
              ) : (
                solicitacoes.map(s => {
                  const cfg = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pendente;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={s.id} className={cn('rounded-2xl border shadow-sm p-4 transition-colors', cfg.bg)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.produto?.nome || 'Produto'}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                            {s.produto?.ca && <span className="bg-background/50 px-1.5 py-0.5 rounded text-[10px] font-mono">CA: {s.produto.ca}</span>}
                            <span>Qtde: {s.quantidade}</span>
                            <span>•</span>
                            <span>{s.motivo}</span>
                          </p>
                        </div>
                        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0', cfg.color)}>
                          <StatusIcon size={13} />
                          {cfg.label}
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(s.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {s.motivo_rejeicao && (
                        <div className="mt-2 flex items-start gap-2 bg-red-100 dark:bg-red-950/40 rounded-lg px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                          <XCircle size={13} className="shrink-0 mt-0.5" />
                          <span>Motivo da rejeição: {s.motivo_rejeicao}</span>
                        </div>
                      )}
                      {s.observacao && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 italic">Obs: {s.observacao}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* RECEBIMENTOS */}
          {activeSection === 'recebimentos' && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {/* Summary */}
              {entregas.length > 0 && (() => {
                const totals = new Map<string, { nome: string; ca: string | null; total: number }>();
                entregas.forEach(e => e.itens.forEach(i => {
                  const prev = totals.get(i.nome_snapshot);
                  if (prev) prev.total += i.quantidade;
                  else totals.set(i.nome_snapshot, { nome: i.nome_snapshot, ca: i.ca_snapshot, total: i.quantidade });
                }));
                const items = [...totals.values()].sort((a, b) => b.total - a.total);
                const grandTotal = items.reduce((s, i) => s + i.total, 0);
                return (
                  <div className="bg-primary/5 rounded-2xl border border-primary/20 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Resumo de Recebimentos</h3>
                      <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{grandTotal} itens</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(item => (
                        <div key={item.nome} className="flex items-center justify-between bg-card rounded-xl px-3 py-2.5 border text-xs shadow-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block text-foreground">{item.nome}</span>
                            {item.ca && <span className="text-[10px] text-muted-foreground font-mono">CA: {item.ca}</span>}
                          </div>
                          <span className="font-bold text-primary ml-3 text-sm">{item.total}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {entregas.length === 0 ? (
                <EmptyState icon={Package} message="Nenhum equipamento recebido ainda." />
              ) : (
                entregas.map(e => (
                  <div key={e.id} className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b">
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="text-primary" />
                        <span className="text-sm font-semibold text-foreground">{e.motivo}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {format(new Date(e.data_hora), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="p-4 space-y-1.5">
                      {e.itens.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-muted/20 rounded-lg px-3 py-2.5 border">
                          <div className="flex items-center gap-2">
                            <Package size={13} className="text-muted-foreground" />
                            <span className="font-medium text-foreground">{item.nome_snapshot}</span>
                            {item.ca_snapshot && <span className="text-muted-foreground font-mono text-[10px]">CA: {item.ca_snapshot}</span>}
                          </div>
                          <span className="font-bold text-primary">{item.quantidade}×</span>
                        </div>
                      ))}
                    </div>
                    {e.observacao && (
                      <div className="px-5 pb-3">
                        <p className="text-[11px] text-muted-foreground italic">Obs: {e.observacao}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoChip({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-muted/40 rounded-xl px-3 py-2.5 border">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={cn('text-xs font-semibold text-foreground truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="bg-card rounded-2xl border shadow-sm py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
        <Icon size={24} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
