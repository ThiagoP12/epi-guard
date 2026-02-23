import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export default function SetoresManager() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('setores').select('id, nome, descricao, ativo').order('nome');
    if (data) setSetores(data as Setor[]);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setLoading(true);
    const { error } = await supabase.from('setores').insert({ nome, descricao: novaDescricao.trim() || null });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message.includes('unique') ? 'Setor já existe.' : error.message, variant: 'destructive' });
    } else {
      setNovoNome('');
      setNovaDescricao('');
      toast({ title: 'Setor adicionado!' });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('setores').delete().eq('id', id);
    toast({ title: 'Setor removido.' });
    load();
  };

  const startEdit = (s: Setor) => {
    setEditingId(s.id);
    setEditNome(s.nome);
    setEditDescricao(s.descricao || '');
  };

  const saveEdit = async () => {
    if (!editingId || !editNome.trim()) return;
    const { error } = await supabase.from('setores').update({ nome: editNome.trim(), descricao: editDescricao.trim() || null }).eq('id', editingId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Setor atualizado!' });
      setEditingId(null);
      load();
    }
  };

  return (
    <div className="bg-card rounded-lg border p-5">
      <h2 className="text-sm font-semibold mb-4">Setores</h2>
      <p className="text-xs text-muted-foreground mb-3">Gerencie os setores disponíveis para vincular aos colaboradores.</p>

      {/* Add form */}
      <div className="flex gap-2 mb-4">
        <Input placeholder="Nome do setor" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Input placeholder="Descrição (opcional)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button size="sm" onClick={handleAdd} disabled={loading || !novoNome.trim()}>
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      {/* List */}
      {setores.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum setor cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {setores.map(s => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              {editingId === s.id ? (
                <>
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 text-xs flex-1" />
                  <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} className="h-7 text-xs flex-1" placeholder="Descrição" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Check size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X size={14} /></Button>
                </>
              ) : (
                <>
                  <span className="font-medium flex-1">{s.nome}</span>
                  {s.descricao && <span className="text-xs text-muted-foreground flex-1 truncate">{s.descricao}</span>}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(s)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
