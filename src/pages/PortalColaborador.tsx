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
import ComprovanteSolicitacao from '@/components/ComprovanteSolicitacao';
import {
  LogOut, Package, History, ClipboardCheck, CheckCircle, Clock, XCircle,
  Loader2, Shield, FileText, User, Building2, Hash, MapPin,
  Camera, PenTool, Send, AlertTriangle, HardHat, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Colaborador {
  id: string; nome: string; matricula: string; cpf: string | null; email: string | null;
  setor: string; funcao: string; empresa_id: string | null;
  empresa?: { nome: string } | null;
}
interface Produto { id: string; nome: string; ca: string | null; tipo: string; saldo: number; tamanho: string | null; marca: string | null; }
interface Solicitacao {
  id: string; produto_id: string; quantidade: number; motivo: string; observacao: string | null;
  status: string; created_at: string; motivo_rejeicao: string | null;
  aprovado_em?: string | null;
  assinatura_base64?: string | null;
  selfie_base64?: string | null;
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
  const [comprovanteOpen, setComprovanteOpen] = useState(false);
  const [comprovanteSolicitacao, setComprovanteSolicitacao] = useState<Solicitacao | null>(null);

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
            withSaldo.push({ id: p.id, nome: p.nome, ca: p.ca, tipo: p.tipo, saldo, tamanho: p.tamanho, marca: p.marca });
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
      .select('id, produto_id, quantidade, motivo, observacao, status, created_at, motivo_rejeicao, aprovado_em, assinatura_base64, selfie_base64')
      .eq('colaborador_id', colabId)
      .order('created_at', { ascending: false });

    if (data) {
      const prodIds = [...new Set(data.map(s => s.produto_id))];
      let prodsInfo: { id: string; nome: string; ca: string | null }[] = [];
      if (prodIds.length > 0) {
        const { data: prods } = await supabase
          .from('produtos')
          .select('id, nome, ca')
          .in('id', prodIds);
        prodsInfo = prods || [];
      }

      const enriched = data.map(s => ({
        ...s,
        produto: prodsInfo.find(p => p.id === s.produto_id) || undefined,
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm bg-card rounded-xl border shadow-sm p-8">
          <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-destructive" />
          </div>
          <h2 className="text-base font-bold text-foreground">Conta não vinculada</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Sua conta ainda não está vinculada a um cadastro de colaborador. Entre em contato com o administrador.
          </p>
          <Button variant="outline" className="mt-6 gap-2" onClick={signOut}>
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
    { key: 'solicitar' as const, label: 'Nova Solicitação', icon: ClipboardCheck, badge: 0 },
    { key: 'historico' as const, label: 'Minhas Solicitações', icon: History, badge: pendingCount },
    { key: 'recebimentos' as const, label: 'Recebimentos', icon: Package, badge: entregas.length },
  ];

  const initials = colaborador.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="bg-primary sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <HardHat size={18} className="text-primary-foreground" />
              <span className="text-sm font-bold text-primary-foreground">Portal EPI</span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground text-xs transition-colors px-2.5 py-1.5 rounded-md hover:bg-primary-foreground/10"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        {/* Welcome */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">
                {colaborador.nome}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {colaborador.funcao} • {colaborador.setor}
                {colaborador.empresa?.nome && <> • {colaborador.empresa.nome}</>}
              </p>
            </div>
          </div>

          {/* Info pills */}
          <div className="flex flex-wrap gap-2">
            <InfoPill icon={Hash} label="Matrícula" value={colaborador.matricula} />
            <InfoPill icon={Shield} label="Versão" value="1.0.0" />
            <InfoPill icon={MapPin} label="Setor" value={colaborador.setor} />
            <InfoPill icon={Building2} label="Revenda" value={colaborador.empresa?.nome || '—'} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            label="Solicitações"
            value={solicitacoes.length}
            detail={pendingCount > 0 ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'Nenhuma pendente'}
            accent={pendingCount > 0}
          />
          <StatCard
            label="Recebimentos"
            value={entregas.length}
            detail={entregas.length > 0 ? `Último: ${format(new Date(entregas[0].data_hora), 'dd/MM')}` : 'Nenhum ainda'}
          />
          <StatCard
            label="Estoque Disponível"
            value={produtos.length}
            detail="Itens disponíveis"
          />
        </div>

        {/* Tab Navigation */}
        <div className="border-b mb-6">
          <div className="flex gap-0">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                  activeSection === item.key
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon size={15} />
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge}
                  </span>
                )}
                {activeSection === item.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        <div className="pb-10">
          {/* SOLICITAR */}
          {activeSection === 'solicitar' && (
            <div className="space-y-6 animate-in fade-in-0 duration-200">
              {/* Form Card */}
              <section className="bg-card rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-sm font-semibold text-foreground">Dados da Solicitação</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione o item e preencha as informações</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Item do Estoque *</Label>
                    <Select value={produtoId} onValueChange={setProdutoId}>
                      <SelectTrigger className="mt-1.5 h-10">
                        <SelectValue placeholder="Selecionar equipamento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{p.nome}</span>
                              {p.tamanho && <span className="text-muted-foreground text-[10px] bg-muted px-1.5 py-0.5 rounded">Tam: {p.tamanho}</span>}
                              {p.marca && <span className="text-muted-foreground text-[10px]">({p.marca})</span>}
                              {p.ca && <span className="text-muted-foreground text-[10px] font-mono">CA: {p.ca}</span>}
                              <span className="text-primary text-[10px] font-semibold ml-auto">{p.saldo} un</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProduct && (
                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Disponível: <strong className="text-primary">{selectedProduct.saldo} un</strong></span>
                        {selectedProduct.tamanho && <span>• Tamanho: <strong>{selectedProduct.tamanho}</strong></span>}
                        {selectedProduct.marca && <span>• Marca: <strong>{selectedProduct.marca}</strong></span>}
                        {selectedProduct.ca && <span>• CA: <strong>{selectedProduct.ca}</strong></span>}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium">Quantidade *</Label>
                      <Input
                        type="number" min={1} max={selectedProduct?.saldo || 999}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Number(e.target.value))}
                        className="mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Motivo</Label>
                      <Select value={motivo} onValueChange={setMotivo}>
                        <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Solicitação', 'Troca por desgaste', 'Perda', 'Danificado'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Observação</Label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Descreva o motivo detalhado (opcional)"
                      className="mt-1.5 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </section>

              {/* Selfie */}
              <section className="bg-card rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Camera size={14} className="text-primary" />
                    Selfie do Colaborador
                  </h3>
                </div>
                <div className="p-5">
                  <SelfieCapture onCaptureChange={setSelfie} />
                </div>
              </section>

              {/* Signature */}
              <section className="bg-card rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <PenTool size={14} className="text-primary" />
                    Assinatura Digital
                  </h3>
                </div>
                <div className="p-5">
                  <SignatureCanvas onSignatureChange={setAssinatura} />
                </div>
              </section>

              {/* Declaration + Submit */}
              <section className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/50 border">
                  <Checkbox
                    id="declaracao"
                    checked={declaracao}
                    onCheckedChange={(v) => setDeclaracao(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="declaracao" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
                    <strong className="text-foreground">DECLARO</strong> que as informações prestadas são verdadeiras e que necessito do EPI solicitado para execução segura das minhas atividades.
                    Estou ciente de que a assinatura digital aqui aposta possui validade jurídica conforme a MP 2.200-2/2001 e que este documento é protegido por hash criptográfico SHA-256.
                  </label>
                </div>

                <Button
                  className="w-full h-11 text-sm font-semibold gap-2"
                  onClick={handleSubmit}
                  disabled={submitting || !produtoId || !assinatura || !selfie || !declaracao}
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                  ) : (
                    <><Send size={16} /> Enviar Solicitação</>
                  )}
                </Button>
              </section>
            </div>
          )}

          {/* HISTÓRICO */}
          {activeSection === 'historico' && (
            <div className="space-y-3 animate-in fade-in-0 duration-200">
              {solicitacoes.length === 0 ? (
                <EmptyState icon={History} message="Nenhuma solicitação realizada ainda." sub="Suas solicitações de EPI aparecerão aqui." />
              ) : (
                solicitacoes.map(s => {
                  const cfg = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pendente;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={s.id} className="bg-card rounded-xl border shadow-sm p-4 transition-colors hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.produto?.nome || 'Produto'}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            {s.produto?.ca && <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">CA: {s.produto.ca}</span>}
                            <span>Qtde: {s.quantidade}</span>
                            <span className="text-border">|</span>
                            <span>{s.motivo}</span>
                          </div>
                        </div>
                        <span className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 border',
                          cfg.bg, cfg.color
                        )}>
                          <StatusIcon size={12} />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(s.created_at).toLocaleString('pt-BR')}
                        </span>
                        {(s.status === 'aprovado' || s.status === 'entregue') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2"
                            onClick={() => { setComprovanteSolicitacao(s); setComprovanteOpen(true); }}
                          >
                            <Eye size={12} /> Comprovante
                          </Button>
                        )}
                      </div>

                      {s.motivo_rejeicao && (
                        <div className="mt-2 flex items-start gap-2 bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 text-[11px] text-destructive">
                          <XCircle size={12} className="shrink-0 mt-0.5" />
                          <span>Motivo: {s.motivo_rejeicao}</span>
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
            <div className="space-y-4 animate-in fade-in-0 duration-200">
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
                  <div className="bg-card rounded-xl border shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Resumo Total</h3>
                      <span className="text-xs font-bold text-primary">{grandTotal} itens recebidos</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(item => (
                        <div key={item.nome} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground truncate block">{item.nome}</span>
                            {item.ca && <span className="text-[10px] text-muted-foreground font-mono">CA: {item.ca}</span>}
                          </div>
                          <span className="font-bold text-primary ml-3">{item.total}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {entregas.length === 0 ? (
                <EmptyState icon={Package} message="Nenhum equipamento recebido." sub="Quando você receber EPIs, eles aparecerão aqui." />
              ) : (
                entregas.map(e => (
                  <div key={e.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
                      <span className="text-sm font-medium text-foreground">{e.motivo}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {format(new Date(e.data_hora), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="p-4 space-y-1.5">
                      {e.itens.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Package size={12} className="text-muted-foreground" />
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
      </main>

      <ComprovanteSolicitacao
        open={comprovanteOpen}
        onClose={() => { setComprovanteOpen(false); setComprovanteSolicitacao(null); }}
        data={comprovanteSolicitacao && colaborador ? {
          colaborador: {
            nome: colaborador.nome,
            matricula: colaborador.matricula,
            setor: colaborador.setor,
            funcao: colaborador.funcao,
            empresa: colaborador.empresa?.nome,
          },
          solicitacao: {
            id: comprovanteSolicitacao.id,
            produto_nome: comprovanteSolicitacao.produto?.nome || 'Produto',
            produto_ca: comprovanteSolicitacao.produto?.ca || null,
            quantidade: comprovanteSolicitacao.quantidade,
            motivo: comprovanteSolicitacao.motivo,
            status: comprovanteSolicitacao.status,
            created_at: comprovanteSolicitacao.created_at,
            aprovado_em: comprovanteSolicitacao.aprovado_em,
            assinatura_base64: comprovanteSolicitacao.assinatura_base64,
            selfie_base64: comprovanteSolicitacao.selfie_base64,
          },
        } : null}
      />
    </div>
  );
}

/* ── Sub-components ── */

function InfoPill({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-muted/50 border rounded-full px-3 py-1 text-xs text-muted-foreground">
      <Icon size={11} />
      <span className="font-medium">{label}:</span>
      <span className={cn('text-foreground font-semibold', mono && 'font-mono text-[11px]')}>{value}</span>
    </span>
  );
}

function StatCard({ label, value, detail, accent }: { label: string; value: number; detail: string; accent?: boolean }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-4 text-center">
      <p className={cn('text-2xl font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: any; message: string; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
        <Icon size={20} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
