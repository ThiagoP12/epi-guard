import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, FileDown, Loader2, Search, Package, User, ClipboardList, PenLine, ChevronRight, ChevronLeft, Trash2, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import SignatureCanvas from '@/components/SignatureCanvas';
import SelfieCapture from '@/components/SelfieCapture';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { cn } from '@/lib/utils';

const motivos = ['Primeira entrega', 'Troca por desgaste', 'Perda', 'Danificado', 'Outro'] as const;

interface Produto { id: string; nome: string; ca: string | null; tipo: string; saldo: number; data_validade: string | null; custo_unitario: number; }
interface CartItem { produto: Produto; quantidade: number; }
interface ColabInfo { id: string; nome: string; matricula: string; cpf: string | null; email: string | null; setor: string; funcao: string; }

interface EntregaEPIFormProps {
  /** Pre-selected colaborador – skips step 1 */
  colaborador?: ColabInfo;
  /** Called after successful delivery */
  onComplete?: () => void;
}

const STEPS_FULL = [
  { id: 1, label: 'Colaborador', icon: User },
  { id: 2, label: 'Itens', icon: Package },
  { id: 3, label: 'Revisão & Assinatura', icon: PenLine },
];
const STEPS_SHORT = [
  { id: 2, label: 'Itens', icon: Package },
  { id: 3, label: 'Revisão & Assinatura', icon: PenLine },
];

export default function EntregaEPIForm({ colaborador: presetColab, onComplete }: EntregaEPIFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();

  const hasPreset = !!presetColab;
  const STEPS = hasPreset ? STEPS_SHORT : STEPS_FULL;

  const [step, setStep] = useState(hasPreset ? 2 : 1);
  const [colaboradores, setColaboradores] = useState<ColabInfo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1 - Colaborador
  const [colaboradorId, setColaboradorId] = useState(presetColab?.id || '');
  const [colabSearch, setColabSearch] = useState('');

  // Step 2 - Itens
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addProdutoId, setAddProdutoId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [prodSearch, setProdSearch] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');

  // Step 3 - Assinatura
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [declaracao, setDeclaracao] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [lastEntregaId, setLastEntregaId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!hasPreset) {
        let colabQuery = supabase.from('colaboradores').select('id, nome, matricula, cpf, email, setor, funcao').eq('ativo', true).order('nome');
        if (selectedEmpresa) colabQuery = colabQuery.eq('empresa_id', selectedEmpresa.id);
        const { data: colabs } = await colabQuery;
        if (colabs) setColaboradores(colabs as ColabInfo[]);
      }

      let prodQuery = supabase.from('produtos').select('*').eq('ativo', true).order('nome');
      if (selectedEmpresa) prodQuery = prodQuery.eq('empresa_id', selectedEmpresa.id);
      const { data: prods } = await prodQuery;
      if (prods) {
        const withSaldo: Produto[] = [];
        for (const p of prods) {
          const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
          if (typeof saldo === 'number' && saldo > 0) {
            withSaldo.push({ id: p.id, nome: p.nome, ca: p.ca, tipo: p.tipo, saldo, data_validade: p.data_validade, custo_unitario: Number(p.custo_unitario) || 0 });
          }
        }
        setProdutos(withSaldo);
      }
      setLoading(false);
    };
    load();
  }, [selectedEmpresa, hasPreset]);

  const selectedColab = presetColab || colaboradores.find(c => c.id === colaboradorId);

  const filteredColabs = useMemo(() => {
    if (!colabSearch) return colaboradores;
    const s = colabSearch.toLowerCase();
    return colaboradores.filter(c => c.nome.toLowerCase().includes(s) || c.matricula.toLowerCase().includes(s) || c.setor.toLowerCase().includes(s));
  }, [colaboradores, colabSearch]);

  const availableProducts = useMemo(() => {
    const cartIds = new Set(cart.map(i => i.produto.id));
    let list = produtos.filter(p => !cartIds.has(p.id));
    if (prodSearch) {
      const s = prodSearch.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(s) || (p.ca || '').toLowerCase().includes(s));
    }
    return list;
  }, [produtos, cart, prodSearch]);

  const cartTotal = cart.reduce((sum, i) => sum + i.quantidade * i.produto.custo_unitario, 0);

  const addToCart = () => {
    const prod = produtos.find(p => p.id === addProdutoId);
    if (!prod) return;
    if (addQty > prod.saldo) {
      toast({ title: 'Saldo insuficiente', description: `Disponível: ${prod.saldo}`, variant: 'destructive' });
      return;
    }
    setCart(prev => [...prev, { produto: prod, quantidade: addQty }]);
    setAddProdutoId('');
    setAddQty(1);
    setProdSearch('');
  };

  const removeFromCart = (prodId: string) => setCart(prev => prev.filter(i => i.produto.id !== prodId));

  const updateCartQty = (prodId: string, qty: number) => {
    setCart(prev => prev.map(i => i.produto.id === prodId ? { ...i, quantidade: Math.max(1, Math.min(qty, i.produto.saldo)) } : i));
  };

  const canAdvance = (s: number) => {
    if (s === 1) return !!colaboradorId;
    if (s === 2) return cart.length > 0 && !!motivo;
    return true;
  };

  const handleDownloadPdf = async (entregaId: string) => {
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-nr06-pdf', { body: { entregaId } });
      if (error) throw error;
      if (!data?.url) throw new Error('URL do documento não retornada');
      const win = window.open(data.url, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = data.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    }
    setDownloadingPdf(false);
  };

  const handleSubmit = async () => {
    const colabId = presetColab?.id || colaboradorId;
    if (!colabId || cart.length === 0 || !motivo || !assinatura || !selfie || !declaracao || !user) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos, tire a selfie, assine e aceite a declaração.', variant: 'destructive' });
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
      const hashInput = `${assinatura}|${colabId}|${cart.map(i => i.produto.id).join(',')}|${timestamp}|${ipOrigem}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pdfHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: entrega, error: entregaError } = await supabase.from('entregas_epi').insert({
        colaborador_id: colabId,
        usuario_id: user.id,
        motivo: motivo as any,
        observacao: observacao || null,
        assinatura_base64: assinatura,
        selfie_base64: selfie,
        declaracao_aceita: true,
        ip_origem: ipOrigem,
        user_agent: navigator.userAgent,
        versao_termo: '2.0',
        empresa_id: selectedEmpresa?.id || null,
        pdf_hash: pdfHash,
      } as any).select('id').single();

      if (entregaError) throw entregaError;

      const itensPayload = cart.map(i => ({
        entrega_id: entrega.id,
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        nome_snapshot: i.produto.nome,
        ca_snapshot: i.produto.ca,
        validade_snapshot: i.produto.data_validade,
        custo_unitario_snapshot: i.produto.custo_unitario,
      }));
      const { error: itemError } = await supabase.from('entrega_epi_itens').insert(itensPayload);
      if (itemError) throw itemError;

      const movPayload = cart.map(i => ({
        produto_id: i.produto.id,
        tipo_movimentacao: 'SAIDA' as const,
        quantidade: i.quantidade,
        motivo: `Entrega EPI: ${motivo}`,
        usuario_id: user.id,
        colaborador_id: colabId,
        entrega_id: entrega.id,
        empresa_id: selectedEmpresa?.id || null,
        assinatura_base64: assinatura,
      }));
      const { error: movError } = await supabase.from('movimentacoes_estoque').insert(movPayload);
      if (movError) throw movError;

      try {
        const colab = selectedColab;
        await supabase.functions.invoke('send-entrega-email', {
          body: {
            entregaId: entrega.id,
            colaboradorNome: colab?.nome,
            colaboradorEmail: colab?.email,
            itens: cart.map(i => ({ nome: i.produto.nome, ca: i.produto.ca, quantidade: i.quantidade })),
          },
        });
      } catch { /* email optional */ }

      toast({ title: 'Entrega registrada!', description: `${cart.length} item(ns) entregues com sucesso.` });
      setLastEntregaId(entrega.id);
      setStep(4);
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setStep(hasPreset ? 2 : 1);
    if (!hasPreset) {
      setColaboradorId('');
      setColabSearch('');
    }
    setCart([]);
    setAddProdutoId('');
    setAddQty(1);
    setProdSearch('');
    setMotivo('');
    setObservacao('');
    setAssinatura(null);
    setSelfie(null);
    setDeclaracao(false);
    setLastEntregaId(null);
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stepper */}
      {step <= 3 && (
        <div className="flex items-center gap-1">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  onClick={() => isDone && setStep(s.id)}
                  disabled={!isDone}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    isDone && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/15",
                    !isActive && !isDone && "bg-muted text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                    isActive && "bg-primary-foreground/20",
                    isDone && "bg-primary/20",
                    !isActive && !isDone && "bg-muted-foreground/10"
                  )}>
                    {isDone ? <CheckCircle size={14} /> : <Icon size={14} />}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && <ChevronRight size={14} className="text-muted-foreground/40 mx-1 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 1: Colaborador (only if no preset) */}
      {step === 1 && !hasPreset && (
        <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <User size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Selecione o Colaborador</h2>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, matrícula ou setor..." value={colabSearch} onChange={e => setColabSearch(e.target.value)} className="pl-9 h-10" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1.5">
            {filteredColabs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhum colaborador encontrado.</p>
            ) : filteredColabs.map(c => (
              <button
                key={c.id}
                onClick={() => setColaboradorId(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3",
                  colaboradorId === c.id ? "bg-primary/10 border border-primary/30 shadow-sm" : "hover:bg-muted/60"
                )}
              >
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", colaboradorId === c.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <span className="text-[11px] font-bold">{c.nome.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{c.matricula} • {c.setor} • {c.funcao}</p>
                </div>
                {colaboradorId === c.id && <CheckCircle size={16} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
          {selectedColab && (
            <div className="bg-muted/40 rounded-lg p-3 border text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">{selectedColab.nome}</p>
              <p>{selectedColab.setor} • {selectedColab.funcao}</p>
              {selectedColab.cpf && <p className="font-mono">CPF: {selectedColab.cpf}</p>}
              {selectedColab.email && <p>{selectedColab.email}</p>}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={!canAdvance(1)} className="gap-1.5">
              Próximo <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Itens */}
      {step === 2 && (
        <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Adicionar Itens</h2>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground ml-auto">{cart.length} item(ns)</span>
          </div>

          <div className="space-y-2 p-3 rounded-lg border border-dashed bg-muted/20">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar produto por nome ou CA..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} className="pl-9 h-9 text-xs" />
            </div>
            <div className="flex gap-2">
              <Select value={addProdutoId} onValueChange={setAddProdutoId}>
                <SelectTrigger className="flex-1 h-9 text-xs"><SelectValue placeholder="Selecionar item..." /></SelectTrigger>
                <SelectContent>
                  {availableProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", p.tipo === 'EPI' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600')}>{p.tipo}</span>
                        {p.nome} {p.ca ? `(CA: ${p.ca})` : ''} — Saldo: {p.saldo}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" min={1} max={produtos.find(p => p.id === addProdutoId)?.saldo || 999} value={addQty} onChange={e => setAddQty(Number(e.target.value))} className="w-20 h-9 text-xs text-center" />
              <Button size="sm" variant="secondary" className="h-9 px-3" onClick={addToCart} disabled={!addProdutoId}>
                <Plus size={14} />
              </Button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="space-y-1.5">
              {cart.map((item, idx) => (
                <div key={item.produto.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.produto.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.produto.tipo} {item.produto.ca ? `• CA: ${item.produto.ca}` : ''} • Saldo: {item.produto.saldo}
                      {item.produto.data_validade && (
                        <span className={cn("ml-1", new Date(item.produto.data_validade) < new Date() && "text-destructive font-medium")}>
                          • Val: {new Date(item.produto.data_validade).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateCartQty(item.produto.id, item.quantidade - 1)}>−</Button>
                    <span className="text-sm font-bold tabular-nums w-6 text-center">{item.quantidade}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateCartQty(item.produto.id, item.quantidade + 1)}>+</Button>
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right hidden sm:block">{formatCurrency(item.quantidade * item.produto.custo_unitario)}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(item.produto.id)}><Trash2 size={14} /></Button>
                </div>
              ))}
              <div className="flex justify-end px-3 pt-1">
                <span className="text-xs text-muted-foreground">Total estimado: <span className="font-semibold text-foreground">{formatCurrency(cartTotal)}</span></span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <Label className="text-xs font-medium">Motivo da Entrega *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecionar motivo..." /></SelectTrigger>
                <SelectContent>
                  {motivos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Observação</Label>
              <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" className="mt-1.5" rows={2} />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            {!hasPreset && (
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                <ChevronLeft size={15} /> Voltar
              </Button>
            )}
            <Button onClick={() => setStep(3)} disabled={!canAdvance(2)} className={cn("gap-1.5", hasPreset && "ml-auto")}>
              Próximo <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Revisão & Assinatura */}
      {step === 3 && (
        <div className="bg-card rounded-xl border shadow-sm p-5 space-y-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Revisão & Assinatura</h2>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b">
              <p className="text-xs font-semibold text-foreground">Colaborador</p>
            </div>
            <div className="px-4 py-3 text-sm">
              <p className="font-medium">{selectedColab?.nome}</p>
              <p className="text-xs text-muted-foreground">{selectedColab?.matricula} • {selectedColab?.setor} • {selectedColab?.funcao}</p>
              {selectedColab?.cpf && <p className="text-xs text-muted-foreground font-mono mt-0.5">CPF: {selectedColab.cpf}</p>}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Itens ({cart.length})</p>
              <p className="text-xs text-muted-foreground">Motivo: <span className="font-medium text-foreground">{motivo}</span></p>
            </div>
            <div className="divide-y">
              {cart.map(item => (
                <div key={item.produto.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.produto.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{item.produto.tipo} {item.produto.ca ? `• CA: ${item.produto.ca}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-bold">{item.quantidade}x</p>
                    <p className="text-[10px] text-muted-foreground">{formatCurrency(item.quantidade * item.produto.custo_unitario)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-muted/40 px-4 py-2 border-t flex justify-between text-xs">
              <span className="text-muted-foreground">Total estimado</span>
              <span className="font-semibold text-foreground">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          {observacao && (
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Obs:</span> {observacao}
            </div>
          )}

          {cart.some(i => i.produto.data_validade && new Date(i.produto.data_validade) < new Date()) && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Atenção: há item(ns) com validade expirada na entrega.</span>
            </div>
          )}

          <div>
            <SelfieCapture onCaptureChange={setSelfie} label="Selfie de Verificação do Colaborador *" />
          </div>

          <div>
            <Label className="text-xs font-medium mb-2 block">Assinatura Digital do Colaborador *</Label>
            <SignatureCanvas onSignatureChange={setAssinatura} />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-muted">
            <Checkbox id="declaracao-entrega" checked={declaracao} onCheckedChange={(v) => setDeclaracao(v === true)} className="mt-0.5" />
            <label htmlFor="declaracao-entrega" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
              <strong>DECLARO</strong>, para todos os fins de direito, que recebi os Equipamentos de Proteção Individual (EPI) listados acima,
              em perfeito estado de conservação e funcionamento. Fui devidamente orientado(a) e treinado(a) sobre o uso correto, guarda,
              conservação e higienização dos mesmos, conforme determina a NR-06 (Portaria MTb nº 3.214/78).
              <strong> COMPROMETO-ME</strong> a utilizá-los exclusivamente para a finalidade a que se destinam, responsabilizar-me pela guarda
              e conservação, e comunicar qualquer alteração que os torne impróprios para uso. Estou ciente de que a assinatura digital
              aqui aposta possui validade jurídica conforme a MP 2.200-2/2001 e que este documento é protegido por hash criptográfico SHA-256
              que garante sua integridade e imutabilidade.
            </label>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
              <ChevronLeft size={15} /> Voltar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !assinatura || !selfie || !declaracao} className="gap-1.5">
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Registrando...</>
              ) : (
                <><ShieldCheck size={15} /> Confirmar Entrega</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && lastEntregaId && (
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Entrega Registrada!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {cart.length} item(ns) entregues para <span className="font-medium text-foreground">{selectedColab?.nome}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-2 font-mono">
              ID: {lastEntregaId.substring(0, 8).toUpperCase()} • Hash SHA-256 registrado
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button variant="outline" onClick={() => handleDownloadPdf(lastEntregaId)} disabled={downloadingPdf} className="gap-1.5">
              {downloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              Baixar Termo NR-06
            </Button>
            <Button onClick={resetForm} className="gap-1.5">
              <Plus size={15} /> Nova Entrega
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
