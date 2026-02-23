import { useState, useEffect } from 'react';
import { Search, ClipboardCheck, Plus, UserCheck, History, X, FileDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  setor: string;
  funcao: string;
  email: string | null;
  ativo: boolean;
}

interface EntregaHistorico {
  id: string;
  data_hora: string;
  motivo: string;
  assinatura_base64: string;
  observacao: string | null;
  itens: { nome_snapshot: string; ca_snapshot: string | null; quantidade: number; validade_snapshot: string | null }[];
}

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: '', matricula: '', setor: '', funcao: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Histórico state
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoColab, setHistoricoColab] = useState<Colaborador | null>(null);
  const [entregas, setEntregas] = useState<EntregaHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('colaboradores').select('*').eq('ativo', true).order('nome');
    if (data) setColaboradores(data as Colaborador[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = colaboradores.filter((c) => {
    const s = search.toLowerCase();
    return !s || c.nome.toLowerCase().includes(s) || c.matricula.toLowerCase().includes(s) || c.setor.toLowerCase().includes(s);
  });

  const handleAdd = async () => {
    if (!form.nome || !form.matricula || !form.setor || !form.funcao) return;
    setSubmitting(true);
    const { error } = await supabase.from('colaboradores').insert({
      nome: form.nome,
      matricula: form.matricula,
      setor: form.setor,
      funcao: form.funcao,
      email: form.email || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Colaborador cadastrado.' });
      setShowAdd(false);
      setForm({ nome: '', matricula: '', setor: '', funcao: '', email: '' });
      load();
    }
  };

  const openHistorico = async (colab: Colaborador) => {
    setHistoricoColab(colab);
    setHistoricoOpen(true);
    setLoadingHistorico(true);
    setEntregas([]);

    const { data: entregasData } = await supabase
      .from('entregas_epi')
      .select('id, data_hora, motivo, assinatura_base64, observacao')
      .eq('colaborador_id', colab.id)
      .order('data_hora', { ascending: false });

    if (entregasData && entregasData.length > 0) {
      const entregaIds = entregasData.map(e => e.id);
      const { data: itensData } = await supabase
        .from('entrega_epi_itens')
        .select('entrega_id, nome_snapshot, ca_snapshot, quantidade, validade_snapshot')
        .in('entrega_id', entregaIds);

      const result: EntregaHistorico[] = entregasData.map(e => ({
        ...e,
        itens: (itensData || []).filter(i => i.entrega_id === e.id),
      }));
      setEntregas(result);
    }

    setLoadingHistorico(false);
  };

  const handleDownloadPdf = async (entregaId: string) => {
    setDownloadingPdf(entregaId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-nr06-pdf', {
        body: { entregaId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    }
    setDownloadingPdf(null);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Colaboradores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{colaboradores.length} colaboradores ativos</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus size={15} /> Novo
        </Button>
      </div>

      <div className="bg-card rounded-lg border p-3">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, matrícula ou setor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Matrícula</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Setor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Função</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-16 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-20 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-24 rounded skeleton-shimmer" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded skeleton-shimmer ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.map((c) => (
                <tr key={c.id} className="table-row-hover group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{c.nome.charAt(0)}</span>
                      </div>
                      <span className="font-medium">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">{c.matricula}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{c.setor}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{c.funcao}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openHistorico(c)}
                      >
                        <History size={13} className="mr-1" /> Histórico
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => navigate(`/entrega-epi?colaborador=${c.id}`)}
                      >
                        <ClipboardCheck size={13} className="mr-1" /> Entrega
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <UserCheck size={36} className="mx-auto text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar a busca ou adicione um novo.</p>
          </div>
        )}
      </div>

      {/* Modal Novo Colaborador */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 h-9" placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Matrícula *</Label>
                <Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} className="mt-1 h-9" placeholder="MAT-001" />
              </div>
              <div>
                <Label className="text-xs">Setor *</Label>
                <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className="mt-1 h-9" placeholder="Produção" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Função *</Label>
                <Input value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="mt-1 h-9" placeholder="Operador" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9" placeholder="email@empresa.com" />
              </div>
            </div>
            <Button className="w-full h-9 font-medium" onClick={handleAdd} disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : 'Cadastrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Histórico de Entregas */}
      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} />
              Histórico de Entregas
            </DialogTitle>
            {historicoColab && (
              <p className="text-xs text-muted-foreground mt-1">
                {historicoColab.nome} — {historicoColab.matricula} • {historicoColab.setor}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
            {loadingHistorico ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2">
                    <div className="h-4 w-40 rounded skeleton-shimmer" />
                    <div className="h-3 w-60 rounded skeleton-shimmer" />
                    <div className="h-16 w-32 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : entregas.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardCheck size={32} className="mx-auto text-muted-foreground/25 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma entrega registrada.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">As entregas de EPI/EPC aparecerão aqui.</p>
              </div>
            ) : (
              entregas.map((entrega) => (
                <div key={entrega.id} className="rounded-lg border bg-card p-4 space-y-3 animate-fade-in">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(entrega.data_hora)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Motivo: <span className="font-medium">{entrega.motivo}</span>
                        {entrega.observacao && <span> — {entrega.observacao}</span>}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 shrink-0"
                      onClick={() => handleDownloadPdf(entrega.id)}
                      disabled={downloadingPdf === entrega.id}
                    >
                      {downloadingPdf === entrega.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <FileDown size={12} />
                      )}
                      NR-06
                    </Button>
                  </div>

                  {/* Itens */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider">EPI/EPC</th>
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider">C.A.</th>
                          <th className="text-center px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider">Qtde</th>
                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Validade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {entrega.itens.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1.5 font-medium">{item.nome_snapshot}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{item.ca_snapshot || '—'}</td>
                            <td className="px-2 py-1.5 text-center font-semibold">{item.quantidade}</td>
                            <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">
                              {item.validade_snapshot
                                ? new Date(item.validade_snapshot + 'T12:00:00').toLocaleDateString('pt-BR')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Assinatura */}
                  <div className="pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">Assinatura Digital</p>
                    {entrega.assinatura_base64 ? (
                      <div className="bg-muted/30 rounded-lg p-2 inline-block border border-dashed">
                        <img
                          src={entrega.assinatura_base64}
                          alt="Assinatura digital"
                          className="max-w-[200px] max-h-[60px] object-contain"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">Sem assinatura</p>
                    )}
                  </div>

                  {/* Código */}
                  <p className="text-[9px] text-muted-foreground/40 font-mono">
                    ID: {entrega.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
