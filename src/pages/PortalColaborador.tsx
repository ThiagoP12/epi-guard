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
import { LogOut, Package, History, ClipboardCheck, CheckCircle, Clock, XCircle, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Colaborador {
  id: string; nome: string; matricula: string; cpf: string | null; email: string | null;
  setor: string; funcao: string; empresa_id: string | null;
}
interface Produto { id: string; nome: string; ca: string | null; tipo: string; saldo: number; }
interface Solicitacao {
  id: string; produto_id: string; quantidade: number; motivo: string; observacao: string | null;
  status: string; created_at: string; motivo_rejeicao: string | null;
  produto?: { nome: string; ca: string | null };
}

export default function PortalColaborador() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'solicitar' | 'historico'>('solicitar');
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
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
      // Get colaborador linked to this user
      const { data: colab } = await supabase
        .from('colaboradores')
        .select('id, nome, matricula, cpf, email, setor, funcao, empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!colab) { setLoading(false); return; }
      setColaborador(colab as Colaborador);

      // Load products with stock
      let prodQuery = supabase.from('produtos').select('*').eq('ativo', true).eq('tipo', 'EPI').order('nome');
      if (colab.empresa_id) prodQuery = prodQuery.eq('empresa_id', colab.empresa_id);
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

      // Load solicitations
      await loadSolicitacoes(colab.id);
      setLoading(false);
    };
    load();
  }, [user]);

  const loadSolicitacoes = async (colabId: string) => {
    const { data } = await supabase
      .from('solicitacoes_epi')
      .select('id, produto_id, quantidade, motivo, observacao, status, created_at, motivo_rejeicao')
      .eq('colaborador_id', colabId)
      .order('created_at', { ascending: false });

    if (data) {
      // Enrich with product info
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
      toast({ title: 'Atenção', description: 'Selecione o item, tire a selfie, assine e aceite a declaração.', variant: 'destructive' });
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

      toast({ title: 'Solicitação enviada!', description: 'Aguarde a aprovação do administrador.' });
      setProdutoId('');
      setQuantidade(1);
      setMotivo('Solicitação');
      setObservacao('');
      setAssinatura(null);
      setSelfie(null);
      setDeclaracao(false);
      await loadSolicitacoes(colaborador.id);
      setTab('historico');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const selectedProduct = produtos.find(p => p.id === produtoId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="text-center max-w-sm">
          <Shield size={40} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Conta não vinculada</h2>
          <p className="text-sm text-muted-foreground mt-2">Sua conta ainda não está vinculada a um cadastro de colaborador. Entre em contato com o administrador.</p>
          <Button variant="outline" className="mt-4" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  const statusIcon = (s: string) => {
    if (s === 'pendente') return <Clock size={14} className="text-yellow-500" />;
    if (s === 'aprovado') return <CheckCircle size={14} className="text-green-500" />;
    if (s === 'rejeitado') return <XCircle size={14} className="text-red-500" />;
    if (s === 'entregue') return <Package size={14} className="text-blue-500" />;
    return null;
  };
  const statusLabel = (s: string) => {
    if (s === 'pendente') return 'Pendente';
    if (s === 'aprovado') return 'Aprovado';
    if (s === 'rejeitado') return 'Rejeitado';
    if (s === 'entregue') return 'Entregue';
    return s;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="h-14 bg-primary flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
            <Shield size={18} className="text-primary-foreground" />
          </div>
          <span className="text-primary-foreground font-semibold text-sm">Portal do Colaborador</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-primary-foreground/90 text-sm font-medium leading-none">{colaborador.nome}</p>
            <p className="text-primary-foreground/50 text-[10px] mt-0.5">{colaborador.setor} • {colaborador.funcao}</p>
          </div>
          <button onClick={signOut} className="text-primary-foreground/60 hover:text-primary-foreground transition-colors p-1.5 rounded-md hover:bg-primary-foreground/10">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Info card */}
        <div className="bg-card rounded-xl border shadow-sm p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><span className="text-muted-foreground">Nome:</span><p className="font-medium">{colaborador.nome}</p></div>
            <div><span className="text-muted-foreground">Matrícula:</span><p className="font-medium">{colaborador.matricula}</p></div>
            <div><span className="text-muted-foreground">CPF:</span><p className="font-medium font-mono">{colaborador.cpf || '—'}</p></div>
            <div><span className="text-muted-foreground">E-mail:</span><p className="font-medium">{colaborador.email || '—'}</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button variant={tab === 'solicitar' ? 'default' : 'outline'} size="sm" onClick={() => setTab('solicitar')} className="gap-1.5">
            <ClipboardCheck size={14} /> Solicitar EPI
          </Button>
          <Button variant={tab === 'historico' ? 'default' : 'outline'} size="sm" onClick={() => setTab('historico')} className="gap-1.5">
            <History size={14} /> Minhas Solicitações
            {solicitacoes.filter(s => s.status === 'pendente').length > 0 && (
              <span className="ml-1 bg-yellow-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {solicitacoes.filter(s => s.status === 'pendente').length}
              </span>
            )}
          </Button>
        </div>

        {tab === 'solicitar' && (
          <div className="bg-card rounded-xl border shadow-sm p-5 space-y-5">
            <div>
              <Label className="text-xs font-medium">EPI Desejado *</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecionar item..." /></SelectTrigger>
                <SelectContent>
                  {produtos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} — CA: {p.ca || 'N/A'} (Disponível: {p.saldo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Quantidade *</Label>
                <Input type="number" min={1} max={selectedProduct?.saldo || 999} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="mt-1.5 h-10" />
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
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Motivo detalhado (opcional)" className="mt-1.5" rows={2} />
            </div>

            <div>
              <Label className="text-xs font-medium mb-2 block">Selfie de Verificação *</Label>
              <SelfieCapture onCaptureChange={setSelfie} />
            </div>

            <div>
              <Label className="text-xs font-medium mb-2 block">Assinatura Digital *</Label>
              <SignatureCanvas onSignatureChange={setAssinatura} />
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-muted">
              <Checkbox id="declaracao" checked={declaracao} onCheckedChange={(v) => setDeclaracao(v === true)} className="mt-0.5" />
              <label htmlFor="declaracao" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
                <strong>DECLARO</strong> que as informações prestadas são verdadeiras e que necessito do EPI solicitado para execução segura de minhas atividades.
                Estou ciente de que a assinatura digital aqui aposta possui validade jurídica conforme a MP 2.200-2/2001 e que este documento é protegido por hash criptográfico SHA-256.
              </label>
            </div>

            <Button className="w-full h-11 text-sm font-semibold" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Enviando...
                </span>
              ) : (
                <><ClipboardCheck size={17} className="mr-2" /> Enviar Solicitação</>
              )}
            </Button>
          </div>
        )}

        {tab === 'historico' && (
          <div className="space-y-3">
            {solicitacoes.length === 0 ? (
              <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
                <History size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma solicitação realizada.</p>
              </div>
            ) : (
              solicitacoes.map(s => (
                <div key={s.id} className="bg-card rounded-xl border shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.produto?.nome || 'Produto'}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        CA: {s.produto?.ca || 'N/A'} • Qtde: {s.quantidade} • {s.motivo}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(s.status)}
                      <span className={cn("text-xs font-medium",
                        s.status === 'pendente' && 'text-yellow-600',
                        s.status === 'aprovado' && 'text-green-600',
                        s.status === 'rejeitado' && 'text-red-600',
                        s.status === 'entregue' && 'text-blue-600',
                      )}>{statusLabel(s.status)}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(s.created_at).toLocaleString('pt-BR')}
                  </p>
                  {s.motivo_rejeicao && (
                    <p className="text-[11px] text-red-600 mt-1 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                      Motivo: {s.motivo_rejeicao}
                    </p>
                  )}
                  {s.observacao && (
                    <p className="text-[11px] text-muted-foreground mt-1">Obs: {s.observacao}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
