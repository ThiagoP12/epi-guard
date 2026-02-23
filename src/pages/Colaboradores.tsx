import { useState, useEffect } from 'react';
import { Search, ClipboardCheck, Plus, UserCheck } from 'lucide-react';
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

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: '', matricula: '', setor: '', funcao: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

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
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs opacity-70 group-hover:opacity-100 transition-opacity"
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
    </div>
  );
}
