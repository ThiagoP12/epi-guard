import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, Package, Search, Eye, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  ip_origem: string | null;
  user_agent: string | null;
  pdf_hash: string | null;
  colaborador?: { nome: string; matricula: string; cpf: string | null; setor: string; funcao: string };
  produto?: { nome: string; ca: string | null };
}

export default function Solicitacoes() {
  const { user } = useAuth();
  const { selectedEmpresa } = useEmpresa();
  const { toast } = useToast();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
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
    if (statusFilter !== 'todos') query = query.eq('status', statusFilter);

    const { data } = await query;
    if (data) {
      // Enrich with colaborador and produto
      const colabIds = [...new Set(data.map(s => s.colaborador_id))];
      const prodIds = [...new Set(data.map(s => s.produto_id))];

      const [colabRes, prodRes] = await Promise.all([
        supabase.from('colaboradores').select('id, nome, matricula, cpf, setor, funcao').in('id', colabIds),
        supabase.from('produtos').select('id, nome, ca').in('id', prodIds),
      ]);

      const enriched = data.map(s => ({
        ...s,
        colaborador: colabRes.data?.find(c => c.id === s.colaborador_id) || undefined,
        produto: prodRes.data?.find(p => p.id === s.produto_id) || undefined,
      }));
      setSolicitacoes(enriched as Solicitacao[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEmpresa, statusFilter]);

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
    s.produto?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const statusIcon = (s: string) => {
    if (s === 'pendente') return <Clock size={14} className="text-yellow-500" />;
    if (s === 'aprovado') return <CheckCircle size={14} className="text-green-500" />;
    if (s === 'rejeitado') return <XCircle size={14} className="text-red-500" />;
    if (s === 'entregue') return <Package size={14} className="text-blue-500" />;
    return null;
  };

  const counts = {
    pendente: solicitacoes.length, // already filtered by status unless 'todos'
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Solicitações de EPI</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie as solicitações dos colaboradores</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {['pendente', 'aprovado', 'rejeitado', 'entregue', 'todos'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="text-xs capitalize">
            {s}
          </Button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-9 w-48 text-xs" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
          <Package size={32} className="text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="bg-card rounded-xl border shadow-sm p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => { setSelected(s); setDetailOpen(true); setMotivoRejeicao(''); }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{s.colaborador?.nome || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{s.colaborador?.setor} • {s.colaborador?.funcao} • Mat: {s.colaborador?.matricula}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {statusIcon(s.status)}
                  <span className={cn("text-xs font-medium capitalize",
                    s.status === 'pendente' && 'text-yellow-600',
                    s.status === 'aprovado' && 'text-green-600',
                    s.status === 'rejeitado' && 'text-red-600',
                    s.status === 'entregue' && 'text-blue-600',
                  )}>{s.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{s.produto?.nome || '—'}</span>
                <span>CA: {s.produto?.ca || 'N/A'}</span>
                <span>Qtde: {s.quantidade}</span>
                <span className="ml-auto">{new Date(s.created_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail / Approve-Reject Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Colaborador:</span><p className="font-medium">{selected.colaborador?.nome}</p></div>
                <div><span className="text-muted-foreground">CPF:</span><p className="font-medium font-mono">{selected.colaborador?.cpf || '—'}</p></div>
                <div><span className="text-muted-foreground">Setor/Função:</span><p className="font-medium">{selected.colaborador?.setor} / {selected.colaborador?.funcao}</p></div>
                <div><span className="text-muted-foreground">Matrícula:</span><p className="font-medium">{selected.colaborador?.matricula}</p></div>
              </div>

              <div className="border-t pt-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Item:</span><p className="font-medium">{selected.produto?.nome}</p></div>
                  <div><span className="text-muted-foreground">CA:</span><p className="font-medium">{selected.produto?.ca || 'N/A'}</p></div>
                  <div><span className="text-muted-foreground">Quantidade:</span><p className="font-medium">{selected.quantidade}</p></div>
                  <div><span className="text-muted-foreground">Motivo:</span><p className="font-medium">{selected.motivo}</p></div>
                </div>
                {selected.observacao && <p className="text-xs mt-2"><span className="text-muted-foreground">Obs:</span> {selected.observacao}</p>}
              </div>

              {/* Audit info */}
              <div className="border-t pt-3 text-[10px] text-muted-foreground space-y-1">
                <p>IP: {selected.ip_origem || '—'} • Data: {new Date(selected.created_at).toLocaleString('pt-BR')}</p>
                {selected.pdf_hash && <p className="font-mono break-all">Hash: {selected.pdf_hash}</p>}
              </div>

              {/* Signature */}
              {selected.assinatura_base64 && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Assinatura Digital:</p>
                  <img src={selected.assinatura_base64} alt="Assinatura" className="max-h-24 border rounded" />
                </div>
              )}

              {/* Actions */}
              {selected.status === 'pendente' && (
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <Textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo da rejeição (obrigatório para rejeitar)" className="text-xs" rows={2} />
                  </div>
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

              {selected.status !== 'pendente' && selected.motivo_rejeicao && (
                <div className="border-t pt-3">
                  <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-3 py-2">
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
