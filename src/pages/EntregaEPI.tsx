import { useState, useEffect } from 'react';
import { CheckCircle, FileDown, Loader2 } from 'lucide-react';
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

const motivos = ['Primeira entrega', 'Troca por desgaste', 'Perda', 'Danificado', 'Outro'] as const;

interface Colaborador { id: string; nome: string; matricula: string; email: string | null; setor: string; funcao: string; }
interface Produto { id: string; nome: string; ca: string | null; tipo: string; saldo: number; data_validade: string | null; custo_unitario: number; }

export default function EntregaEPI() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [declaracao, setDeclaracao] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastEntregaId, setLastEntregaId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async (entregaId: string) => {
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-nr06-pdf', {
        body: { entregaId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('URL do documento não retornada');

      // Open the signed URL from Supabase Storage
      const win = window.open(data.url, '_blank');
      if (!win) {
        // Fallback: create a link and click it
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

  useEffect(() => {
    const load = async () => {
      const { data: colabs } = await supabase.from('colaboradores').select('id, nome, matricula, email, setor, funcao').eq('ativo', true).order('nome');
      if (colabs) setColaboradores(colabs as Colaborador[]);

      const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
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
    };
    load();
  }, []);

  const selectedProduct = produtos.find(p => p.id === produtoId);

  const handleSubmit = async () => {
    if (!colaboradorId || !produtoId || !motivo || !assinatura || !declaracao || !user) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos, assine e aceite a declaração.', variant: 'destructive' });
      return;
    }
    if (selectedProduct && quantidade > selectedProduct.saldo) {
      toast({ title: 'Erro', description: 'Saldo insuficiente.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      // Create entrega
      const { data: entrega, error: entregaError } = await supabase.from('entregas_epi').insert({
        colaborador_id: colaboradorId,
        usuario_id: user.id,
        motivo: motivo as any,
        observacao: observacao || null,
        assinatura_base64: assinatura,
        declaracao_aceita: true,
        ip_origem: 'browser',
        user_agent: navigator.userAgent,
        versao_termo: '1.0',
      }).select('id').single();

      if (entregaError) throw entregaError;

      // Create item
      const prod = selectedProduct!;
      const { error: itemError } = await supabase.from('entrega_epi_itens').insert({
        entrega_id: entrega.id,
        produto_id: produtoId,
        quantidade,
        nome_snapshot: prod.nome,
        ca_snapshot: prod.ca,
        validade_snapshot: prod.data_validade,
        custo_unitario_snapshot: prod.custo_unitario,
      });
      if (itemError) throw itemError;

      // Create stock movement
      const { error: movError } = await supabase.from('movimentacoes_estoque').insert({
        produto_id: produtoId,
        tipo_movimentacao: 'SAIDA',
        quantidade,
        motivo: `Entrega EPI: ${motivo}`,
        usuario_id: user.id,
        colaborador_id: colaboradorId,
        entrega_id: entrega.id,
      });
      if (movError) throw movError;

      // Try to send email via edge function
      try {
        const colab = colaboradores.find(c => c.id === colaboradorId);
        await supabase.functions.invoke('send-entrega-email', {
          body: { entregaId: entrega.id, colaboradorNome: colab?.nome, colaboradorEmail: colab?.email, itens: [{ nome: prod.nome, ca: prod.ca, quantidade }] },
        });
      } catch (emailErr) {
        console.warn('Email sending failed (function may not exist yet):', emailErr);
      }

      toast({ title: 'Entrega registrada!', description: 'Assinatura e movimentação salvas com sucesso.' });
      setLastEntregaId(entrega.id);

      // Reset form
      setColaboradorId('');
      setProdutoId('');
      setQuantidade(1);
      setMotivo('');
      setObservacao('');
      setAssinatura(null);
      setDeclaracao(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }

    setSubmitting(false);
  };

  const selectedColab = colaboradores.find(c => c.id === colaboradorId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Entrega de EPI</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Registre a entrega com assinatura digital</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-card rounded-xl border shadow-sm p-5 space-y-5">
          {/* Colaborador */}
          <div>
            <Label className="text-xs font-medium">Colaborador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecionar colaborador..." /></SelectTrigger>
              <SelectContent>
                {colaboradores.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedColab && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">
                {selectedColab.setor} • {selectedColab.funcao}
              </p>
            )}
          </div>

          {/* Item */}
          <div>
            <Label className="text-xs font-medium">Item (EPI/EPC) *</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecionar item..." /></SelectTrigger>
              <SelectContent>
                {produtos.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} — CA: {p.ca || 'N/A'} (Saldo: {p.saldo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Qty + Motivo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Quantidade *</Label>
              <Input type="number" min={1} max={selectedProduct?.saldo || 999} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="mt-1.5 h-10" />
            </div>
            <div>
              <Label className="text-xs font-medium">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {motivos.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observação */}
          <div>
            <Label className="text-xs font-medium">Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação (opcional)" className="mt-1.5" rows={2} />
          </div>

          {/* Assinatura */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Assinatura Digital *</Label>
            <SignatureCanvas onSignatureChange={setAssinatura} />
          </div>

          {/* Declaração */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-muted">
            <Checkbox id="declaracao" checked={declaracao} onCheckedChange={(v) => setDeclaracao(v === true)} className="mt-0.5" />
            <label htmlFor="declaracao" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
              Declaro que recebi os Equipamentos de Proteção Individual (EPI) listados acima e me comprometo a utilizá-los adequadamente durante a execução de minhas atividades, conforme orientações recebidas e disposições da NR-06.
            </label>
          </div>

          {/* Submit */}
          <Button className="w-full h-11 text-sm font-semibold" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Registrando...
              </span>
            ) : (
              <>
                <CheckCircle size={17} className="mr-2" />
                Confirmar Entrega
              </>
            )}
          </Button>

          {/* PDF Download after success */}
          {lastEntregaId && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-status-ok-bg border border-status-ok/20 animate-fade-in">
              <CheckCircle size={18} className="text-status-ok shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Entrega registrada com sucesso!</p>
                <p className="text-[10px] text-muted-foreground">Código: {lastEntregaId.substring(0, 8).toUpperCase()}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => handleDownloadPdf(lastEntregaId)}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                Termo NR-06
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
