import { useState, useEffect } from 'react';
import { Search, ClipboardCheck, History, Plus } from 'lucide-react';
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
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('colaboradores').select('*').eq('ativo', true).order('nome');
    if (data) setColaboradores(data as Colaborador[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = colaboradores.filter((c) => {
    const s = search.toLowerCase();
    return !s || c.nome.toLowerCase().includes(s) || c.matricula.toLowerCase().includes(s);
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
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-foreground">Colaboradores</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={16} className="mr-1" /> Novo</Button>
      </div>

      <div className="bg-card rounded-lg border p-4 mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Matrícula</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Função</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs">{c.matricula}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.setor}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{c.funcao}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/entrega-epi?colaborador=${c.id}`)}>
                        <ClipboardCheck size={13} className="mr-1" /> Entrega
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Nenhum colaborador encontrado.</div>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} className="mt-1" /></div>
              <div><Label>Setor</Label><Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Função</Label><Input value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="mt-1" /></div>
              <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={submitting}>{submitting ? 'Salvando...' : 'Cadastrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
